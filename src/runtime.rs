use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use time::OffsetDateTime;

use crate::store::state_dir;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RuntimeStatus {
    Starting,
    Online,
    Restarting,
    Stopped,
    Crashed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeRecord {
    pub name: String,
    pub supervisor_pid: u32,
    pub child_pid: Option<u32>,
    pub status: RuntimeStatus,
    pub restarts: u32,
    pub max_restarts: u32,
    pub command: Vec<String>,
    pub cwd: Option<String>,
    pub log_path: PathBuf,
    pub started_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
    pub last_exit_code: Option<i32>,
    pub last_error_hint: Option<String>,
}

impl RuntimeRecord {
    pub fn new(
        name: String,
        supervisor_pid: u32,
        command: Vec<String>,
        cwd: Option<String>,
        max_restarts: u32,
        log_path: PathBuf,
    ) -> Self {
        let now = OffsetDateTime::now_utc();
        Self {
            name,
            supervisor_pid,
            child_pid: None,
            status: RuntimeStatus::Starting,
            restarts: 0,
            max_restarts,
            command,
            cwd,
            log_path,
            started_at: now,
            updated_at: now,
            last_exit_code: None,
            last_error_hint: None,
        }
    }

    pub fn touch(&mut self) {
        self.updated_at = OffsetDateTime::now_utc();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct RuntimeFile {
    processes: Vec<RuntimeRecord>,
}

#[derive(Debug, Clone)]
pub struct RuntimeStore {
    pub path: PathBuf,
    pub processes: Vec<RuntimeRecord>,
}

impl RuntimeStore {
    pub fn load_default() -> Result<Self> {
        Self::load(state_dir()?.join("runtime.json"))
    }

    pub fn load(path: PathBuf) -> Result<Self> {
        if !path.exists() {
            return Ok(Self {
                path,
                processes: vec![],
            });
        }
        let text = fs::read_to_string(&path)
            .with_context(|| format!("failed to read {}", path.display()))?;
        let file: RuntimeFile = serde_json::from_str(&text)
            .with_context(|| format!("failed to parse {}", path.display()))?;
        Ok(Self {
            path,
            processes: file.processes,
        })
    }

    pub fn save(&self) -> Result<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        let text = serde_json::to_string_pretty(&RuntimeFile {
            processes: self.processes.clone(),
        })?;
        fs::write(&self.path, text)
            .with_context(|| format!("failed to write {}", self.path.display()))
    }

    pub fn upsert(&mut self, record: RuntimeRecord) {
        if let Some(existing) = self.processes.iter_mut().find(|p| p.name == record.name) {
            *existing = record;
        } else {
            self.processes.push(record);
        }
    }

    pub fn update<F>(&mut self, name: &str, f: F) -> Result<()>
    where
        F: FnOnce(&mut RuntimeRecord),
    {
        let item = self
            .processes
            .iter_mut()
            .find(|p| p.name == name)
            .with_context(|| format!("no runtime process named '{name}'"))?;
        f(item);
        item.touch();
        self.save()
    }

    pub fn find(&self, name: &str) -> Option<RuntimeRecord> {
        self.processes.iter().find(|p| p.name == name).cloned()
    }

    pub fn remove(&mut self, name: &str) -> bool {
        let before = self.processes.len();
        self.processes.retain(|p| p.name != name);
        self.processes.len() != before
    }
}

pub fn logs_dir() -> Result<PathBuf> {
    let dir = state_dir()?.join("logs");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn runtime_log_path(name: &str) -> Result<PathBuf> {
    let safe: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    Ok(logs_dir()?.join(format!("{safe}.log")))
}
