use crate::types::IncidentRecord;
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tracing::{error, info, warn};

/// Thread-safe SQLite WAL store with retry logic for concurrent failover transitions.
/// Uses a single connection under Arc<Mutex<>> with busy_timeout=5s so concurrent
/// writers (primary + promoted backup) block rather than fail immediately.
#[derive(Clone)]
pub struct IncidentStore {
    conn: Arc<Mutex<Connection>>,
}

impl IncidentStore {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(&path)
            .with_context(|| format!("Failed to open SQLite DB at {:?}", path.as_ref()))?;

        // ── WAL mode: allows one writer + many readers concurrently ──────────
        conn.pragma_update(None, "journal_mode", &"WAL")
            .context("Failed to enable WAL journal mode")?;

        // NORMAL fsync: durable enough for SRE operations, better throughput
        conn.pragma_update(None, "synchronous", &"NORMAL")
            .context("Failed to set synchronous=NORMAL")?;

        // page_size must be set before first write; 4096 is optimal for WAL
        conn.pragma_update(None, "page_size", &4096i64)
            .context("Failed to set page_size")?;

        // Cache 64MB in-process to reduce I/O on incident burst
        conn.pragma_update(None, "cache_size", &-65536i64)
            .context("Failed to set cache_size")?;

        // 5-second busy timeout: during failover the newly promoted backup waits
        // for any in-flight primary transaction to commit before writing
        conn.busy_timeout(Duration::from_secs(5))
            .context("Failed to set busy timeout")?;

        // Enable foreign key enforcement
        conn.pragma_update(None, "foreign_keys", &"ON")
            .context("Failed to enable foreign_keys")?;

        let store = Self {
            conn: Arc::new(Mutex::new(conn)),
        };

        store.init_schema()?;
        info!("SQLite incident store initialized (WAL mode, 5s busy timeout)");
        Ok(store)
    }

    #[cfg(test)]
    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory().context("Failed to open in-memory SQLite")?;
        conn.pragma_update(None, "journal_mode", &"WAL")?;
        conn.busy_timeout(Duration::from_secs(5))?;
        let store = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        store.init_schema()?;
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
                policy_allowed     INTEGER NOT NULL DEFAULT 0,
                policy_violations  TEXT,
                execution_status   TEXT NOT NULL DEFAULT 'pending',
                execution_error    TEXT,
                created_at         TEXT NOT NULL,
                updated_at         TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_incidents_created
                ON incidents(created_at DESC);

            CREATE INDEX IF NOT EXISTS idx_incidents_status
                ON incidents(execution_status);
            ",
        )
        .context("Failed to initialize database schema")?;
        Ok(())
    }

    /// Insert a new incident record. Retries up to 3 times on SQLITE_BUSY
    /// which occurs when the backup promotion happens mid-write.
    pub fn insert_incident(&self, record: &IncidentRecord) -> Result<()> {
        self.with_retry("insert_incident", || {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "INSERT OR IGNORE INTO incidents (
                    id, alert_name, severity, mode, root_cause, action_type,
                    target_resource, policy_allowed, policy_violations,
                    execution_status, execution_error, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                params![
                    record.id,
                    record.alert_name,
                    record.severity,
                    record.mode,
                    record.root_cause,
                    record.action_type,
                    record.target_resource,
                    if record.policy_allowed { 1i32 } else { 0i32 },
                    record.policy_violations,
                    record.execution_status,
                    record.execution_error,
                    record.created_at.to_rfc3339(),
                    record.updated_at.to_rfc3339(),
                ],
            )
            .context("Failed to insert incident")
            .map(|_| ())
        })
    }

    /// Update execution status after OPA gate + executor result.
    pub fn update_execution_status(
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
            .context("Failed to update execution status")
            .map(|_| ())
        })
    }

    /// Retrieve most recent incidents (DESC by created_at).
    pub fn get_recent_incidents(&self, limit: usize) -> Result<Vec<IncidentRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, alert_name, severity, mode, root_cause, action_type,
                    target_resource, policy_allowed, policy_violations,
                    execution_status, execution_error, created_at, updated_at
             FROM incidents
             ORDER BY created_at DESC
             LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            let policy_allowed_int: i32 = row.get(7)?;
            let created_at_str: String = row.get(11)?;
            let updated_at_str: String = row.get(12)?;

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
                policy_allowed: policy_allowed_int == 1,
                policy_violations: row.get(8)?,
                execution_status: row.get(9)?,
                execution_error: row.get(10)?,
                created_at,
                updated_at,
            })
        })?;

        let mut incidents = Vec::new();
        for r in rows {
            incidents.push(r?);
        }
        Ok(incidents)
    }

    pub fn count_incidents(&self) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let count: i64 =
            conn.query_row("SELECT COUNT(*) FROM incidents", [], |r| r.get(0))?;
        Ok(count as usize)
    }

    /// Retry wrapper for SQLITE_BUSY / lock contention during failover.
    /// Backs off 50ms between attempts — short enough to not stall remediation.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_store_full_lifecycle() {
        let store = IncidentStore::in_memory().unwrap();
        let id = "inc-test-001".to_string();
        let record = IncidentRecord {
            id: id.clone(),
            alert_name: "PodCrashLooping".to_string(),
            severity: "critical".to_string(),
            mode: "fallback".to_string(),
            root_cause: "Container OOM kill".to_string(),
            action_type: "restart_pod".to_string(),
            target_resource: "pod/default/victim-api-891".to_string(),
            policy_allowed: true,
            policy_violations: None,
            execution_status: "pending".to_string(),
            execution_error: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        store.insert_incident(&record).unwrap();
        assert_eq!(store.count_incidents().unwrap(), 1);

        let recent = store.get_recent_incidents(10).unwrap();
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].execution_status, "pending");

        store.update_execution_status(&id, "resolved", None).unwrap();
        let updated = store.get_recent_incidents(10).unwrap();
        assert_eq!(updated[0].execution_status, "resolved");
    }

    #[test]
    fn test_insert_or_ignore_idempotent() {
        let store = IncidentStore::in_memory().unwrap();
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
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        // Double insert must not error
        store.insert_incident(&record).unwrap();
        store.insert_incident(&record).unwrap();
        assert_eq!(store.count_incidents().unwrap(), 1);
    }
}
