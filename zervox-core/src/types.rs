use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Standard Prometheus / Alertmanager Webhook Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertmanagerPayload {
    #[serde(default)]
    pub version: String,
    #[serde(rename = "groupKey", default)]
    pub group_key: String,
    #[serde(rename = "truncatedAlerts", default)]
    pub truncated_alerts: usize,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub receiver: String,
    #[serde(rename = "groupLabels", default)]
    pub group_labels: HashMap<String, String>,
    #[serde(rename = "commonLabels", default)]
    pub common_labels: HashMap<String, String>,
    #[serde(rename = "commonAnnotations", default)]
    pub common_annotations: HashMap<String, String>,
    #[serde(rename = "externalURL", default)]
    pub external_url: String,
    #[serde(default)]
    pub alerts: Vec<AlertItem>,
}

fn default_status() -> String {
    "firing".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AlertItem {
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub labels: HashMap<String, String>,
    #[serde(default)]
    pub annotations: HashMap<String, String>,
    #[serde(rename = "startsAt")]
    pub starts_at: Option<DateTime<Utc>>,
    #[serde(rename = "endsAt")]
    pub ends_at: Option<DateTime<Utc>>,
    #[serde(rename = "generatorURL", default)]
    pub generator_url: String,
    #[serde(default)]
    pub fingerprint: String,
}

impl AlertItem {
    pub fn alertname(&self) -> &str {
        self.labels
            .get("alertname")
            .map(|s| s.as_str())
            .unwrap_or("UnknownAlert")
    }

    pub fn namespace(&self) -> &str {
        self.labels
            .get("namespace")
            .or_else(|| self.labels.get("kubernetes_namespace"))
            .map(|s| s.as_str())
            .unwrap_or("default")
    }

    pub fn pod_name(&self) -> Option<&str> {
        self.labels
            .get("pod")
            .or_else(|| self.labels.get("pod_name"))
            .or_else(|| self.labels.get("instance"))
            .map(|s| s.as_str())
    }

    pub fn deployment_name(&self) -> Option<&str> {
        self.labels
            .get("deployment")
            .or_else(|| self.labels.get("app"))
            .or_else(|| self.labels.get("service"))
            .map(|s| s.as_str())
    }

    pub fn node_name(&self) -> Option<&str> {
        self.labels
            .get("node")
            .or_else(|| self.labels.get("instance"))
            .map(|s| s.as_str())
    }

    pub fn severity(&self) -> &str {
        self.labels
            .get("severity")
            .map(|s| s.as_str())
            .unwrap_or("warning")
    }

    pub fn summary(&self) -> String {
        if let Some(desc) = self.annotations.get("summary").or_else(|| self.annotations.get("description")) {
            desc.clone()
        } else {
            format!("Alert {} on namespace {}", self.alertname(), self.namespace())
        }
    }

    pub fn matches(&self, pattern: &str) -> bool {
        let name = self.alertname();
        if name.eq_ignore_ascii_case(pattern) {
            return true;
        }
        if name.to_lowercase().contains(&pattern.to_lowercase()) {
            return true;
        }
        if let Some(summary) = self.annotations.get("summary") {
            if summary.to_lowercase().contains(&pattern.to_lowercase()) {
                return true;
            }
        }
        false
    }
}

/// Operational engine mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EngineMode {
    Ai,
    Fallback,
}

impl std::fmt::Display for EngineMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EngineMode::Ai => write!(f, "ai"),
            EngineMode::Fallback => write!(f, "fallback"),
        }
    }
}

/// Structural remediation actions supported by Zervox
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RemediationAction {
    RestartPod {
        namespace: String,
        pod_name: String,
    },
    ScaleDeployment {
        namespace: String,
        deployment_name: String,
        target_replicas: i32,
    },
    CordonNode {
        node_name: String,
    },
    NoAction {
        reason: String,
    },
    /// Special action used to test OPA security gating during simulated attacks
    DangerousActionAttempt {
        action: String,
        resource: String,
        target_name: String,
        namespace: String,
        target_replicas: Option<i32>,
        command: Option<Vec<String>>,
    },
}

impl RemediationAction {
    pub fn action_type(&self) -> &'static str {
        match self {
            RemediationAction::RestartPod { .. } => "restart_pod",
            RemediationAction::ScaleDeployment { .. } => "scale",
            RemediationAction::CordonNode { .. } => "cordon",
            RemediationAction::NoAction { .. } => "no_action",
            RemediationAction::DangerousActionAttempt { .. } => "dangerous_action",
        }
    }

    pub fn target_resource(&self) -> String {
        match self {
            RemediationAction::RestartPod { namespace, pod_name } => {
                format!("pod/{}/{}", namespace, pod_name)
            }
            RemediationAction::ScaleDeployment { namespace, deployment_name, target_replicas } => {
                format!("deployment/{}/{} -> {} replicas", namespace, deployment_name, target_replicas)
            }
            RemediationAction::CordonNode { node_name } => format!("node/{}", node_name),
            RemediationAction::NoAction { reason } => format!("none ({})", reason),
            RemediationAction::DangerousActionAttempt { resource, target_name, namespace, .. } => {
                format!("{}/{}/{}", resource, namespace, target_name)
            }
        }
    }
}

/// Decision made by AI or Fallback engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Decision {
    pub incident_id: String,
    pub mode: EngineMode,
    pub root_cause: String,
    pub action: RemediationAction,
    pub confidence: f32,
    pub reasoning: String,
}

/// OPA Policy Evaluation Input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyInput {
    pub action: String,
    pub resource: String,
    pub name: String,
    pub namespace: String,
    pub target_replicas: Option<i32>,
    pub command: Option<Vec<String>>,
}

/// Result of evaluating an action against OPA / Rego policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyDecision {
    pub allowed: bool,
    pub violations: Vec<String>,
    pub policy_source: String,
}

/// Persistent Incident Record stored in SQLite WAL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncidentRecord {
    pub id: String,
    pub alert_name: String,
    pub severity: String,
    pub mode: String,
    pub root_cause: String,
    pub action_type: String,
    pub target_resource: String,
    pub policy_allowed: bool,
    pub policy_violations: Option<String>,
    pub execution_status: String,
    pub execution_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Instance role in high-availability topology
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeRole {
    Primary,
    Backup,
}

impl std::fmt::Display for NodeRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NodeRole::Primary => write!(f, "primary"),
            NodeRole::Backup => write!(f, "backup"),
        }
    }
}

/// Cluster execution state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClusterState {
    Active,
    Standby,
}

impl std::fmt::Display for ClusterState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClusterState::Active => write!(f, "active"),
            ClusterState::Standby => write!(f, "standby"),
        }
    }
}

/// System Status for `/status` and `/api/status`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    pub service: String,
    pub version: String,
    pub role: NodeRole,
    pub state: ClusterState,
    pub engine_mode: EngineMode,
    pub uptime_seconds: u64,
    pub peer_address: Option<String>,
    pub peer_status: String,
    pub opa_status: String,
    pub k8s_status: String,
    pub total_incidents: usize,
    pub recent_incidents: Vec<IncidentRecord>,
}
