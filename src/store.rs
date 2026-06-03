use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProcessRecord {
    pub name: String,
    pub command: Vec<String>,
    pub cwd: Option<String>,
    pub max_restarts: u32,
    #[serde(default)]
    pub auto_fix: bool,
}

impl ProcessRecord {
    pub fn new(
        name: String,
        command: Vec<String>,
        cwd: Option<String>,
        max_restarts: u32,
        auto_fix: bool,
    ) -> Self {
        Self {
            name,
            command,
            cwd,
            max_restarts,
            auto_fix,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct StoreFile {
    processes: Vec<ProcessRecord>,
}

#[derive(Debug, Clone)]
pub struct Store {
    pub path: PathBuf,
    pub processes: Vec<ProcessRecord>,
}

impl Store {
    pub fn load_default() -> Result<Self> {
        let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
        let path = base.join("zervox").join("processes.json");
        Self::load(path)
    }

    pub fn load(path: PathBuf) -> Result<Self> {
        if !path.exists() {
            return Ok(Self {
                path,
                processes: Vec::new(),
            });
        }
        let text = fs::read_to_string(&path)
            .with_context(|| format!("failed to read {}", path.display()))?;
        let file: StoreFile = serde_json::from_str(&text)
            .with_context(|| format!("failed to parse {}", path.display()))?;
        Ok(Self {
            path,
            processes: file.processes,
        })
    }

    pub fn save(&self) -> Result<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("failed to create {}", parent.display()))?;
        }
        let file = StoreFile {
            processes: self.processes.clone(),
        };
        let text = serde_json::to_string_pretty(&file)?;
        fs::write(&self.path, text)
            .with_context(|| format!("failed to write {}", self.path.display()))
    }

    pub fn upsert(&mut self, record: ProcessRecord) {
        if let Some(existing) = self.processes.iter_mut().find(|p| p.name == record.name) {
            *existing = record;
        } else {
            self.processes.push(record);
        }
    }

    pub fn find(&self, name: &str) -> Option<ProcessRecord> {
        self.processes.iter().find(|p| p.name == name).cloned()
    }

    pub fn remove(&mut self, name: &str) -> bool {
        let before = self.processes.len();
        self.processes.retain(|p| p.name != name);
        self.processes.len() != before
    }
}

pub fn state_dir() -> Result<PathBuf> {
    let base = dirs::state_dir()
        .or_else(dirs::data_local_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("zervox");
    fs::create_dir_all(&dir).with_context(|| format!("failed to create {}", dir.display()))?;
    Ok(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upsert_replaces_existing_record() {
        let mut store = Store {
            path: PathBuf::from("x"),
            processes: vec![],
        };
        store.upsert(ProcessRecord::new(
            "api".into(),
            vec!["node".into(), "a.js".into()],
            None,
            1,
            false,
        ));
        store.upsert(ProcessRecord::new(
            "api".into(),
            vec!["node".into(), "b.js".into()],
            Some("/tmp".into()),
            2,
            true,
        ));
        assert_eq!(store.processes.len(), 1);
        assert_eq!(store.processes[0].command, vec!["node", "b.js"]);
        assert_eq!(store.processes[0].max_restarts, 2);
        assert!(store.processes[0].auto_fix);
    }
}
