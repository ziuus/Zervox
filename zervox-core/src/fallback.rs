use crate::types::{AlertItem, Decision, EngineMode, RemediationAction};
use uuid::Uuid;

/// Evaluates deterministic local rules against an alert without external AI dependency.
pub fn match_rule(alert: &AlertItem) -> Decision {
    let incident_id = format!("inc-{}", Uuid::new_v4().simple());
    let namespace = alert.namespace().to_string();

    // Rule 1: Pod Crash / Unready -> Restart Pod
    if alert.matches("PodCrashLooping")
        || alert.matches("PodNotReady")
        || alert.matches("KubePodCrashLooping")
        || alert.matches("KubePodNotReady")
        || alert.matches("CrashLoopBackOff")
    {
        let pod_name = alert.pod_name().unwrap_or("victim-api").to_string();

        return Decision {
            incident_id,
            mode: EngineMode::Fallback,
            root_cause: format!(
                "Deterministic rule match: {} indicates container failure/unresponsiveness.",
                alert.alertname()
            ),
            action: RemediationAction::RestartPod {
                namespace,
                pod_name,
            },
            confidence: 0.95,
            reasoning: "Local fallback rule: Restart crashing/unready pod to trigger fresh ReplicaSet container recreation.".to_string(),
        };
    }

    // Rule 2: High Latency / High Error Rate / CPU Exhaustion -> Scale Deployment within cap
    if alert.matches("HighLatency")
        || alert.matches("HighErrorRate")
        || alert.matches("HighCpuUsage")
        || alert.matches("KubeDeploymentReplicasMismatch")
    {
        let deployment_name = alert.deployment_name().unwrap_or("victim-api").to_string();

        // Default scale target to 4 replicas (within safe <= 10 limit)
        let target_replicas = 4;

        return Decision {
            incident_id,
            mode: EngineMode::Fallback,
            root_cause: format!(
                "Deterministic rule match: {} indicates traffic/resource saturation.",
                alert.alertname()
            ),
            action: RemediationAction::ScaleDeployment {
                namespace,
                deployment_name,
                target_replicas,
            },
            confidence: 0.90,
            reasoning: format!(
                "Local fallback rule: Increment deployment scale to {} replicas within safety limits.",
                target_replicas
            ),
        };
    }

    // Rule 3: Node Unhealthy -> Cordon Node
    if alert.matches("NodeNotReady")
        || alert.matches("KubeNodeNotReady")
        || alert.matches("NodeDiskPressure")
    {
        let node_name = alert.node_name().unwrap_or("k3s-node-1").to_string();

        return Decision {
            incident_id,
            mode: EngineMode::Fallback,
            root_cause: format!(
                "Deterministic rule match: Node {} is reporting hardware/kernel degradation.",
                node_name
            ),
            action: RemediationAction::CordonNode { node_name },
            confidence: 0.88,
            reasoning:
                "Local fallback rule: Cordon degraded node to prevent further pod scheduling."
                    .to_string(),
        };
    }

    // Rule 4: Unknown Alert -> No Action (Never guess outside known safe actions)
    Decision {
        incident_id,
        mode: EngineMode::Fallback,
        root_cause: format!(
            "Alert '{}' does not match any verified deterministic remediation pattern.",
            alert.alertname()
        ),
        action: RemediationAction::NoAction {
            reason: "No deterministic rule matched; human escalation required.".to_string(),
        },
        confidence: 0.50,
        reasoning: "Local fallback rule: Safeguard engaged, refusing ambiguous action.".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_pod_crash_rule() {
        let mut labels = HashMap::new();
        labels.insert("alertname".to_string(), "PodCrashLooping".to_string());
        labels.insert("namespace".to_string(), "default".to_string());
        labels.insert("pod".to_string(), "victim-api-7b89-xyz".to_string());

        let alert = AlertItem {
            status: "firing".to_string(),
            labels,
            ..Default::default()
        };

        let decision = match_rule(&alert);
        assert_eq!(decision.mode, EngineMode::Fallback);
        match decision.action {
            RemediationAction::RestartPod {
                namespace,
                pod_name,
            } => {
                assert_eq!(namespace, "default");
                assert_eq!(pod_name, "victim-api-7b89-xyz");
            }
            _ => panic!("Expected RestartPod action"),
        }
    }

    #[test]
    fn test_high_latency_rule() {
        let mut labels = HashMap::new();
        labels.insert("alertname".to_string(), "HighLatency".to_string());
        labels.insert("app".to_string(), "victim-api".to_string());

        let alert = AlertItem {
            status: "firing".to_string(),
            labels,
            ..Default::default()
        };

        let decision = match_rule(&alert);
        match decision.action {
            RemediationAction::ScaleDeployment {
                deployment_name,
                target_replicas,
                ..
            } => {
                assert_eq!(deployment_name, "victim-api");
                assert_eq!(target_replicas, 4);
            }
            _ => panic!("Expected ScaleDeployment action"),
        }
    }

    #[test]
    fn test_unknown_alert_rule() {
        let mut labels = HashMap::new();
        labels.insert("alertname".to_string(), "MysteriousAnomaly".to_string());

        let alert = AlertItem {
            status: "firing".to_string(),
            labels,
            ..Default::default()
        };

        let decision = match_rule(&alert);
        match decision.action {
            RemediationAction::NoAction { .. } => {}
            _ => panic!("Expected NoAction for unknown alert"),
        }
    }
}
