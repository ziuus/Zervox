use crate::analysis::correlator::IncidentContext;
use reqwest::Client;
use serde_json::json;
use anyhow::Result;

pub async fn augment_with_llm(context: &mut IncidentContext) -> Result<()> {
    let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        return Ok(());
    }

    let logs_str = context.error_logs.iter().map(|l| l.message.clone()).collect::<Vec<_>>().join("\n");
    let metrics_str = context.anomalies.iter().map(|m| format!("{}: {}", m.metric_name, m.value)).collect::<Vec<_>>().join("\n");

    let prompt = format!(
        "Analyze this incident. Metrics showing anomalies:\n{}\n\nError logs:\n{}\n\nProvide a concise 1-sentence root cause summary.",
        metrics_str, logs_str
    );

    let client = Client::new();
    let res = client.post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&json!({
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "system",
                    "content": "You are Zervox, a senior SRE AI."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }))
        .send()
        .await?;

    if res.status().is_success() {
        let json: serde_json::Value = res.json().await?;
        if let Some(content) = json["choices"][0]["message"]["content"].as_str() {
            context.summary = format!("LLM Insight: {}", content);
        }
    }

    Ok(())
}
