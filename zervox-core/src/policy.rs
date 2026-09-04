use crate::types::{PolicyDecision, PolicyInput, RemediationAction};
use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{info, warn};

/// OPA policy gate — queries `POST /v1/data/zervox/authz/allow` which returns
/// the raw boolean result directly: `{"result": true}`.
/// Falls closed (deny) on any network failure or unexpected response.
#[derive(Clone)]
pub struct PolicyEngine {
    /// Full URL to the OPA allow endpoint.
    /// e.g. http://localhost:8181/v1/data/zervox/authz/allow
    allow_url: String,
    /// Full URL to the OPA root rule for deny messages.
    /// e.g. http://localhost:8181/v1/data/zervox/authz
    authz_url: String,
    client: Client,
}

// ── OPA HTTP wire types ───────────────────────────────────────────────────────

#[derive(Serialize)]
struct OpaRequest {
    input: PolicyInput,
}

/// Response from `POST /v1/data/zervox/authz/allow` — result is a bare bool
#[derive(Deserialize)]
struct OpaAllowResponse {
    result: Option<bool>,
}

/// Response from `POST /v1/data/zervox/authz` — result has allow + deny fields
#[derive(Deserialize)]
struct OpaFullResponse {
    result: Option<OpaFullResult>,
}

#[derive(Deserialize, Default)]
struct OpaFullResult {
    #[serde(default)]
    #[allow(dead_code)] // Part of OPA wire format; only deny[] is actioned
    allow: bool,
    #[serde(default)]
    deny: Vec<String>,
}

// ─────────────────────────────────────────────────────────────────────────────

impl PolicyEngine {
    pub fn new(opa_base_url: String) -> Self {
        // Accept either the base authz URL or the full allow URL; normalise both
        let (authz_url, allow_url) = if opa_base_url.ends_with("/allow") {
            let base = opa_base_url.trim_end_matches("/allow").to_string();
            (base.clone(), opa_base_url)
        } else {
            let base = opa_base_url.trim_end_matches('/').to_string();
            (base.clone(), format!("{}/allow", base))
        };

        let client = Client::builder()
            .timeout(Duration::from_secs(2))
            .connect_timeout(Duration::from_millis(500))
            .build()
            .unwrap_or_default();

        Self {
            allow_url,
            authz_url,
            client,
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /// Evaluate the action — tries OPA server first, falls back to embedded guard.
    /// NEVER fails open: any error path returns `allowed: false`.
    pub async fn evaluate(&self, action: &RemediationAction) -> PolicyDecision {
        let input = Self::build_policy_input(action);

        match self.query_opa_server(&input).await {
            Ok(decision) => {
                info!(
                    allowed = decision.allowed,
                    violations = ?decision.violations,
                    source = %decision.policy_source,
                    "OPA policy gate evaluated"
                );
                decision
            }
            Err(err) => {
                warn!(
                    error = %err,
                    "OPA server unreachable — applying strict embedded Rego guard"
                );
                self.evaluate_embedded(&input)
            }
        }
    }

    pub async fn check_health(&self) -> bool {
        // Health probe uses /health endpoint on OPA server
        let health_url = self
            .authz_url
            .split("/v1/")
            .next()
            .map(|base| format!("{}/health", base))
            .unwrap_or_else(|| "http://localhost:8181/health".to_string());

        self.client
            .get(&health_url)
            .timeout(Duration::from_secs(1))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    // ── OPA Server Query ─────────────────────────────────────────────────────

    async fn query_opa_server(&self, input: &PolicyInput) -> Result<PolicyDecision> {
        let body = OpaRequest {
            input: input.clone(),
        };

        // ── Step 1: Query the /allow endpoint for the boolean decision ────────
        let allow_resp = self
            .client
            .post(&self.allow_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("OPA /allow request failed: {}", e))?;

        if !allow_resp.status().is_success() {
            anyhow::bail!("OPA /allow returned HTTP {}", allow_resp.status());
        }

        let allow_body: OpaAllowResponse = allow_resp
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse OPA /allow response: {}", e))?;

        let allowed = allow_body.result.unwrap_or(false);

        // ── Step 2: If denied, fetch the deny messages from authz endpoint ────
        let violations = if !allowed {
            match self.fetch_deny_messages(input).await {
                Ok(msgs) => msgs,
                Err(_) => vec!["OPA policy denied the action (deny details unavailable)".to_string()],
            }
        } else {
            vec![]
        };

        Ok(PolicyDecision {
            allowed,
            violations,
            policy_source: "opa-server".to_string(),
        })
    }

    async fn fetch_deny_messages(&self, input: &PolicyInput) -> Result<Vec<String>> {
        let body = OpaRequest {
            input: input.clone(),
        };

        let resp = self
            .client
            .post(&self.authz_url)
            .json(&body)
            .send()
            .await?;

        let full: OpaFullResponse = resp.json().await?;
        Ok(full.result.unwrap_or_default().deny)
    }

    // ── Embedded Rego Guard ───────────────────────────────────────────────────

    /// Structural mirror of `policies/zervox.rego`. Applied when OPA is unreachable.
    /// This is the unbypassable fallback — identical invariants, no external I/O.
    pub fn evaluate_embedded(&self, input: &PolicyInput) -> PolicyDecision {
        let mut violations = Vec::new();

        // deny[msg] { input.action == "delete"; input.resource == "namespace" }
        if input.action == "delete" && input.resource == "namespace" {
            violations.push(
                "CRITICAL: Namespace deletion is absolutely prohibited during autonomous execution."
                    .to_string(),
            );
        }

        // deny[msg] { input.command[_] == "exec" }
        if input.action == "exec" {
            violations.push("CRITICAL: Container shell execution is blocked.".to_string());
        }
        if let Some(cmd) = &input.command {
            if cmd
                .iter()
                .any(|c| c == "exec" || c.contains("sh") || c.contains("bash") || c.contains("python"))
            {
                violations.push("CRITICAL: Container shell execution is blocked.".to_string());
            }
        }

        // deny[msg] { input.action == "scale"; input.target_replicas > 10 }
        if input.action == "scale" {
            match input.target_replicas {
                Some(r) if r > 10 => violations.push(format!(
                    "CRITICAL: Replica cap exceeded (requested {r}, max=10)."
                )),
                Some(r) if r < 1 => violations.push(
                    "CRITICAL: Autonomous scale-to-zero is prohibited.".to_string(),
                ),
                _ => {}
            }
        }

        // Additional: kube-system namespace protection
        if input.namespace == "kube-system" && input.action != "no_action" {
            violations.push(
                "CRITICAL: Modifications to kube-system namespace are prohibited.".to_string(),
            );
        }

        // Action allowlist — only known safe ops pass
        let structurally_valid = match input.action.as_str() {
            "restart_pod" => input.resource == "pod" && !input.name.is_empty(),
            "scale" => input.resource == "deployment" && !input.name.is_empty(),
            "cordon" => input.resource == "node" && !input.name.is_empty(),
            "no_action" => true,
            _ => false,
        };

        if !structurally_valid && violations.is_empty() {
            violations.push(format!(
                "Action '{}' on resource '{}' is not in the approved action allowlist.",
                input.action, input.resource
            ));
        }

        let allowed = violations.is_empty() && structurally_valid;

        PolicyDecision {
            allowed,
            violations,
            policy_source: "opa-embedded-guard".to_string(),
        }
    }

    // ── Input Builder ─────────────────────────────────────────────────────────

    pub fn build_policy_input(action: &RemediationAction) -> PolicyInput {
        match action {
            RemediationAction::RestartPod { namespace, pod_name } => PolicyInput {
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
}

#[cfg(test)]
mod tests {
    use super::*;

    fn engine() -> PolicyEngine {
        PolicyEngine::new("http://127.0.0.1:8181/v1/data/zervox/authz".to_string())
    }

    #[test]
    fn test_allow_pod_restart() {
        let e = engine();
        let input = PolicyEngine::build_policy_input(&RemediationAction::RestartPod {
            namespace: "default".to_string(),
            pod_name: "victim-api-123".to_string(),
        });
        let d = e.evaluate_embedded(&input);
        assert!(d.allowed, "pod restart must be allowed");
        assert!(d.violations.is_empty());
    }

    #[test]
    fn test_deny_namespace_delete() {
        let e = engine();
        let input = PolicyEngine::build_policy_input(&RemediationAction::DangerousActionAttempt {
            action: "delete".to_string(),
            resource: "namespace".to_string(),
            target_name: "default".to_string(),
            namespace: "default".to_string(),
            target_replicas: None,
            command: None,
        });
        let d = e.evaluate_embedded(&input);
        assert!(!d.allowed);
        assert!(d.violations.iter().any(|v| v.contains("Namespace deletion")));
    }

    #[test]
    fn test_deny_shell_exec() {
        let e = engine();
        let input = PolicyEngine::build_policy_input(&RemediationAction::DangerousActionAttempt {
            action: "exec".to_string(),
            resource: "pod".to_string(),
            target_name: "victim-api".to_string(),
            namespace: "default".to_string(),
            target_replicas: None,
            command: Some(vec!["/bin/bash".to_string()]),
        });
        let d = e.evaluate_embedded(&input);
        assert!(!d.allowed);
        assert!(d.violations.iter().any(|v| v.contains("shell execution")));
    }

    #[test]
    fn test_deny_scale_over_cap() {
        let e = engine();
        let input = PolicyEngine::build_policy_input(&RemediationAction::ScaleDeployment {
            namespace: "default".to_string(),
            deployment_name: "victim-api".to_string(),
            target_replicas: 15,
        });
        let d = e.evaluate_embedded(&input);
        assert!(!d.allowed);
        assert!(d.violations.iter().any(|v| v.contains("Replica cap exceeded")));
    }

    #[test]
    fn test_allow_scale_within_cap() {
        let e = engine();
        let input = PolicyEngine::build_policy_input(&RemediationAction::ScaleDeployment {
            namespace: "default".to_string(),
            deployment_name: "victim-api".to_string(),
            target_replicas: 4,
        });
        let d = e.evaluate_embedded(&input);
        assert!(d.allowed);
    }

    #[test]
    fn test_deny_kube_system_modification() {
        let e = engine();
        let input = PolicyEngine::build_policy_input(&RemediationAction::RestartPod {
            namespace: "kube-system".to_string(),
            pod_name: "coredns-abc".to_string(),
        });
        let d = e.evaluate_embedded(&input);
        assert!(!d.allowed);
        assert!(d.violations.iter().any(|v| v.contains("kube-system")));
    }
}
