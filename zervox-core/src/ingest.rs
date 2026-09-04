use crate::status::AppState;
use crate::types::{AlertItem, AlertmanagerPayload, Decision, IncidentRecord, RemediationAction};
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::{error, info, warn};

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessAlertResult {
    pub incident_id: String,
    pub alert_name: String,
    pub mode: String,
    pub root_cause: String,
    pub action: String,
    pub policy_allowed: bool,
    pub policy_violations: Vec<String>,
    pub execution_status: String,
    pub execution_output: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence_hash: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SimulateAttackRequest {
    pub attack_type: String, // e.g. "delete_namespace", "shell_exec", "scale_excessive"
    #[serde(default = "default_target_namespace")]
    pub namespace: String,
    #[serde(default = "default_target_name")]
    pub target_name: String,
}

fn default_target_namespace() -> String {
    "default".to_string()
}
fn default_target_name() -> String {
    "victim-api".to_string()
}

pub async fn handle_grafana_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<AlertmanagerPayload>,
) -> impl IntoResponse {
    // 1. Verify Authentication (x-api-key or Bearer token)
    let auth_valid = if let Some(key) = headers.get("x-api-key") {
        key.to_str().unwrap_or_default() == state.config.api_key
    } else if let Some(auth_header) = headers.get("authorization") {
        let auth_str = auth_header.to_str().unwrap_or_default();
        if let Some(token) = auth_str.strip_prefix("Bearer ") {
            token == state.config.api_key
        } else {
            false
        }
    } else {
        false
    };

    if !auth_valid {
        warn!("Unauthorized webhook attempt rejected");
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "Unauthorized",
                "message": "Missing or invalid x-api-key or Authorization Bearer header"
            })),
        );
    }

    // 2. Verify Instance Active/Standby State
    // Note: The Axum server is now completely dormant on backup nodes.
    // If this webhook receives traffic, it is guaranteed to be the active primary leader.

    info!(
        alerts_count = payload.alerts.len(),
        status = %payload.status,
        "Processing incoming Alertmanager webhook"
    );

    let mut results = Vec::new();

    for alert in &payload.alerts {
        if alert.status.eq_ignore_ascii_case("resolved") {
            info!(alert = alert.alertname(), "Ignoring resolved alert");
            continue;
        }

        let result = process_single_alert(&state, alert).await;
        results.push(result);
    }

    (
        StatusCode::OK,
        Json(json!({
            "status": "processed",
            "results": results
        })),
    )
}

async fn process_single_alert(state: &Arc<AppState>, alert: &AlertItem) -> ProcessAlertResult {
    let alert_name = alert.alertname().to_string();
    let severity = alert.severity().to_string();

    // 1. Root Cause Analysis & Decision (LLM with automatic fallback trigger)
    let decision: Decision = state.llm.analyze(alert).await;
    let incident_id = decision.incident_id.clone();
    let mode_str = decision.mode.to_string();

    // 2. Initial database record creation
    let mut record = IncidentRecord {
        id: incident_id.clone(),
        alert_name: alert_name.clone(),
        severity,
        mode: mode_str.clone(),
        root_cause: decision.root_cause.clone(),
        action_type: decision.action.action_type().to_string(),
        target_resource: decision.action.target_resource(),
        policy_allowed: false,
        policy_violations: None,
        execution_status: "evaluating_policy".to_string(),
        execution_error: None,
        forensic_snapshot_id: None,
        evidence_hash: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    if let Err(err) = state.store.insert_incident(&record).await {
        error!(incident_id = %incident_id, error = %err, "Failed to persist initial incident record");
    }

    // 3. Unbypassable OPA Policy Gate
    let policy_decision = state.policy.evaluate(&decision.action).await;
    record.policy_allowed = policy_decision.allowed;
    record.policy_violations = if policy_decision.violations.is_empty() {
        None
    } else {
        Some(policy_decision.violations.join(" | "))
    };

    let (execution_status, execution_output) = if policy_decision.allowed {
        // Innovation 1: Forensic Freeze (Pre-Remediation Evidence Preservation)
        // Before executing pod deletion/restart, capture volatile logs & state into isolated tamper-evident vault
        if let RemediationAction::RestartPod { namespace, pod_name } = &decision.action {
            match state.executor.capture_forensic_snapshot(&incident_id, namespace, pod_name).await {
                Ok(snapshot) => {
                    info!(
                        incident_id = %incident_id,
                        snapshot_id = %snapshot.id,
                        sha256 = %snapshot.sha256_hash,
                        "[FORENSIC FREEZE] Evidence snapshot captured and hashed before pod destruction"
                    );
                    record.forensic_snapshot_id = Some(snapshot.id.clone());
                    record.evidence_hash = Some(snapshot.sha256_hash.clone());
                    if let Err(e) = state.store.save_forensic_snapshot(&snapshot).await {
                        error!(error = %e, "Failed to persist forensic snapshot to SQLite vault");
                    }
                }
                Err(e) => {
                    warn!(error = %e, "Failed to capture forensic snapshot before pod deletion");
                }
            }
        }

        // 4. Execution via K8s Executor with Closed-Loop Verification & Automated Escalation
        match state
            .executor
            .execute_with_verification(&decision.action, std::time::Duration::from_secs(5))
            .await
        {
            Ok((output, verif, escalated)) => {
                let final_output = if let Some(esc) = escalated {
                    format!(
                        "{} [AUTOMATED ESCALATION: {} | verified={}]",
                        output,
                        esc.target_resource(),
                        verif.success
                    )
                } else {
                    format!(
                        "{} [Closed-loop verified: {} ({} attempts)]",
                        output, verif.success, verif.attempts
                    )
                };
                info!(
                    incident_id = %incident_id,
                    output = %final_output,
                    verified = verif.success,
                    "Remediation action executed and verified"
                );
                ("resolved".to_string(), Some(final_output))
            }
            Err(err) => {
                error!(
                    incident_id = %incident_id,
                    error = %err,
                    "Remediation execution failed"
                );
                ("failed".to_string(), Some(err.to_string()))
            }
        }
    } else {
        // Policy Gate BLOCKED the action
        warn!(
            incident_id = %incident_id,
            action = decision.action.action_type(),
            violations = ?policy_decision.violations,
            "CRITICAL: Remediation blocked by OPA security policy gate"
        );
        (
            "blocked_by_policy".to_string(),
            Some(format!(
                "Blocked by Policy: {}",
                policy_decision.violations.join(", ")
            )),
        )
    };

    // 5. Update SQLite Record with final result
    let exec_err = if execution_status == "failed" {
        execution_output.as_deref()
    } else {
        None
    };

    if let Err(err) = state
        .store
        .update_execution_status(
            &incident_id,
            &execution_status,
            exec_err,
            Some(record.policy_allowed),
            record.policy_violations.as_deref(),
            record.forensic_snapshot_id.as_deref(),
        )
        .await
    {
        error!(incident_id = %incident_id, error = %err, "Failed to update incident in store");
    }

    ProcessAlertResult {
        incident_id,
        alert_name,
        mode: mode_str,
        root_cause: decision.root_cause,
        action: decision.action.target_resource(),
        policy_allowed: policy_decision.allowed,
        policy_violations: policy_decision.violations,
        execution_status,
        execution_output,
        evidence_hash: record.evidence_hash,
    }
}

pub async fn simulate_attack(
    State(state): State<Arc<AppState>>,
    Json(req): Json<SimulateAttackRequest>,
) -> impl IntoResponse {
    let incident_id = format!("attack-sim-{}", uuid::Uuid::new_v4().simple());
    info!(attack_type = %req.attack_type, "Simulating attack vector for OPA verification demo");

    let action = match req.attack_type.as_str() {
        "delete_namespace" => RemediationAction::DangerousActionAttempt {
            action: "delete".to_string(),
            resource: "namespace".to_string(),
            target_name: req.namespace.clone(),
            namespace: req.namespace.clone(),
            target_replicas: None,
            command: None,
        },
        "shell_exec" => RemediationAction::DangerousActionAttempt {
            action: "exec".to_string(),
            resource: "pod".to_string(),
            target_name: req.target_name.clone(),
            namespace: req.namespace.clone(),
            target_replicas: None,
            command: Some(vec!["/bin/bash".to_string()]),
        },
        "scale_excessive" => RemediationAction::DangerousActionAttempt {
            action: "scale".to_string(),
            resource: "deployment".to_string(),
            target_name: req.target_name.clone(),
            namespace: req.namespace.clone(),
            target_replicas: Some(50), // exceeds cap of 10
            command: None,
        },
        _ => RemediationAction::DangerousActionAttempt {
            action: "unknown".to_string(),
            resource: "unknown".to_string(),
            target_name: req.target_name.clone(),
            namespace: req.namespace.clone(),
            target_replicas: None,
            command: None,
        },
    };

    let policy_decision = state.policy.evaluate(&action).await;

    let record = IncidentRecord {
        id: incident_id.clone(),
        alert_name: format!("SimulatedAttack:{}", req.attack_type),
        severity: "critical".to_string(),
        mode: "simulation".to_string(),
        root_cause: format!("Simulated malicious payload: {}", req.attack_type),
        action_type: action.action_type().to_string(),
        target_resource: action.target_resource(),
        policy_allowed: policy_decision.allowed,
        policy_violations: Some(policy_decision.violations.join(" | ")),
        execution_status: if policy_decision.allowed {
            "allowed".to_string()
        } else {
            "blocked_by_policy".to_string()
        },
        execution_error: None,
        forensic_snapshot_id: None,
        evidence_hash: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let _ = state.store.insert_incident(&record).await;

    (
        StatusCode::OK,
        Json(json!({
            "incident_id": incident_id,
            "attack_type": req.attack_type,
            "policy_allowed": policy_decision.allowed,
            "policy_violations": policy_decision.violations,
            "blocked": !policy_decision.allowed,
            "status": if policy_decision.allowed { "DANGEROUS_ACTION_ALLOWED" } else { "ATTACK_SUCCESSFULLY_BLOCKED_BY_OPA" }
        })),
    )
}

/// Kubernetes Audit Webhook ingestion endpoint (`POST /api/v1/audit`)
pub async fn handle_audit_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<crate::threat::KubeAuditPayload>,
) -> impl IntoResponse {
    // Verify optional authentication if provided
    if let Some(key) = headers.get("x-api-key") {
        if key.to_str().unwrap_or_default() != state.config.api_key {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({
                    "error": "Unauthorized",
                    "message": "Invalid x-api-key"
                })),
            );
        }
    } else if let Some(auth_header) = headers.get("authorization") {
        let auth_str = auth_header.to_str().unwrap_or_default();
        if let Some(token) = auth_str.strip_prefix("Bearer ") {
            if token != state.config.api_key {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(json!({
                        "error": "Unauthorized",
                        "message": "Invalid Authorization Bearer token"
                    })),
                );
            }
        }
    }

    let events = payload.into_events();
    let events_count = events.len();
    info!(events_count, "Processing Kubernetes Audit Webhook batch");

    let mut all_detections = Vec::new();

    for event in &events {
        let detections = crate::threat::ThreatSignatureMatcher::evaluate(event);
        all_detections.extend(detections);
    }

    let threats_count = all_detections.len();
    info!(events_count, threats_count, "Completed Kubernetes audit log signature analysis");

    // Pass detections through the Stateful Correlation Engine (sliding window & scoring matrix)
    let correlated_incidents = state.correlation.ingest(&all_detections).await;
    let correlated_count = correlated_incidents.len();

    // Persist any escalated incidents (tier >= MEDIUM) into the Incident Store and execute closed-loop remediation
    for incident in &correlated_incidents {
        let (exec_status, exec_output) = if incident.tier.should_remediate() {
            let policy_decision = state.policy.evaluate(&incident.recommended_action).await;
            if policy_decision.allowed {
                match state
                    .executor
                    .execute_with_verification(
                        &incident.recommended_action,
                        std::time::Duration::from_secs(5),
                    )
                    .await
                {
                    Ok((output, verif, escalated)) => {
                        let final_msg = if let Some(esc) = escalated {
                            format!(
                                "{} [AUTOMATED ESCALATION: {} | verified={}]",
                                output,
                                esc.target_resource(),
                                verif.success
                            )
                        } else {
                            format!(
                                "{} [Closed-loop verified: {} ({} attempts)]",
                                output, verif.success, verif.attempts
                            )
                        };
                        ("resolved".to_string(), Some(final_msg))
                    }
                    Err(e) => ("failed".to_string(), Some(e.to_string())),
                }
            } else {
                (
                    "blocked_by_policy".to_string(),
                    Some(policy_decision.violations.join(", ")),
                )
            }
        } else {
            (
                "observed".to_string(),
                Some("Threat score within baseline tolerance; trace preserved.".to_string()),
            )
        };

        let record = crate::types::IncidentRecord {
            id: incident.incident_id.clone(),
            alert_name: format!("Threat_{}", incident.primary_signature),
            severity: incident.tier.to_string(),
            mode: "ai_correlated".to_string(),
            root_cause: incident.summary.clone(),
            action_type: incident.recommended_action.action_type().to_string(),
            target_resource: incident.recommended_action.target_resource(),
            policy_allowed: true,
            policy_violations: None,
            execution_status: exec_status,
            execution_error: exec_output,
            forensic_snapshot_id: None,
            evidence_hash: None,
            created_at: incident.window_end,
            updated_at: incident.window_end,
        };

        if let Err(e) = state.store.insert_incident(&record).await {
            error!(incident_id = %incident.incident_id, error = %e, "Failed to persist correlated incident");
        }
    }

    (
        StatusCode::OK,
        Json(json!({
            "status": "processed",
            "events_received": events_count,
            "threats_detected": threats_count,
            "detections": all_detections,
            "correlated_incidents": correlated_incidents,
            "escalated_count": correlated_count,
        })),
    )
}
