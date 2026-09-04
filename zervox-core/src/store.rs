use crate::types::IncidentRecord;
use anyhow::{Context, Result};
use rusqlite::Connection;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use async_trait::async_trait;

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
}

#[derive(Clone)]
pub struct SqliteStore {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteStore {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path).context("Failed to open SQLite database")?;
        
        conn.pragma_update(None, "journal_mode", "WAL")
            .context("Failed to set WAL mode")?;
        conn.pragma_update(None, "synchronous", "NORMAL")
            .context("Failed to set synchronous mode")?;
        conn.busy_timeout(Duration::from_secs(5))
            .context("Failed to set busy timeout")?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                alert_name TEXT NOT NULL,
                severity TEXT NOT NULL,
                mode TEXT NOT NULL,
                root_cause TEXT NOT NULL,
                action_type TEXT NOT NULL,
                target_resource TEXT NOT NULL,
                policy_allowed BOOLEAN NOT NULL,
                policy_violations TEXT,
                execution_status TEXT NOT NULL,
                execution_error TEXT,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            )",
            (),
        )
        .context("Failed to create incidents table")?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }
}

#[async_trait]
impl IncidentStore for SqliteStore {
    async fn insert_incident(&self, record: &IncidentRecord) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO incidents (
                id, alert_name, severity, mode, root_cause,
                action_type, target_resource, policy_allowed,
                policy_violations, execution_status, execution_error,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            (
                &record.id,
                &record.alert_name,
                &record.severity,
                &record.mode,
                &record.root_cause,
                &record.action_type,
                &record.target_resource,
                record.policy_allowed,
                &record.policy_violations,
                &record.execution_status,
                &record.execution_error,
                record.created_at.to_rfc3339(),
                record.updated_at.to_rfc3339(),
            ),
        )
        .context("Failed to insert incident record")?;
        Ok(())
    }

    async fn update_execution_status(
        &self,
        id: &str,
        status: &str,
        error: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE incidents 
             SET execution_status = ?1, execution_error = ?2, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?3",
            (status, error, id),
        )
        .context("Failed to update execution status")?;
        Ok(())
    }

    async fn get_recent_incidents(&self, limit: usize) -> Result<Vec<IncidentRecord>> {
        use chrono::{DateTime, Utc};
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, alert_name, severity, mode, root_cause,
                    action_type, target_resource, policy_allowed,
                    policy_violations, execution_status, execution_error,
                    created_at, updated_at
             FROM incidents
             ORDER BY created_at DESC
             LIMIT ?1",
        )?;

        let rows = stmt.query_map([limit as i64], |row| {
            let policy_allowed: bool = row.get(7)?;
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
                policy_allowed,
                policy_violations: row.get(8)?,
                execution_status: row.get(9)?,
                execution_error: row.get(10)?,
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
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM incidents", [], |r| r.get(0))?;
        Ok(count as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use chrono::Utc;

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
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        store.insert_incident(&record).await.unwrap();
        store.update_execution_status("inc-123", "resolved", None).await.unwrap();
    }
}
