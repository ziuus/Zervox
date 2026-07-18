use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnifiedLog {
    pub timestamp: String,
    pub service_name: String,
    pub level: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MetricData {
    pub metric_name: String,
    pub value: f64,
    pub timestamp: String,
    pub tags: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IncidentInput {
    pub metrics: Vec<MetricData>,
    pub logs: Vec<UnifiedLog>,
}
