use clap::Parser;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use zervox_core::config::AppConfig;
use zervox_core::create_app;
use zervox_core::executor::RemediationExecutor;
use zervox_core::llm::LlmAnalyzer;
use zervox_core::policy::PolicyEngine;
use zervox_core::status::AppState;
use zervox_core::store::{IncidentStore, SqliteStore};
use zervox_core::watchdog::{Watchdog, wait_for_primary_failure};
use zervox_core::types::NodeRole;

async fn start_active_node(config: AppConfig, is_promoted: bool) -> anyhow::Result<()> {
    let http_port = config.http_port;
    let heartbeat_port = config.heartbeat_port;

    let sqlite_store = SqliteStore::new(&config.db_path)?;
    let store: Arc<dyn IncidentStore> = Arc::new(sqlite_store);
    info!("SQLite incident store initialized (WAL mode active)");

    let policy = PolicyEngine::new(config.opa_url.clone());
    let executor = RemediationExecutor::new(config.kubeconfig.clone(), config.dry_run).await;
    
    let llm = LlmAnalyzer::new(
        config.llm_url.clone(),
        config.llm_api_key.clone(),
        config.llm_model.clone(),
        config.force_fallback,
    );

    let watchdog = Watchdog::new(NodeRole::Primary, config.peer.clone());
    let watchdog_bg = watchdog.clone();
    
    let cert_path = config.tls_cert_path.clone();
    let key_path = config.tls_key_path.clone();

    tokio::spawn(async move {
        watchdog_bg.run_primary_listener(heartbeat_port, cert_path, key_path).await;
    });

    let correlation = Arc::new(zervox_core::correlation::ThreatCorrelationEngine::default());

    let app_state = Arc::new(AppState {
        config: config.clone(),
        store,
        policy,
        executor,
        watchdog,
        start_time: Instant::now(),
        llm,
        correlation,
    });

    let app = create_app(app_state);
    let addr = SocketAddr::from(([0, 0, 0, 0], http_port));
    info!(addr = %addr, promoted = is_promoted, "Zervox HTTP Control Plane & Webhook listener ready");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,zervox_core=debug,tower_http=info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = AppConfig::parse();
    let node_role = config.get_node_role();

    info!(
        version = env!("CARGO_PKG_VERSION"),
        role = %node_role,
        "Starting Zervox SRE Remediation Core Engine"
    );

    if node_role == NodeRole::Primary {
        start_active_node(config, false).await?;
    } else {
        info!("BACKUP mode enabled. Engine is fully dormant.");
        wait_for_primary_failure(config.clone()).await;
        
        info!("🚨 PRIMARY FAILURE CONFIRMED! Breaking dormant state. Promoting to ACTIVE leader.");
        start_active_node(config, true).await?;
    }

    Ok(())
}
