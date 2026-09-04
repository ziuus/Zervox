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

use axum::routing::{get, post};
use axum::Router;
use status::{get_status_html, get_system_status, health_check, AppState};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

pub fn create_app(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(get_status_html))
        .route("/status", get(get_status_html))
        .route("/api/status", get(get_system_status))
        .route("/healthz", get(health_check))
        .route("/api/grafana_webhook", post(ingest::handle_grafana_webhook))
        .route("/api/v1/alerts", post(ingest::handle_grafana_webhook))
        .route("/api/simulate_attack", post(ingest::simulate_attack))
        .route("/api/incidents/{id}/forensics", get(status::get_incident_forensics))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(app_state)
}
