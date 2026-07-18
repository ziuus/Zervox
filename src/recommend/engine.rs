use crate::analysis::correlator::IncidentContext;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

#[derive(Debug, Serialize)]
pub struct Recommendation {
    pub action: String,
    pub reason: String,
    pub confidence: f32,
    pub risk_level: RiskLevel,
}

pub fn generate_recommendations(context: &IncidentContext) -> Vec<Recommendation> {
    let mut recs = Vec::new();

    let has_db_timeout = context
        .error_logs
        .iter()
        .any(|l| l.message.to_lowercase().contains("timeout") || l.message.to_lowercase().contains("connection"));
    let has_cpu_spike = context.anomalies.iter().any(|m| m.metric_name == "cpu_usage");
    let has_latency = context.anomalies.iter().any(|m| m.metric_name == "latency_ms");

    if has_latency && has_db_timeout {
        recs.push(Recommendation {
            action: "Scale Database Replicas".into(),
            reason: "API latency is high and correlated with DB connection timeouts. Scaling read replicas can alleviate the load.".into(),
            confidence: 0.85,
            risk_level: RiskLevel::Low,
        });
        recs.push(Recommendation {
            action: "Restart API Service".into(),
            reason: "Restarting may clear hung connections, though it won't solve underlying database pressure.".into(),
            confidence: 0.50,
            risk_level: RiskLevel::Medium,
        });
    } else if has_cpu_spike {
        recs.push(Recommendation {
            action: "Scale Up Compute".into(),
            reason: "CPU usage is saturated. Horizontal or vertical scaling is recommended.".into(),
            confidence: 0.90,
            risk_level: RiskLevel::Low,
        });
    } else if !context.error_logs.is_empty() {
        recs.push(Recommendation {
            action: "Rollback Deployment".into(),
            reason: "Errors detected without resource spikes, likely indicating a bad deployment or logical bug.".into(),
            confidence: 0.75,
            risk_level: RiskLevel::High,
        });
    }

    if recs.is_empty() {
        recs.push(Recommendation {
            action: "Investigate Manually".into(),
            reason: "No strong correlated patterns detected.".into(),
            confidence: 1.0,
            risk_level: RiskLevel::Low,
        });
    }

    recs
}
