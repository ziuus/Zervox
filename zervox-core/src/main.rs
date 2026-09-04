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
use zervox_core::store::IncidentStore;
use zervox_core::watchdog::Watchdog;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. Initialize Logging / Tracing
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,zervox_core=debug,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 2. Parse CLI & Environment Configuration
    let config = AppConfig::parse();
    let node_role = config.get_node_role();
    let http_port = config.http_port;
    let heartbeat_port = config.heartbeat_port;

    info!(
        version = env!("CARGO_PKG_VERSION"),
        role = %node_role,
        http_port = http_port,
        heartbeat_port = heartbeat_port,
        db_path = ?config.db_path,
        "Starting Zervox SRE Remediation Core Engine"
    );

    // 3. Initialize SQLite WAL Store
    let store = IncidentStore::new(&config.db_path)?;
    info!("SQLite incident store initialized (WAL mode active)");

    // 4. Initialize OPA Policy Engine
    let policy = PolicyEngine::new(config.opa_url.clone());

    // 5. Initialize K8s Executor
    let executor = RemediationExecutor::new(config.kubeconfig.clone(), config.dry_run).await;

    // 6. Initialize LLM Analyzer
    let llm = LlmAnalyzer::new(
        config.llm_url.clone(),
        config.llm_api_key.clone(),
        config.llm_model.clone(),
        config.force_fallback,
    );

    // 7. Initialize Watchdog (Leader Election / Heartbeat)
    let watchdog = Watchdog::new(node_role, config.peer.clone());
    let watchdog_bg = watchdog.clone();
    tokio::spawn(async move {
        watchdog_bg.start(heartbeat_port).await;
    });

    // 8. Construct Application State
    let app_state = Arc::new(AppState {
        config: config.clone(),
        store,
        policy,
        executor,
        watchdog,
        start_time: Instant::now(),
        llm,
    });

    // 9. Build Axum Webhook & Status Router
    let app = create_app(app_state);

    // 10. Start HTTP Server
    let addr = SocketAddr::from(([0, 0, 0, 0], http_port));
    info!(addr = %addr, "Zervox HTTP Control Plane & Webhook listener ready");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
