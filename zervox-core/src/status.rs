use crate::config::AppConfig;
use crate::executor::RemediationExecutor;
use crate::policy::PolicyEngine;
use crate::store::IncidentStore;
use crate::types::{EngineMode, SystemStatus};
use crate::watchdog::Watchdog;
use axum::extract::State;
use axum::response::{Html, IntoResponse, Json};
use axum::http::StatusCode;
use serde_json::json;
use std::sync::Arc;
use std::time::Instant;

#[derive(Clone)]
pub struct AppState {
    pub config: AppConfig,
    pub store: IncidentStore,
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
    let total_incidents = state.store.count_incidents().unwrap_or(0);
    let recent_incidents = state.store.get_recent_incidents(10).unwrap_or_default();

    let engine_mode = if state.config.force_fallback || (state.config.llm_url.is_none() && state.config.llm_api_key.is_none()) {
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
        opa_status: if opa_healthy { "reachable".to_string() } else { "embedded-guard-active".to_string() },
        k8s_status: if k8s_connected { "connected".to_string() } else { "dry-run/simulated".to_string() },
        total_incidents,
        recent_incidents,
    };

    Json(status)
}

pub async fn get_status_html(State(state): State<Arc<AppState>>) -> Html<String> {
    let status_json = get_system_status(State(state)).await.0;
    
    let role_badge_color = if status_json.role == crate::types::NodeRole::Primary {
        "#10b981" // emerald
    } else {
        "#3b82f6" // blue
    };

    let state_badge_color = if status_json.state == crate::types::ClusterState::Active {
        "#10b981"
    } else {
        "#f59e0b" // amber
    };

    let mut incidents_html = String::new();
    for inc in &status_json.recent_incidents {
        let status_color = match inc.execution_status.as_str() {
            "resolved" => "#10b981",
            "blocked_by_policy" => "#ef4444",
            "failed" => "#dc2626",
            _ => "#6b7280",
        };

        incidents_html.push_str(&format!(
            r#"<tr style="border-bottom: 1px solid #1f2937;">
                <td style="padding: 12px; font-family: monospace; font-size: 13px;">{}</td>
                <td style="padding: 12px; font-weight: 600;">{}</td>
                <td style="padding: 12px;"><span style="background: #374151; padding: 2px 8px; border-radius: 4px; font-size: 12px;">{}</span></td>
                <td style="padding: 12px; font-family: monospace; font-size: 13px;">{}</td>
                <td style="padding: 12px;"><span style="color: {}; font-weight: 600;">● {}</span></td>
                <td style="padding: 12px; color: #9ca3af; font-size: 12px;">{}</td>
            </tr>"#,
            inc.id,
            inc.alert_name,
            inc.mode.to_uppercase(),
            inc.target_resource,
            status_color,
            inc.execution_status,
            inc.created_at.format("%H:%M:%S UTC")
        ));
    }

    if incidents_html.is_empty() {
        incidents_html = r#"<tr><td colspan="6" style="padding: 24px; text-align: center; color: #6b7280;">No incidents recorded yet. Standing by.</td></tr>"#.to_string();
    }

    let html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zervox SRE Control Plane</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }}
        .container {{ max-width: 1100px; margin: 0 auto; }}
        .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 24px; }}
        .title {{ font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }}
        .badge {{ padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 32px; }}
        .card {{ background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 18px; }}
        .card-label {{ font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600; margin-bottom: 6px; }}
        .card-value {{ font-size: 20px; font-weight: 700; }}
        table {{ width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }}
        th {{ background: #0f172a; text-align: left; padding: 12px; font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600; border-bottom: 1px solid #334155; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <div class="title">⚡ ZERVOX SRE ENGINE</div>
                <div style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Autonomous Self-Preserving Incident Remediation</div>
            </div>
            <div style="display: flex; gap: 8px;">
                <span class="badge" style="background: {}; color: #fff;">Role: {}</span>
                <span class="badge" style="background: {}; color: #fff;">State: {}</span>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-label">Engine Mode</div>
                <div class="card-value" style="color: #38bdf8;">{}</div>
            </div>
            <div class="card">
                <div class="card-label">OPA Security Gate</div>
                <div class="card-value" style="color: #4ade80;">{}</div>
            </div>
            <div class="card">
                <div class="card-label">Kubernetes Cluster</div>
                <div class="card-value" style="color: #fbbf24;">{}</div>
            </div>
            <div class="card">
                <div class="card-label">Watchdog Peer Status</div>
                <div class="card-value" style="font-size: 16px; color: #e2e8f0;">{}</div>
            </div>
        </div>

        <h3 style="font-size: 18px; margin-bottom: 12px;">Recent Remediation Timeline</h3>
        <table>
            <thead>
                <tr>
                    <th>Incident ID</th>
                    <th>Alert Name</th>
                    <th>Mode</th>
                    <th>Target Resource</th>
                    <th>Execution Status</th>
                    <th>Time</th>
                </tr>
            </thead>
            <tbody>
                {}
            </tbody>
        </table>
    </div>
</body>
</html>"#,
        role_badge_color,
        status_json.role,
        state_badge_color,
        status_json.state,
        status_json.engine_mode.to_string().to_uppercase(),
        status_json.opa_status,
        status_json.k8s_status,
        status_json.peer_status,
        incidents_html
    );

    Html(html)
}
