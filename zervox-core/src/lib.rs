pub mod config;
pub mod executor;
pub mod fallback;
pub mod ingest;
pub mod llm;
pub mod policy;
pub mod status;
pub mod store;
pub mod types;
pub mod watchdog;

use axum::http::Method;
use axum::routing::{get, post};
use axum::Router;
use std::sync::Arc;
use status::{get_status_html, get_system_status, health_check, AppState};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

pub fn create_app(app_state: Arc<AppState>) -> Router {
    // CORS: allow the Next.js dashboard (any origin in dev, restrict in prod)
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any)
        .allow_origin(Any);

    Router::new()
        // ── Status & health ─────────────────────────────────────────────────
        .route("/", get(get_status_html))
        .route("/status", get(get_status_html))
        .route("/api/status", get(get_system_status))
        .route("/healthz", get(health_check))
        // ── Alert ingestion ─────────────────────────────────────────────────
        // Alertmanager/Grafana webhook format
        .route("/api/grafana_webhook", post(ingest::handle_grafana_webhook))
        // Prometheus native alerting format (same handler — parses both)
        .route("/api/v1/alerts", post(ingest::handle_grafana_webhook))
        // ── Security demo ───────────────────────────────────────────────────
        .route("/api/simulate_attack", post(ingest::simulate_attack))
        // ── Middleware ──────────────────────────────────────────────────────
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(app_state)
}
