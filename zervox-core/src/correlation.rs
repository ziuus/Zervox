use crate::threat::ThreatDetection;
use crate::types::RemediationAction;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};
use uuid::Uuid;

/// Escalation severity tiers defined by aggregated threat scores
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ThreatTier {
    Low,      // 0 - 30
    Medium,   // 31 - 60
    High,     // 61 - 80
    Critical, // 81 - 100+
}

impl ThreatTier {
    pub fn from_score(score: u32) -> Self {
        match score {
            0..=30 => ThreatTier::Low,
            31..=60 => ThreatTier::Medium,
            61..=80 => ThreatTier::High,
            _ => ThreatTier::Critical,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            ThreatTier::Low => "LOW",
            ThreatTier::Medium => "MEDIUM",
            ThreatTier::High => "HIGH",
            ThreatTier::Critical => "CRITICAL",
        }
    }

    pub fn should_remediate(&self) -> bool {
        matches!(self, ThreatTier::Medium | ThreatTier::High | ThreatTier::Critical)
    }
}

impl std::fmt::Display for ThreatTier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Standard Scoring Matrix for Kubernetes Cyber Threat Events
pub struct ThreatScoreMatrix;

impl ThreatScoreMatrix {
    pub const RESOURCE_SPIKE: u32 = 10;
    pub const UNKNOWN_IDENTITY: u32 = 20;
    pub const SECRET_ACCESS: u32 = 30;
    pub const RBAC_MODIFICATION: u32 = 40;
    pub const PRIVILEGED_CONTAINER: u32 = 50;
    pub const NAMESPACE_DELETION: u32 = 80;

    pub fn get_score(signature_id: &str) -> u32 {
        match signature_id {
            "SIG-RESOURCE-SPIKE" => Self::RESOURCE_SPIKE,
            "SIG-UNKNOWN-IDENTITY" => Self::UNKNOWN_IDENTITY,
            "SIG-SECRET-SWEEP" => Self::SECRET_ACCESS,
            "SIG-RBAC-TAMPER" => Self::RBAC_MODIFICATION,
            "SIG-PRIV-CONTAINER" => Self::PRIVILEGED_CONTAINER,
            "SIG-DESTRUCTIVE-API" => Self::NAMESPACE_DELETION,
            _ => 15, // Baseline anomalous event score
        }
    }
}

/// Single event stored in the time-bounded sliding window buffer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BufferedThreatEvent {
    pub detection: ThreatDetection,
    pub score: u32,
    pub timestamp: DateTime<Utc>,
}

/// Correlated Incident aggregated across the sliding window
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelatedIncident {
    pub incident_id: String,
    pub actor: String,
    pub total_score: u32,
    pub tier: ThreatTier,
    pub event_count: usize,
    pub primary_signature: String,
    pub target_resource: String,
    pub detections: Vec<ThreatDetection>,
    pub window_start: DateTime<Utc>,
    pub window_end: DateTime<Utc>,
    pub recommended_action: RemediationAction,
    pub summary: String,
}

/// Thread-safe Stateful Buffer for Threat Correlation with 5-minute sliding window
#[derive(Clone)]
pub struct ThreatCorrelationEngine {
    window_duration: Duration,
    buffer: Arc<RwLock<HashMap<String, Vec<BufferedThreatEvent>>>>,
}

impl Default for ThreatCorrelationEngine {
    fn default() -> Self {
        Self::new(Duration::seconds(300)) // 5-minute default TTL
    }
}

impl ThreatCorrelationEngine {
    pub fn new(window_duration: Duration) -> Self {
        Self {
            window_duration,
            buffer: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Extracts normalized identity key (ServiceAccount > IP > Subject)
    pub fn extract_actor_key(detection: &ThreatDetection) -> String {
        if !detection.actor.is_empty() && detection.actor != "system:unknown" && detection.actor != "system:anonymous" {
            detection.actor.clone()
        } else if let Some(ip) = &detection.source_ip {
            format!("ip:{}", ip)
        } else {
            detection.actor.clone()
        }
    }

    /// Ingests a slice of threat detections into the sliding window and returns escalated incidents
    pub async fn ingest(&self, detections: &[ThreatDetection]) -> Vec<CorrelatedIncident> {
        let mut correlated_incidents = Vec::new();
        let now = Utc::now();
        let cutoff = now - self.window_duration;

        let mut lock = self.buffer.write().await;
        let mut affected_actors = std::collections::HashSet::new();

        for detection in detections {
            let actor_key = Self::extract_actor_key(detection);
            let score = ThreatScoreMatrix::get_score(&detection.signature_id);

            let events = lock.entry(actor_key.clone()).or_default();

            // 1. Evict events outside the 5-minute sliding window
            events.retain(|e| e.timestamp >= cutoff);

            // 2. Add current event
            events.push(BufferedThreatEvent {
                detection: detection.clone(),
                score,
                timestamp: detection.timestamp,
            });

            affected_actors.insert(actor_key);
        }

        // For each actor affected in this batch, evaluate their latest cumulative window state
        for actor_key in affected_actors {
            if let Some(events) = lock.get_mut(&actor_key) {
                events.retain(|e| e.timestamp >= cutoff);
                let total_score: u32 = events.iter().map(|e| e.score).sum();
                let tier = ThreatTier::from_score(total_score);

                info!(
                    actor = %actor_key,
                    events_in_window = events.len(),
                    cumulative_score = total_score,
                    tier = %tier,
                    "[CORRELATION ENGINE] Sliding window evaluated"
                );

                // Generate incident if tier escalates to MEDIUM or higher
                if tier.should_remediate() {
                    let incident_id = format!("inc-sec-{}", Uuid::new_v4().simple());
                    let window_start = events.first().map(|e| e.timestamp).unwrap_or(now);
                    let window_end = events.last().map(|e| e.timestamp).unwrap_or(now);
                    let latest_detection = events.last().map(|e| &e.detection);
                    let primary_signature = latest_detection
                        .map(|d| d.signature_id.clone())
                        .unwrap_or_else(|| "SIG-UNKNOWN".to_string());
                    let target_resource = latest_detection
                        .map(|d| d.target_resource.clone())
                        .unwrap_or_else(|| "cluster".to_string());

                    let (namespace, pod_or_target) = match target_resource.split('/').collect::<Vec<&str>>().as_slice() {
                        [_res, ns, name] => (ns.to_string(), name.to_string()),
                        [ns, name] => (ns.to_string(), name.to_string()),
                        _ => ("default".to_string(), target_resource.clone()),
                    };

                    // Formulate appropriate remediation action based on escalation tier
                    let recommended_action = match tier {
                        ThreatTier::Critical => {
                            warn!(
                                actor = %actor_key,
                                score = total_score,
                                "[CORRELATION ESCALATION: CRITICAL] Aggregated threat exceeded critical threshold (81+)"
                            );
                            RemediationAction::QuarantineWorkload {
                                namespace: namespace.clone(),
                                target_pod: pod_or_target.clone(),
                            }
                        }
                        ThreatTier::High => {
                            warn!(
                                actor = %actor_key,
                                score = total_score,
                                "[CORRELATION ESCALATION: HIGH] Aggregated threat reached high severity (61-80)"
                            );
                            RemediationAction::RestartPod {
                                namespace: namespace.clone(),
                                pod_name: pod_or_target.clone(),
                            }
                        }
                        ThreatTier::Medium => {
                            RemediationAction::NoAction {
                                reason: format!(
                                    "Correlated tier MEDIUM ({}) under observation; audit trace recorded.",
                                    total_score
                                ),
                            }
                        }
                        ThreatTier::Low => RemediationAction::NoAction {
                            reason: "Threat score within baseline tolerance.".to_string(),
                        },
                    };

                    let summary = format!(
                        "Correlated Cyber Threat [{}] by actor '{}': Total score {} across {} events in 5-minute window. Primary vector: {}",
                        tier, actor_key, total_score, events.len(), primary_signature
                    );

                    correlated_incidents.push(CorrelatedIncident {
                        incident_id,
                        actor: actor_key,
                        total_score,
                        tier,
                        event_count: events.len(),
                        primary_signature,
                        target_resource,
                        detections: events.iter().map(|e| e.detection.clone()).collect(),
                        window_start,
                        window_end,
                        recommended_action,
                        summary,
                    });
                }
            }
        }

        correlated_incidents
    }

    /// Queries current aggregate threat score for a specific actor
    pub async fn get_actor_score(&self, actor: &str) -> (u32, ThreatTier) {
        let cutoff = Utc::now() - self.window_duration;
        let lock = self.buffer.read().await;

        if let Some(events) = lock.get(actor) {
            let total_score: u32 = events
                .iter()
                .filter(|e| e.timestamp >= cutoff)
                .map(|e| e.score)
                .sum();
            (total_score, ThreatTier::from_score(total_score))
        } else {
            (0, ThreatTier::Low)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_detection(actor: &str, sig: &str) -> ThreatDetection {
        ThreatDetection {
            signature_id: sig.to_string(),
            title: "Test Threat".to_string(),
            description: "Test description".to_string(),
            base_score: ThreatScoreMatrix::get_score(sig),
            actor: actor.to_string(),
            source_ip: Some("10.244.0.99".to_string()),
            target_resource: "pods/default/victim-api".to_string(),
            verb: "create".to_string(),
            request_uri: "/api/v1/pods".to_string(),
            timestamp: Utc::now(),
        }
    }

    #[tokio::test]
    async fn test_scoring_matrix_and_tier_mapping() {
        assert_eq!(ThreatTier::from_score(25), ThreatTier::Low);
        assert_eq!(ThreatTier::from_score(45), ThreatTier::Medium);
        assert_eq!(ThreatTier::from_score(75), ThreatTier::High);
        assert_eq!(ThreatTier::from_score(85), ThreatTier::Critical);
    }

    #[tokio::test]
    async fn test_sliding_window_aggregation_and_escalation() {
        let engine = ThreatCorrelationEngine::new(Duration::seconds(300));
        let actor = "system:serviceaccount:default:compromised-app";

        // Step 1: Secret sweep (+30) -> Total 30 (LOW)
        let det1 = vec![dummy_detection(actor, "SIG-SECRET-SWEEP")];
        let inc1 = engine.ingest(&det1).await;
        assert!(inc1.is_empty(), "Score 30 is Low, should not trigger active incident");

        // Step 2: RBAC modification (+40) -> Total 70 (HIGH)
        let det2 = vec![dummy_detection(actor, "SIG-RBAC-TAMPER")];
        let inc2 = engine.ingest(&det2).await;
        assert_eq!(inc2.len(), 1);
        assert_eq!(inc2[0].tier, ThreatTier::High);
        assert_eq!(inc2[0].total_score, 70);

        // Step 3: Namespace deletion (+80) -> Total 150 (CRITICAL)
        let det3 = vec![dummy_detection(actor, "SIG-DESTRUCTIVE-API")];
        let inc3 = engine.ingest(&det3).await;
        assert_eq!(inc3.len(), 1);
        assert_eq!(inc3[0].tier, ThreatTier::Critical);
        assert_eq!(inc3[0].total_score, 150);
    }
}
