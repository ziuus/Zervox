use crate::types::{PolicyDecision, PolicyInput, QuarantineRecord, RemediationAction};
use anyhow::Result;
use chrono::{Duration as ChronoDuration, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tracing::{info, warn};

#[derive(Clone)]
pub struct PolicyEngine {
    opa_url: String,
    client: Client,
    quarantine_table: Arc<Mutex<HashMap<String, QuarantineRecord>>>,
}

#[derive(Serialize)]
struct OpaRequest {
    input: PolicyInput,
}

#[derive(Deserialize)]
struct OpaResponse {
    result: Option<OpaResult>,
}

#[derive(Deserialize)]
struct OpaResult {
    #[serde(default)]
    allow: bool,
    #[serde(default)]
    deny: Vec<String>,
}

impl PolicyEngine {
    pub fn new(opa_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .unwrap_or_default();

        Self {
            opa_url,
            client,
            quarantine_table: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Convert domain RemediationAction into standardized PolicyInput
    pub fn build_policy_input(action: &RemediationAction) -> PolicyInput {
        match action {
            RemediationAction::RestartPod {
                namespace,
                pod_name,
            } => PolicyInput {
                action: "restart_pod".to_string(),
                resource: "pod".to_string(),
                name: pod_name.clone(),
                namespace: namespace.clone(),
                target_replicas: None,
                command: None,
            },
            RemediationAction::ScaleDeployment {
                namespace,
                deployment_name,
                target_replicas,
            } => PolicyInput {
                action: "scale".to_string(),
                resource: "deployment".to_string(),
                name: deployment_name.clone(),
                namespace: namespace.clone(),
                target_replicas: Some(*target_replicas),
                command: None,
            },
            RemediationAction::CordonNode { node_name } => PolicyInput {
                action: "cordon".to_string(),
                resource: "node".to_string(),
                name: node_name.clone(),
                namespace: String::new(),
                target_replicas: None,
                command: None,
            },
            RemediationAction::NoAction { .. } => PolicyInput {
                action: "no_action".to_string(),
                resource: "none".to_string(),
                name: String::new(),
                namespace: String::new(),
                target_replicas: None,
                command: None,
            },
            RemediationAction::DangerousActionAttempt {
                action,
                resource,
                target_name,
                namespace,
                target_replicas,
                command,
            } => PolicyInput {
                action: action.clone(),
                resource: resource.clone(),
                name: target_name.clone(),
                namespace: namespace.clone(),
                target_replicas: *target_replicas,
                command: command.clone(),
            },
        }
    }

    /// Check if target workload or namespace is under dynamic quarantine
    pub fn is_quarantined(&self, name: &str, namespace: &str) -> Option<QuarantineRecord> {
        let table = self.quarantine_table.lock().unwrap();
        let now = Utc::now();

        // Check exact pod/resource name
        if let Some(record) = table.get(name) {
            if record.quarantined_until > now {
                return Some(record.clone());
            }
        }
        // Check namespace
        if !namespace.is_empty() {
            if let Some(record) = table.get(namespace) {
                if record.quarantined_until > now {
                    return Some(record.clone());
                }
            }
        }
        None
    }

    /// Register a policy violation and adaptively enforce dynamic quarantine if repeated
    pub fn register_violation(&self, target: &str, reason: &str) -> Option<QuarantineRecord> {
        if target.is_empty() {
            return None;
        }

        let mut table = self.quarantine_table.lock().unwrap();
        let now = Utc::now();

        let entry = table.entry(target.to_string()).or_insert_with(|| QuarantineRecord {
            target: target.to_string(),
            violation_count: 0,
            quarantined_until: now,
            reason: reason.to_string(),
        });

        entry.violation_count += 1;
        entry.reason = reason.to_string();

        // Threshold: 2 or more policy attacks triggers immediate 30-minute adaptive quarantine
        if entry.violation_count >= 2 {
            entry.quarantined_until = now + ChronoDuration::minutes(30);
            warn!(
                target = %target,
                violations = entry.violation_count,
                quarantined_until = %entry.quarantined_until,
                "[ADAPTIVE IMMUNE SYSTEM] Workload adaptively placed under 30-minute lockdown due to repeated attack vectors"
            );
            return Some(entry.clone());
        }

        None
    }

    pub fn get_active_quarantines(&self) -> Vec<QuarantineRecord> {
        let table = self.quarantine_table.lock().unwrap();
        let now = Utc::now();
        table
            .values()
            .filter(|v| v.quarantined_until > now)
            .cloned()
            .collect()
    }

    pub fn clear_quarantines(&self) {
        let mut table = self.quarantine_table.lock().unwrap();
        table.clear();
    }

    /// Evaluates the action against OPA Server if reachable, falling back to strict embedded policy guard.
    pub async fn evaluate(&self, action: &RemediationAction) -> PolicyDecision {
        let input = Self::build_policy_input(action);

        // 1. Adaptive Immune System: Pre-evaluation quarantine check
        if let Some(quarantine) = self.is_quarantined(&input.name, &input.namespace) {
            warn!(
                target = %quarantine.target,
                until = %quarantine.quarantined_until,
                violations = quarantine.violation_count,
                "[ADAPTIVE IMMUNE SYSTEM] Pre-emptively blocking action on quarantined workload"
            );
            return PolicyDecision {
                allowed: false,
                violations: vec![format!(
                    "ADAPTIVE IMMUNE SYSTEM QUARANTINE: Target '{}' is temporarily locked down until {} due to repeated attack violations ({} attempts logged).",
                    quarantine.target,
                    quarantine.quarantined_until.to_rfc3339(),
                    quarantine.violation_count
                )],
                policy_source: "adaptive-immune-guard".to_string(),
            };
        }

        // 2. Attempt remote OPA server evaluation first
        let decision = match self.query_opa_server(&input).await {
            Ok(decision) => {
                info!(
                    allowed = decision.allowed,
                    violations = ?decision.violations,
                    source = "opa-server",
                    "OPA policy evaluated via server"
                );
                decision
            }
            Err(err) => {
                warn!(
                    error = %err,
                    "OPA server unavailable; applying strict local embedded Rego policy guard"
                );
                self.evaluate_embedded(&input)
            }
        };

        // 3. If policy was denied, register violation for adaptive immune tightening
        if !decision.allowed {
            let target = if !input.name.is_empty() {
                &input.name
            } else {
                &input.namespace
            };
            self.register_violation(target, &decision.violations.join(" | "));
        }

        decision
    }

    async fn query_opa_server(&self, input: &PolicyInput) -> Result<PolicyDecision> {
        let req_body = OpaRequest {
            input: input.clone(),
        };

        let res = self
            .client
            .post(&self.opa_url)
            .json(&req_body)
            .send()
            .await?;

        if !res.status().is_success() {
            anyhow::bail!("OPA server returned status {}", res.status());
        }

        let resp: OpaResponse = res.json().await?;
        if let Some(result) = resp.result {
            Ok(PolicyDecision {
                allowed: result.allow && result.deny.is_empty(),
                violations: result.deny,
                policy_source: "opa-server".to_string(),
            })
        } else {
            // Default fail-closed if no result returned
            Ok(PolicyDecision {
                allowed: false,
                violations: vec!["OPA returned null authorization result".to_string()],
                policy_source: "opa-server".to_string(),
            })
        }
    }

    /// Embedded safety guard implementing the identical Rego invariant rules
    pub fn evaluate_embedded(&self, input: &PolicyInput) -> PolicyDecision {
        let mut violations = Vec::new();

        // Deny rule 1: Namespace deletion
        if input.action == "delete" && input.resource == "namespace" {
            violations.push(
                "CRITICAL: Namespace deletion is absolutely prohibited during autonomous execution."
                    .to_string(),
            );
        }

        // Deny rule 2: Container shell execution
        if input.action == "exec" {
            violations.push("CRITICAL: Container shell execution is blocked.".to_string());
        }
        if let Some(cmd) = &input.command {
            if cmd
                .iter()
                .any(|c| c == "exec" || c.contains("sh") || c.contains("bash"))
            {
                violations.push("CRITICAL: Container shell execution is blocked.".to_string());
            }
        }

        // Deny rule 3: Replica cap exceeded (> 10)
        if input.action == "scale" {
            if let Some(replicas) = input.target_replicas {
                if replicas > 10 {
                    violations.push(format!(
                        "CRITICAL: Replica cap exceeded (requested {}, max allowed is 10).",
                        replicas
                    ));
                }
                if replicas < 1 {
                    violations.push(
                        "CRITICAL: Autonomous scale down to 0 replicas is prohibited.".to_string(),
                    );
                }
            }
        }

        // Deny rule 4: kube-system modification
        if input.namespace == "kube-system" && input.action != "no_action" {
            violations.push(
                "CRITICAL: Modifications to kube-system namespace are prohibited.".to_string(),
            );
        }

        let is_valid = match input.action.as_str() {
            "restart_pod" => input.resource == "pod" && !input.name.is_empty(),
            "scale" => input.resource == "deployment" && !input.name.is_empty(),
            "cordon" => input.resource == "node" && !input.name.is_empty(),
            "no_action" => true,
            _ => false,
        };

        let allowed = violations.is_empty() && is_valid;

        PolicyDecision {
            allowed,
            violations,
            policy_source: "opa-embedded-guard".to_string(),
        }
    }

    pub async fn check_health(&self) -> bool {
        let test_input = PolicyInput {
            action: "no_action".to_string(),
            resource: "none".to_string(),
            name: String::new(),
            namespace: String::new(),
            target_replicas: None,
            command: None,
        };
        self.query_opa_server(&test_input).await.is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedded_policy_pod_restart_allowed() {
        let engine = PolicyEngine::new("http://127.0.0.1:8181/v1/data/zervox/authz".to_string());
        let action = RemediationAction::RestartPod {
            namespace: "default".to_string(),
            pod_name: "victim-api-123".to_string(),
        };
        let input = PolicyEngine::build_policy_input(&action);
        let decision = engine.evaluate_embedded(&input);
        assert!(decision.allowed);
        assert!(decision.violations.is_empty());
    }

    #[test]
    fn test_embedded_policy_scale_capped() {
        let engine = PolicyEngine::new("http://127.0.0.1:8181/v1/data/zervox/authz".to_string());

        // Scale 4: allowed
        let safe_action = RemediationAction::ScaleDeployment {
            namespace: "default".to_string(),
            deployment_name: "victim-api".to_string(),
            target_replicas: 4,
        };
        let input = PolicyEngine::build_policy_input(&safe_action);
        let decision = engine.evaluate_embedded(&input);
        assert!(decision.allowed);

        // Scale 15: denied
        let unsafe_action = RemediationAction::ScaleDeployment {
            namespace: "default".to_string(),
            deployment_name: "victim-api".to_string(),
            target_replicas: 15,
        };
        let input_unsafe = PolicyEngine::build_policy_input(&unsafe_action);
        let decision_unsafe = engine.evaluate_embedded(&input_unsafe);
        assert!(!decision_unsafe.allowed);
        assert!(decision_unsafe
            .violations
            .iter()
            .any(|v| v.contains("Replica cap exceeded")));
    }

    #[test]
    fn test_embedded_policy_blocks_rbac_namespace_delete() {
        let engine = PolicyEngine::new("http://127.0.0.1:8181/v1/data/zervox/authz".to_string());
        let attack_action = RemediationAction::DangerousActionAttempt {
            action: "delete".to_string(),
            resource: "namespace".to_string(),
            target_name: "default".to_string(),
            namespace: "default".to_string(),
            target_replicas: None,
            command: None,
        };
        let input = PolicyEngine::build_policy_input(&attack_action);
        let decision = engine.evaluate_embedded(&input);
        assert!(!decision.allowed);
        assert!(decision
            .violations
            .iter()
            .any(|v| v.contains("Namespace deletion is absolutely prohibited")));
    }

    #[test]
    fn test_embedded_policy_blocks_shell_exec() {
        let engine = PolicyEngine::new("http://127.0.0.1:8181/v1/data/zervox/authz".to_string());
        let attack_action = RemediationAction::DangerousActionAttempt {
            action: "exec".to_string(),
            resource: "pod".to_string(),
            target_name: "victim-api".to_string(),
            namespace: "default".to_string(),
            target_replicas: None,
            command: Some(vec!["/bin/sh".to_string()]),
        };
        let input = PolicyEngine::build_policy_input(&attack_action);
        let decision = engine.evaluate_embedded(&input);
        assert!(!decision.allowed);
        assert!(decision
            .violations
            .iter()
            .any(|v| v.contains("Container shell execution is blocked")));
    }

    #[tokio::test]
    async fn test_adaptive_immune_quarantine() {
        let engine = PolicyEngine::new("http://127.0.0.1:9999/unreachable".to_string());
        
        let malicious_action = RemediationAction::DangerousActionAttempt {
            action: "exec".to_string(),
            resource: "pod".to_string(),
            target_name: "victim-compromised".to_string(),
            namespace: "default".to_string(),
            target_replicas: None,
            command: Some(vec!["/bin/bash".to_string()]),
        };

        // First attempt: blocked by rule
        let d1 = engine.evaluate(&malicious_action).await;
        assert!(!d1.allowed);

        // Second attempt: threshold met -> enters dynamic adaptive quarantine
        let d2 = engine.evaluate(&malicious_action).await;
        assert!(!d2.allowed);

        // Third attempt (even a safe action on the same target): PRE-EMPTIVELY BLOCKED by adaptive immune lockdown!
        let safe_restart = RemediationAction::RestartPod {
            namespace: "default".to_string(),
            pod_name: "victim-compromised".to_string(),
        };
        let d3 = engine.evaluate(&safe_restart).await;
        assert!(!d3.allowed);
        assert_eq!(d3.policy_source, "adaptive-immune-guard");
        assert!(d3.violations[0].contains("ADAPTIVE IMMUNE SYSTEM QUARANTINE"));
    }
}
