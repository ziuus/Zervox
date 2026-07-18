use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardConfigPersisted {
    pub mode: String,
    #[serde(rename = "webhookUrl")]
    pub webhook_url: String,
}

impl Default for DashboardConfigPersisted {
    fn default() -> Self {
        Self {
            mode: "INTERACTIVE".into(),
            webhook_url: String::new(),
        }
    }
}

impl DashboardConfigPersisted {
    fn path() -> PathBuf {
        let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
        base.join("zervox").join("dashboard.json")
    }

    pub fn load() -> Self {
        let path = Self::path();
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self) {
        let path = Self::path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(self) {
            let _ = std::fs::write(&path, json);
        }
    }
}
