use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WatchConfig {
    pub command: Vec<String>,
    pub cwd: Option<String>,
    pub max_restarts: u32,
    pub restart_delay: u64,
}
