use crate::types::{ForensicSnapshot, IncidentRecord};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tracing::{error, info, warn};

#[async_trait]
pub trait IncidentStore: Send + Sync {
    async fn insert_incident(&self, record: &IncidentRecord) -> Result<()>;
    async fn update_execution_status(
        &self,
        id: &str,
        status: &str,
        error: Option<&str>,
    ) -> Result<()>;
    async fn get_recent_incidents(&self, limit: usize) -> Result<Vec<IncidentRecord>>;
    async fn count_incidents(&self) -> Result<usize>;
    async fn save_forensic_snapshot(&self, snapshot: &ForensicSnapshot) -> Result<()>;
    async fn get_forensic_snapshot(&self, incident_id: &str) -> Result<Option<ForensicSnapshot>>;
}

/// Thread-safe SQLite WAL store with retry logic for concurrent failover transitions.
/// Uses a single connection under Arc<Mutex<>> with busy_timeout=5s so concurrent
/// writers (primary + promoted backup) block rather than fail immediately.
#[derive(Clone)]
pub struct SqliteStore {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteStore {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(&path)
            .with_context(|| format!("Failed to open SQLite DB at {:?}", path.as_ref()))?;

        Self::configure_and_init(conn)
    }

    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory().context("Failed to open in-memory SQLite DB")?;
        Self::configure_and_init(conn)
    }

    fn configure_and_init(conn: Connection) -> Result<Self> {
        // WAL mode: allows one writer + many readers concurrently
        let _ = conn.pragma_update(None, "journal_mode", &"WAL");
        let _ = conn.pragma_update(None, "synchronous", &"NORMAL");
        let _ = conn.pragma_update(None, "cache_size", &-65536i64); // 64MB cache
        let _ = conn.busy_timeout(Duration::from_secs(5));
        let _ = conn.pragma_update(None, "foreign_keys", &"ON");

        let store = Self {
            conn: Arc::new(Mutex::new(conn)),
        };

        store.init_schema()?;
        info!("SQLite incident store initialized (WAL mode, 5s busy timeout, 64MB cache)");
        Ok(store)
    }

    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS incidents (
                id                 TEXT PRIMARY KEY,
                alert_name         TEXT NOT NULL,
                severity           TEXT NOT NULL,
                mode               TEXT NOT NULL,
                root_cause         TEXT NOT NULL,
                action_type        TEXT NOT NULL,
                target_resource    TEXT NOT NULL,
                policy_allowed     BOOLEAN NOT NULL,
                policy_violations  TEXT,
                execution_status   TEXT NOT NULL DEFAULT 'pending',
                execution_error    TEXT,
                forensic_snapshot_id TEXT,
                created_at         TEXT NOT NULL,
                updated_at         TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_incidents_created
                ON incidents(created_at DESC);

            CREATE INDEX IF NOT EXISTS idx_incidents_status
                ON incidents(execution_status);

            CREATE TABLE IF NOT EXISTS incident_forensics (
                id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                pod_name TEXT NOT NULL,
                namespace TEXT NOT NULL,
                pod_spec_json TEXT NOT NULL,
                container_logs TEXT NOT NULL,
                volatile_memory_dump TEXT NOT NULL,
                sha256_hash TEXT NOT NULL,
                captured_at DATETIME NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_forensics_incident_id
                ON incident_forensics(incident_id);
            ",
        )
        .context("Failed to create database tables")?;

        // Migration: ensure forensic_snapshot_id column exists
        let _ = conn.execute("ALTER TABLE incidents ADD COLUMN forensic_snapshot_id TEXT", ());

        Ok(())
    }

    /// Retry wrapper for SQLITE_BUSY / lock contention during failover.
    fn with_retry<F>(&self, op: &str, mut f: F) -> Result<()>
    where
        F: FnMut() -> Result<()>,
    {
        const MAX_ATTEMPTS: u32 = 5;
        for attempt in 1..=MAX_ATTEMPTS {
            match f() {
                Ok(()) => return Ok(()),
                Err(e) => {
                    let msg = e.to_string();
                    if msg.contains("locked") || msg.contains("SQLITE_BUSY") {
                        if attempt < MAX_ATTEMPTS {
                            warn!(
                                op,
                                attempt,
                                "SQLite busy/locked during failover; retrying in 50ms"
                            );
                            std::thread::sleep(Duration::from_millis(50 * attempt as u64));
                            continue;
                        }
                    }
                    error!(op, error = %e, "SQLite operation failed");
                    return Err(e);
                }
            }
        }
        anyhow::bail!("SQLite operation '{}' failed after {} retries", op, MAX_ATTEMPTS)
    }
}

#[async_trait]
impl IncidentStore for SqliteStore {
    async fn insert_incident(&self, record: &IncidentRecord) -> Result<()> {
        self.with_retry("insert_incident", || {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "INSERT OR IGNORE INTO incidents (
                    id, alert_name, severity, mode, root_cause,
                    action_type, target_resource, policy_allowed,
                    policy_violations, execution_status, execution_error,
                    forensic_snapshot_id, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                params![
                    record.id,
                    record.alert_name,
                    record.severity,
                    record.mode,
                    record.root_cause,
                    record.action_type,
                    record.target_resource,
                    record.policy_allowed,
                    record.policy_violations,
                    record.execution_status,
                    record.execution_error,
                    record.forensic_snapshot_id,
                    record.created_at.to_rfc3339(),
                    record.updated_at.to_rfc3339(),
                ],
            )
            .context("Failed to insert incident record")?;
            Ok(())
        })
    }

    async fn update_execution_status(
        &self,
        id: &str,
        status: &str,
        error: Option<&str>,
    ) -> Result<()> {
        self.with_retry("update_execution_status", || {
            let conn = self.conn.lock().unwrap();
            let now = Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE incidents
                 SET execution_status = ?1, execution_error = ?2, updated_at = ?3
                 WHERE id = ?4",
                params![status, error, now, id],
            )
            .context("Failed to update execution status")?;
            Ok(())
        })
    }

    async fn get_recent_incidents(&self, limit: usize) -> Result<Vec<IncidentRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, alert_name, severity, mode, root_cause,
                    action_type, target_resource, policy_allowed,
                    policy_violations, execution_status, execution_error,
                    forensic_snapshot_id, created_at, updated_at
             FROM incidents
             ORDER BY created_at DESC
             LIMIT ?1",
        )?;

        let rows = stmt.query_map([limit as i64], |row| {
            let policy_allowed: bool = row.get(7)?;
            let forensic_snapshot_id: Option<String> = row.get(11)?;
            let created_at_str: String = row.get(12)?;
            let updated_at_str: String = row.get(13)?;

            let created_at = DateTime::parse_from_rfc3339(&created_at_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());
            let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());

            Ok(IncidentRecord {
                id: row.get(0)?,
                alert_name: row.get(1)?,
                severity: row.get(2)?,
                mode: row.get(3)?,
                root_cause: row.get(4)?,
                action_type: row.get(5)?,
                target_resource: row.get(6)?,
                policy_allowed,
                policy_violations: row.get(8)?,
                execution_status: row.get(9)?,
                execution_error: row.get(10)?,
                forensic_snapshot_id,
                created_at,
                updated_at,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    async fn count_incidents(&self) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let count: i64 =
            conn.query_row("SELECT COUNT(*) FROM incidents", [], |r| r.get(0))?;
        Ok(count as usize)
    }

    async fn save_forensic_snapshot(&self, snapshot: &ForensicSnapshot) -> Result<()> {
        self.with_retry("save_forensic_snapshot", || {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "INSERT OR REPLACE INTO incident_forensics (
                    id, incident_id, pod_name, namespace,
                    pod_spec_json, container_logs, volatile_memory_dump,
                    sha256_hash, captured_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    snapshot.id,
                    snapshot.incident_id,
                    snapshot.pod_name,
                    snapshot.namespace,
                    snapshot.pod_spec_json,
                    snapshot.container_logs,
                    snapshot.volatile_memory_dump,
                    snapshot.sha256_hash,
                    snapshot.captured_at.to_rfc3339(),
                ],
            )
            .context("Failed to insert forensic snapshot")?;

            let _ = conn.execute(
                "UPDATE incidents SET forensic_snapshot_id = ?1 WHERE id = ?2",
                params![snapshot.id, snapshot.incident_id],
            );

            Ok(())
        })
    }

    async fn get_forensic_snapshot(&self, incident_id: &str) -> Result<Option<ForensicSnapshot>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, incident_id, pod_name, namespace,
                    pod_spec_json, container_logs, volatile_memory_dump,
                    sha256_hash, captured_at
             FROM incident_forensics
             WHERE incident_id = ?1 OR id = ?1
             LIMIT 1",
        )?;

        let mut rows = stmt.query_map([incident_id], |row| {
            let captured_at_str: String = row.get(8)?;
            let captured_at = DateTime::parse_from_rfc3339(&captured_at_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());

            Ok(ForensicSnapshot {
                id: row.get(0)?,
                incident_id: row.get(1)?,
                pod_name: row.get(2)?,
                namespace: row.get(3)?,
                pod_spec_json: row.get(4)?,
                container_logs: row.get(5)?,
                volatile_memory_dump: row.get(6)?,
                sha256_hash: row.get(7)?,
                captured_at,
            })
        })?;

        if let Some(res) = rows.next() {
            Ok(Some(res?))
        } else {
            Ok(None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_store_crud_lifecycle() {
        let temp_db = NamedTempFile::new().unwrap();
        let store = SqliteStore::new(temp_db.path()).unwrap();

        let record = IncidentRecord {
            id: "inc-123".to_string(),
            alert_name: "TestAlert".to_string(),
            severity: "critical".to_string(),
            mode: "ai".to_string(),
            root_cause: "cpu spike".to_string(),
            action_type: "scale".to_string(),
            target_resource: "deployment/api".to_string(),
            policy_allowed: true,
            policy_violations: None,
            execution_status: "pending".to_string(),
            execution_error: None,
            forensic_snapshot_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        store.insert_incident(&record).await.unwrap();
        assert_eq!(store.count_incidents().await.unwrap(), 1);

        store
            .update_execution_status("inc-123", "resolved", None)
            .await
            .unwrap();

        let recent = store.get_recent_incidents(10).await.unwrap();
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].execution_status, "resolved");

        let snapshot = ForensicSnapshot {
            id: "snap-123".to_string(),
            incident_id: "inc-123".to_string(),
            pod_name: "victim-pod".to_string(),
            namespace: "default".to_string(),
            pod_spec_json: r#"{"name":"victim-pod"}"#.to_string(),
            container_logs: "fatal: sigsegv at 0x00401000".to_string(),
            volatile_memory_dump: "PID 1: python3 exploit.py".to_string(),
            sha256_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string(),
            captured_at: Utc::now(),
        };

        store.save_forensic_snapshot(&snapshot).await.unwrap();
        let fetched = store.get_forensic_snapshot("inc-123").await.unwrap();
        assert!(fetched.is_some());
        assert_eq!(fetched.unwrap().pod_name, "victim-pod");
    }

    #[tokio::test]
    async fn test_insert_or_ignore_idempotent() {
        let store = SqliteStore::in_memory().unwrap();
        let record = IncidentRecord {
            id: "dup-001".to_string(),
            alert_name: "Test".to_string(),
            severity: "warning".to_string(),
            mode: "fallback".to_string(),
            root_cause: "test".to_string(),
            action_type: "no_action".to_string(),
            target_resource: "none".to_string(),
            policy_allowed: false,
            policy_violations: Some("test violation".to_string()),
            execution_status: "blocked_by_policy".to_string(),
            execution_error: None,
            forensic_snapshot_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        // Double insert must not error
        store.insert_incident(&record).await.unwrap();
        store.insert_incident(&record).await.unwrap();
        assert_eq!(store.count_incidents().await.unwrap(), 1);
    }
}
