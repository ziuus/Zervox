pub mod config;
pub mod correlation;
pub mod executor;
pub mod fallback;
pub mod hardware_key;
pub mod ingest;
pub mod llm;
pub mod policy;
pub mod status;
pub mod store;
pub mod threat;
pub mod types;
pub mod watchdog;

use axum::http::Method;
use axum::routing::{get, post};
use axum::Router;
use status::{get_status_html, get_system_status, health_check, AppState};
use std::sync::Arc;
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
        // Kubernetes Audit Log Webhook endpoint
        .route("/api/v1/audit", post(ingest::handle_audit_webhook))
        // ── Security demo ───────────────────────────────────────────────────
        .route("/api/simulate_attack", post(ingest::simulate_attack))
        // ── HAC'KP Innovations ──────────────────────────────────────────────
        .route("/api/incidents/{id}/forensics", get(status::get_incident_forensics))
        .route("/api/immune/status", get(status::get_immune_status))
        .route("/api/immune/reset", post(status::reset_immune_quarantine))
        .route("/api/hardware/status", get(status::get_hardware_status))
        .route("/api/hardware/toggle", post(status::toggle_hardware_breaker))
        // ── Middleware ──────────────────────────────────────────────────────
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(app_state)
}

