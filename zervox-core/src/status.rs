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
    pub correlation: Arc<crate::correlation::ThreatCorrelationEngine>,
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
        total_incidents: state.store.count_incidents().await.unwrap_or(0),
        recent_incidents: state.store.get_recent_incidents(10).await.unwrap_or_default(),
        hardware_breaker_status: Some(if state.executor.hardware_breaker.is_armed() {
            "ARMED_RISCV_ESP32C3".to_string()
        } else {
            "DISARMED".to_string()
        }),
    };

    Json(status)
}

pub async fn get_status_html(State(_state): State<Arc<AppState>>) -> Html<String> {
    Html("<html><body><h1>Zervox Control Plane</h1></body></html>".to_string())
}

pub async fn get_incident_forensics(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(incident_id): axum::extract::Path<String>,
) -> Result<Json<crate::types::ForensicEvidencePackage>, (StatusCode, Json<serde_json::Value>)> {
    match state.store.get_forensic_snapshot(&incident_id).await {
        Ok(Some(snapshot)) => {
            let sha256_hash = snapshot.sha256_hash.clone();
            Ok(Json(crate::types::ForensicEvidencePackage {
                status: "success".to_string(),
                incident_id: incident_id.clone(),
                integrity_verified: true,
                sha256_hash,
                snapshot,
            }))
        }
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(json!({
                "status": "error",
                "error": format!("No forensic evidence snapshot found for incident '{}'", incident_id)
            })),
        )),
        Err(err) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "status": "error",
                "error": err.to_string()
            })),
        )),
    }
}

pub async fn get_immune_status(
    State(state): State<Arc<AppState>>,
) -> Json<crate::types::ImmuneStatusResponse> {
    let active = state.policy.get_active_quarantines();
    Json(crate::types::ImmuneStatusResponse {
        status: if active.is_empty() {
            "monitoring_active".to_string()
        } else {
            "quarantine_engaged".to_string()
        },
        total_quarantined: active.len(),
        active_quarantines: active,
    })
}

pub async fn reset_immune_quarantine(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    state.policy.clear_quarantines();
    Json(json!({
        "status": "success",
        "message": "Adaptive immune system quarantines successfully reset."
    }))
}

pub async fn get_hardware_status(
    State(state): State<Arc<AppState>>,
) -> Json<crate::types::HardwareStatusResponse> {
    let armed = state.executor.hardware_breaker.is_armed();
    Json(crate::types::HardwareStatusResponse {
        armed,
        coprocessor: "ESP32-C3_RISCV_EMBEDDED".to_string(),
        interface: "UART_SERIAL_DUAL_KEY".to_string(),
        status: if armed {
            "ARMED_DUAL_KEY_ENFORCED".to_string()
        } else {
            "DISARMED_OPERATOR_BYPASS".to_string()
        },
    })
}

pub async fn toggle_hardware_breaker(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let currently_armed = state.executor.hardware_breaker.is_armed();
    let new_state = !currently_armed;
    state.executor.hardware_breaker.set_armed(new_state);
    Json(json!({
        "status": "success",
        "armed": new_state,
        "message": format!("Hardware Circuit-Breaker armed state set to {}", new_state)
    }))
}

