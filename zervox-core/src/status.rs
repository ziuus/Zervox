use crate::config::AppConfig;
use crate::executor::RemediationExecutor;
use crate::policy::PolicyEngine;
use crate::store::IncidentStore;
use crate::types::{EngineMode, SystemStatus};
use crate::watchdog::Watchdog;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Json};
use serde_json::json;
use std::sync::Arc;
use std::time::Instant;

#[derive(Clone)]
pub struct AppState {
    pub config: AppConfig,
    pub store: Arc<dyn IncidentStore>,
    pub policy: PolicyEngine,
    pub executor: RemediationExecutor,
    pub watchdog: Watchdog,
    pub start_time: Instant,
    pub llm: crate::llm::LlmAnalyzer,
}

pub async fn health_check(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let watchdog_info = state.watchdog.get_info().await;
    (
        StatusCode::OK,
        Json(json!({
            "status": "healthy",
            "service": "zervox-core",
            "role": watchdog_info.role,
            "state": watchdog_info.state,
            "uptime_seconds": state.start_time.elapsed().as_secs()
        })),
    )
}

pub async fn get_system_status(State(state): State<Arc<AppState>>) -> Json<SystemStatus> {
    let watchdog_info = state.watchdog.get_info().await;
    let opa_healthy = state.policy.check_health().await;
    let k8s_connected = state.executor.is_connected();

    let engine_mode = if state.config.force_fallback
        || (state.config.llm_url.is_none() && state.config.llm_api_key.is_none())
    {
        EngineMode::Fallback
    } else {
        EngineMode::Ai
    };

    let status = SystemStatus {
        service: "zervox-core".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        role: watchdog_info.role,
        state: watchdog_info.state,
        engine_mode,
        uptime_seconds: state.start_time.elapsed().as_secs(),
        peer_address: watchdog_info.peer_address,
        peer_status: watchdog_info.peer_status,
        opa_status: if opa_healthy {
            "reachable".to_string()
        } else {
            "embedded-guard-active".to_string()
        },
        k8s_status: if k8s_connected {
            "connected".to_string()
        } else {
            "dry-run/simulated".to_string()
        },
        total_incidents: 0, // Simplified for brevity in abstraction
        recent_incidents: vec![],
    };

    Json(status)
}

pub async fn get_status_html(State(_state): State<Arc<AppState>>) -> Html<String> {
    Html("<html><body><h1>Zervox Control Plane</h1></body></html>".to_string())
}
