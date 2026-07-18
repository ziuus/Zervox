use crate::models::schema::{MetricData, UnifiedLog};

#[derive(Debug)]
pub struct IncidentContext {
    pub anomalies: Vec<MetricData>,
    pub error_logs: Vec<UnifiedLog>,
    pub summary: String,
}

pub fn correlate_incident(metrics: &[MetricData], logs: &[UnifiedLog]) -> Option<IncidentContext> {
    // Basic threshold logic for MVP
    let anomalies: Vec<_> = metrics
        .iter()
        .filter(|m| {
            (m.metric_name == "cpu_usage" && m.value > 80.0)
                || (m.metric_name == "latency_ms" && m.value > 500.0)
        })
        .cloned()
        .collect();

    let error_logs: Vec<_> = logs
        .iter()
        .filter(|l| l.level == "ERROR" || l.level == "FATAL")
        .cloned()
        .collect();

    if anomalies.is_empty() && error_logs.is_empty() {
        return None;
    }

    let summary = if !anomalies.is_empty() && !error_logs.is_empty() {
        "High metrics detected correlating with application errors.".to_string()
    } else if !anomalies.is_empty() {
        "Resource/Latency spikes detected without explicit errors.".to_string()
    } else {
        "Application errors detected without resource spikes.".to_string()
    };

    Some(IncidentContext {
        anomalies,
        error_logs,
        summary,
    })
}
