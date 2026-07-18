use anyhow::Result;
use crate::models::schema::MetricData;
use std::collections::HashMap;

pub async fn scrape_metrics(url: &str) -> Result<Vec<MetricData>> {
    let response = reqwest::get(url).await?.text().await?;
    let mut metrics = Vec::new();
    
    // Simple Prometheus text format parser
    for line in response.lines() {
        if line.starts_with('#') || line.trim().is_empty() {
            continue;
        }
        
        if let Some(space_idx) = line.rfind(' ') {
            let (name_part, value_part) = line.split_at(space_idx);
            let value_part = value_part.trim();
            
            if let Ok(value) = value_part.parse::<f64>() {
                let name = if let Some(brace_idx) = name_part.find('{') {
                    &name_part[0..brace_idx]
                } else {
                    name_part
                };
                
                metrics.push(MetricData {
                    metric_name: name.to_string(),
                    value,
                    timestamp: "now".to_string(), // MVP: Replace with actual parsing if needed
                    tags: HashMap::new(),
                });
            }
        }
    }
    
    Ok(metrics)
}
