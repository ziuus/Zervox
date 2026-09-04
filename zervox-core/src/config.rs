use crate::types::NodeRole;
use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug, Clone)]
#[command(name = "zervox-core", author = "Zervox Team", version = "0.1.0", about = "Autonomous Resilient Kubernetes SRE Remediation Engine")]
pub struct AppConfig {
    #[arg(long, env = "ZERVOX_ROLE", default_value = "primary")]
    pub role: String,

    #[arg(long, env = "ZERVOX_HTTP_PORT", default_value_t = 8080)]
    pub http_port: u16,

    #[arg(long, env = "ZERVOX_HEARTBEAT_PORT", default_value_t = 9000)]
    pub heartbeat_port: u16,

    #[arg(long, env = "ZERVOX_PEER")]
    pub peer: Option<String>,

    #[arg(long, env = "ZERVOX_API_KEY", default_value = "zervox-secret-token")]
    pub api_key: String,

    #[arg(long, env = "ZERVOX_DB_PATH", default_value = "zervox.db")]
    pub db_path: PathBuf,

    #[arg(long, env = "OPA_URL", default_value = "http://127.0.0.1:8181/v1/data/zervox/authz")]
    pub opa_url: String,

    #[arg(long, env = "LLM_URL")]
    pub llm_url: Option<String>,

    #[arg(long, env = "LLM_API_KEY")]
    pub llm_api_key: Option<String>,

    #[arg(long, env = "LLM_MODEL", default_value = "gpt-4o-mini")]
    pub llm_model: String,

    #[arg(long, env = "ZERVOX_FORCE_FALLBACK", default_value_t = false)]
    pub force_fallback: bool,

    #[arg(long, env = "ZERVOX_DRY_RUN", default_value_t = false)]
    pub dry_run: bool,

    #[arg(long, env = "KUBECONFIG")]
    pub kubeconfig: Option<PathBuf>,

    #[arg(long, env = "TLS_CERT_PATH")]
    pub tls_cert_path: Option<PathBuf>,

    #[arg(long, env = "TLS_KEY_PATH")]
    pub tls_key_path: Option<PathBuf>,
}

impl AppConfig {
    pub fn get_node_role(&self) -> NodeRole {
        if self.role.eq_ignore_ascii_case("backup") {
            NodeRole::Backup
        } else {
            NodeRole::Primary
        }
    }
}
