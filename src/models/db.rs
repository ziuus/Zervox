use anyhow::Result;
use rusqlite::{params, Connection};

pub struct IncidentStore {
    conn: Connection,
}

impl IncidentStore {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS incidents (
                id INTEGER PRIMARY KEY,
                summary TEXT NOT NULL,
                anomalies_count INTEGER NOT NULL,
                errors_count INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;
        Ok(Self { conn })
    }

    pub fn insert_incident(&self, summary: &str, anomalies: usize, errors: usize) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO incidents (summary, anomalies_count, errors_count) VALUES (?1, ?2, ?3)",
            params![summary, anomalies as i64, errors as i64],
        )?;
        Ok(self.conn.last_insert_rowid())
    }
}
