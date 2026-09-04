use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

/// Kubernetes Audit Webhook Payload (handles both EventList and single Event)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum KubeAuditPayload {
    EventList {
        #[serde(default)]
        kind: String,
        #[serde(default)]
        items: Vec<KubeAuditEvent>,
    },
    Single(Box<KubeAuditEvent>),
    RawList(Vec<KubeAuditEvent>),
}

impl KubeAuditPayload {
    pub fn into_events(self) -> Vec<KubeAuditEvent> {
        match self {
            KubeAuditPayload::EventList { items, .. } => items,
            KubeAuditPayload::Single(event) => vec![*event],
            KubeAuditPayload::RawList(items) => items,
        }
    }
}

/// Standard Kubernetes Audit Event
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct KubeAuditEvent {
    #[serde(default, rename = "auditID")]
    pub audit_id: String,
    #[serde(default)]
    pub stage: String,
    #[serde(default, rename = "requestURI")]
    pub request_uri: String,
    #[serde(default)]
    pub verb: String,
    #[serde(default)]
    pub user: AuditUser,
    #[serde(default, rename = "sourceIPs")]
    pub source_ips: Vec<String>,
    #[serde(default, rename = "userAgent")]
    pub user_agent: Option<String>,
    #[serde(default, rename = "objectRef")]
    pub object_ref: Option<AuditObjectRef>,
    #[serde(default, rename = "responseStatus")]
    pub response_status: Option<AuditResponseStatus>,
    #[serde(default, rename = "requestObject")]
    pub request_object: Option<serde_json::Value>,
    #[serde(default, rename = "stageTimestamp")]
    pub timestamp: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AuditUser {
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub uid: Option<String>,
    #[serde(default)]
    pub groups: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AuditObjectRef {
    #[serde(default)]
    pub resource: String,
    #[serde(default)]
    pub namespace: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default, rename = "apiGroup")]
    pub api_group: Option<String>,
    #[serde(default, rename = "apiVersion")]
    pub api_version: Option<String>,
    #[serde(default)]
    pub subresource: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AuditResponseStatus {
    #[serde(default)]
    pub code: Option<i32>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
}

/// A classified threat detection extracted from audit telemetry
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ThreatDetection {
    pub signature_id: String,
    pub title: String,
    pub description: String,
    pub base_score: u32,
    pub actor: String,
    pub source_ip: Option<String>,
    pub target_resource: String,
    pub verb: String,
    pub request_uri: String,
    pub timestamp: DateTime<Utc>,
}

/// Signature Engine for Kubernetes Audit Log behavior analysis
pub struct ThreatSignatureMatcher;

impl ThreatSignatureMatcher {
    /// Evaluates an audit event against cyber threat signatures
    pub fn evaluate(event: &KubeAuditEvent) -> Vec<ThreatDetection> {
        let mut detections = Vec::new();
        let actor = if !event.user.username.is_empty() {
            event.user.username.clone()
        } else {
            "system:unknown".to_string()
        };

        let source_ip = event.source_ips.first().cloned();
        let verb = event.verb.to_lowercase();
        let uri = event.request_uri.to_lowercase();
        let now = event.timestamp.unwrap_or_else(Utc::now);

        let (resource, namespace, name) = match &event.object_ref {
            Some(obj) => (
                obj.resource.to_lowercase(),
                obj.namespace.clone().unwrap_or_else(|| "cluster".to_string()),
                obj.name.clone().unwrap_or_else(|| "*".to_string()),
            ),
            None => (String::new(), "cluster".to_string(), "*".to_string()),
        };

        let target_resource = if !resource.is_empty() {
            format!("{}/{}/{}", resource, namespace, name)
        } else {
            uri.clone()
        };

        // 1. Destructive API Activity: Namespace / Node Deletion (+80)
        if (verb == "delete" || verb == "deletecollection")
            && (resource == "namespaces"
                || resource == "nodes"
                || uri.contains("/api/v1/namespaces/")
                || uri.contains("/api/v1/nodes/"))
        {
            warn!(
                actor = %actor,
                target = %target_resource,
                "[THREAT SIGNATURE] Destructive API activity: Namespace/Node deletion attempt"
            );
            detections.push(ThreatDetection {
                signature_id: "SIG-DESTRUCTIVE-API".to_string(),
                title: "Destructive API Activity (Namespace/Node Deletion)".to_string(),
                description: format!(
                    "Actor '{}' attempted destructive '{}' on critical resource '{}'",
                    actor, verb, target_resource
                ),
                base_score: 80,
                actor: actor.clone(),
                source_ip: source_ip.clone(),
                target_resource: target_resource.clone(),
                verb: verb.clone(),
                request_uri: uri.clone(),
                timestamp: now,
            });
        }

        // 2. Privileged Container Spawning & Exec Infiltration (+50)
        let is_privileged_request = if let Some(req_obj) = &event.request_object {
            let req_str = req_obj.to_string().to_lowercase();
            req_str.contains("\"privileged\":true")
                || req_str.contains("\"hostpid\":true")
                || req_str.contains("\"hostnetwork\":true")
                || req_str.contains("\"hostpath\"")
        } else {
            false
        };

        let is_exec_or_attach = uri.contains("/exec") || uri.contains("/attach");

        if (resource == "pods" && (verb == "create" || verb == "patch" || verb == "update") && is_privileged_request)
            || (is_exec_or_attach && (verb == "create" || verb == "post" || verb == "get"))
        {
            warn!(
                actor = %actor,
                target = %target_resource,
                "[THREAT SIGNATURE] Privileged container spawn or container exec breakout"
            );
            detections.push(ThreatDetection {
                signature_id: "SIG-PRIV-CONTAINER".to_string(),
                title: "Privileged Container Spawn / Exec Escape".to_string(),
                description: format!(
                    "Actor '{}' attempted to spawn privileged workload or execute interactive shell on '{}'",
                    actor, target_resource
                ),
                base_score: 50,
                actor: actor.clone(),
                source_ip: source_ip.clone(),
                target_resource: target_resource.clone(),
                verb: verb.clone(),
                request_uri: uri.clone(),
                timestamp: now,
            });
        }

        // 3. Unauthorized RBAC Modifications (+40)
        if (verb == "create" || verb == "update" || verb == "patch" || verb == "delete")
            && (resource.contains("clusterrole")
                || resource.contains("rolebinding")
                || uri.contains("/rbac.authorization.k8s.io/"))
        {
            warn!(
                actor = %actor,
                target = %target_resource,
                "[THREAT SIGNATURE] Unauthorized RBAC modification / privilege escalation"
            );
            detections.push(ThreatDetection {
                signature_id: "SIG-RBAC-TAMPER".to_string(),
                title: "Unauthorized RBAC Modification".to_string(),
                description: format!(
                    "Actor '{}' executed RBAC modification ('{}') on '{}' attempting privilege escalation",
                    actor, verb, target_resource
                ),
                base_score: 40,
                actor: actor.clone(),
                source_ip: source_ip.clone(),
                target_resource: target_resource.clone(),
                verb: verb.clone(),
                request_uri: uri.clone(),
                timestamp: now,
            });
        }

        // 4. Sweeping Secret Access (+30)
        if (verb == "get" || verb == "list" || verb == "watch")
            && (resource == "secrets" || uri.contains("/api/v1/secrets") || uri.ends_with("/secrets"))
        {
            info!(
                actor = %actor,
                target = %target_resource,
                "[THREAT SIGNATURE] Sweeping secret access query"
            );
            detections.push(ThreatDetection {
                signature_id: "SIG-SECRET-SWEEP".to_string(),
                title: "Sweeping Secret Access".to_string(),
                description: format!(
                    "Actor '{}' queried sensitive cluster secrets via '{}' on '{}'",
                    actor, verb, target_resource
                ),
                base_score: 30,
                actor: actor.clone(),
                source_ip: source_ip.clone(),
                target_resource: target_resource.clone(),
                verb: verb.clone(),
                request_uri: uri.clone(),
                timestamp: now,
            });
        }

        // 5. Unknown Identity or Anonymous Access (+20)
        if actor == "system:anonymous" || actor.is_empty() || actor == "system:unknown" {
            detections.push(ThreatDetection {
                signature_id: "SIG-UNKNOWN-IDENTITY".to_string(),
                title: "Anonymous / Unauthenticated Identity API Access".to_string(),
                description: format!(
                    "Unauthenticated entity '{}' accessed Kubernetes API endpoint '{}'",
                    actor, uri
                ),
                base_score: 20,
                actor: actor.clone(),
                source_ip: source_ip.clone(),
                target_resource: target_resource.clone(),
                verb: verb.clone(),
                request_uri: uri.clone(),
                timestamp: now,
            });
        }

        detections
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_detect_namespace_deletion() {
        let event = KubeAuditEvent {
            verb: "delete".to_string(),
            request_uri: "/api/v1/namespaces/default".to_string(),
            user: AuditUser {
                username: "system:serviceaccount:attacker-sa".to_string(),
                ..Default::default()
            },
            object_ref: Some(AuditObjectRef {
                resource: "namespaces".to_string(),
                name: Some("default".to_string()),
                ..Default::default()
            }),
            ..Default::default()
        };

        let detections = ThreatSignatureMatcher::evaluate(&event);
        assert!(!detections.is_empty());
        assert_eq!(detections[0].signature_id, "SIG-DESTRUCTIVE-API");
        assert_eq!(detections[0].base_score, 80);
    }

    #[test]
    fn test_detect_privileged_container_spawn() {
        let event = KubeAuditEvent {
            verb: "create".to_string(),
            request_uri: "/api/v1/namespaces/default/pods".to_string(),
            user: AuditUser {
                username: "system:serviceaccount:default:infiltrator".to_string(),
                ..Default::default()
            },
            object_ref: Some(AuditObjectRef {
                resource: "pods".to_string(),
                namespace: Some("default".to_string()),
                name: Some("pwn-pod".to_string()),
                ..Default::default()
            }),
            request_object: Some(json!({
                "spec": {
                    "containers": [{
                        "name": "root-box",
                        "securityContext": { "privileged": true }
                    }]
                }
            })),
            ..Default::default()
        };

        let detections = ThreatSignatureMatcher::evaluate(&event);
        assert!(detections.iter().any(|d| d.signature_id == "SIG-PRIV-CONTAINER"));
    }

    #[test]
    fn test_detect_rbac_tampering() {
        let event = KubeAuditEvent {
            verb: "patch".to_string(),
            request_uri: "/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/admin-esc".to_string(),
            user: AuditUser {
                username: "rogue-dev".to_string(),
                ..Default::default()
            },
            object_ref: Some(AuditObjectRef {
                resource: "clusterrolebindings".to_string(),
                name: Some("admin-esc".to_string()),
                ..Default::default()
            }),
            ..Default::default()
        };

        let detections = ThreatSignatureMatcher::evaluate(&event);
        assert!(detections.iter().any(|d| d.signature_id == "SIG-RBAC-TAMPER"));
    }

    #[test]
    fn test_detect_secret_sweeping() {
        let event = KubeAuditEvent {
            verb: "list".to_string(),
            request_uri: "/api/v1/namespaces/production/secrets".to_string(),
            user: AuditUser {
                username: "external-scanner".to_string(),
                ..Default::default()
            },
            object_ref: Some(AuditObjectRef {
                resource: "secrets".to_string(),
                namespace: Some("production".to_string()),
                ..Default::default()
            }),
            ..Default::default()
        };

        let detections = ThreatSignatureMatcher::evaluate(&event);
        assert!(detections.iter().any(|d| d.signature_id == "SIG-SECRET-SWEEP"));
        assert_eq!(detections[0].base_score, 30);
    }
}
