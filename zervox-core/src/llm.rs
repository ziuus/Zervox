use crate::fallback;
use crate::types::{AlertItem, Decision, EngineMode, RemediationAction};
use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::timeout;
use tracing::{info, warn};
use uuid::Uuid;

#[derive(Clone)]
pub struct LlmAnalyzer {
    client: Client,
    endpoint: Option<String>,
    api_key: Option<String>,
    model: String,
    force_fallback: bool,
}

#[derive(Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat>,
}

#[derive(Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ResponseFormat {
    #[serde(rename = "type")]
    format_type: String,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChatMessage,
}

#[derive(Deserialize)]
struct LlmRemediationOutput {
    root_cause: String,
    action_type: String,
    #[serde(default)]
    namespace: Option<String>,
    #[serde(default)]
    target_name: Option<String>,
    #[serde(default)]
    target_replicas: Option<i32>,
    #[serde(default)]
    confidence: Option<f32>,
    #[serde(default)]
    reasoning: Option<String>,
}

impl LlmAnalyzer {
    pub fn new(
        endpoint: Option<String>,
        api_key: Option<String>,
        model: String,
        force_fallback: bool,
    ) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(8))
            .build()
            .unwrap_or_default();

        Self {
            client,
            endpoint,
            api_key,
            model,
            force_fallback,
        }
    }

    /// Analyze an alert: attempts LLM RCA with retry & strict timeout, falling back seamlessly.
    pub async fn analyze(&self, alert: &AlertItem) -> Decision {
        if self.force_fallback {
            info!("Force fallback mode active, bypassing LLM");
            return fallback::match_rule(alert);
        }

        if self.endpoint.is_none() && self.api_key.is_none() {
            info!("No LLM credentials configured, using local fallback rule table");
            return fallback::match_rule(alert);
        }

        let max_attempts = 3; // 1 initial + 2 immediate retries
        for attempt in 1..=max_attempts {
            match timeout(Duration::from_secs(3), self.call_llm_single(alert)).await {
                Ok(Ok(decision)) => {
                    info!(
                        incident_id = %decision.incident_id,
                        root_cause = %decision.root_cause,
                        "LLM analysis succeeded"
                    );
                    return decision;
                }
                Ok(Err(err)) => {
                    warn!(
                        attempt,
                        error = %err,
                        "LLM returned structural/parsing error or network failure"
                    );
                }
                Err(_) => {
                    warn!(attempt, "LLM analysis timed out (3s strict)");
                }
            }
        }

        warn!("All LLM attempts exhausted (timeouts/parsing errors); routing directly to fallback");
        fallback::match_rule(alert)
    }

    async fn call_llm_single(&self, alert: &AlertItem) -> Result<Decision> {
        let endpoint = self
            .endpoint
            .as_deref()
            .unwrap_or("https://api.openai.com/v1/chat/completions");

        let system_prompt = r#"You are Zervox AI Root Cause Analysis & SRE Remediation Engine.
Analyze the Prometheus/Kubernetes alert and output a JSON object with this exact structure:
{
  "root_cause": "brief explanation of the failure",
  "action_type": "restart_pod" | "scale" | "cordon" | "no_action",
  "namespace": "target k8s namespace",
  "target_name": "pod or deployment or node name",
  "target_replicas": 4, // integer if action_type is scale
  "confidence": 0.95,
  "reasoning": "rationale for action"
}
Only output valid JSON."#;

        let user_prompt = format!(
            "Alert: {}\nSeverity: {}\nNamespace: {}\nLabels: {:?}\nAnnotations: {:?}\nSummary: {}",
            alert.alertname(),
            alert.severity(),
            alert.namespace(),
            alert.labels,
            alert.annotations,
            alert.summary()
        );

        let body = ChatCompletionRequest {
            model: self.model.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_prompt,
                },
            ],
            temperature: 0.1,
            response_format: Some(ResponseFormat {
                format_type: "json_object".to_string(),
            }),
        };

        let mut req = self.client.post(endpoint).json(&body);
        if let Some(key) = &self.api_key {
            req = req.bearer_auth(key);
        }

        let resp = req.send().await.context("Failed to send LLM request")?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            anyhow::bail!("LLM API returned error {}: {}", status, text);
        }

        let chat_resp: ChatCompletionResponse = resp
            .json()
            .await
            .context("Failed to parse LLM chat completion response")?;

        let content = chat_resp
            .choices
            .first()
            .map(|c| c.message.content.as_str())
            .context("Empty choices returned from LLM")?;

        let output: LlmRemediationOutput = serde_json::from_str(content)
            .context("Failed to parse remediation output JSON from LLM")?;

        let namespace = output
            .namespace
            .unwrap_or_else(|| alert.namespace().to_string());
        let target_name = output.target_name.unwrap_or_else(|| {
            alert
                .pod_name()
                .or_else(|| alert.deployment_name())
                .unwrap_or("victim-api")
                .to_string()
        });

        let action = match output.action_type.to_lowercase().as_str() {
            "restart_pod" => RemediationAction::RestartPod {
                namespace,
                pod_name: target_name,
            },
            "scale" => RemediationAction::ScaleDeployment {
                namespace,
                deployment_name: target_name,
                target_replicas: output.target_replicas.unwrap_or(4),
            },
            "cordon" => RemediationAction::CordonNode {
                node_name: target_name,
            },
            "no_action" => RemediationAction::NoAction {
                reason: output
                    .reasoning
                    .clone()
                    .unwrap_or_else(|| "LLM recommended no action".to_string()),
            },
            unknown => {
                anyhow::bail!("Structural validation failed: unknown action type '{}'", unknown);
            }
        };

        Ok(Decision {
            incident_id: format!("inc-{}", Uuid::new_v4().simple()),
            mode: EngineMode::Ai,
            root_cause: output.root_cause,
            action,
            confidence: output.confidence.unwrap_or(0.9),
            reasoning: output
                .reasoning
                .unwrap_or_else(|| "AI RCA recommendation".to_string()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_unreachable_llm_falls_back() {
        // Point to a dead local port to trigger failure and fallback
        let analyzer = LlmAnalyzer::new(
            Some("http://127.0.0.1:59999/v1/chat/completions".to_string()),
            Some("fake-key".to_string()),
            "gpt-4o-mini".to_string(),
            false,
        );

        let mut labels = HashMap::new();
        labels.insert("alertname".to_string(), "PodCrashLooping".to_string());
        labels.insert("pod".to_string(), "victim-api-xyz".to_string());

        let alert = AlertItem {
            status: "firing".to_string(),
            labels,
            ..Default::default()
        };

        let decision = analyzer.analyze(&alert).await;
        assert_eq!(decision.mode, EngineMode::Fallback);
        match decision.action {
            RemediationAction::RestartPod { pod_name, .. } => {
                assert_eq!(pod_name, "victim-api-xyz");
            }
            _ => panic!("Expected fallback restart pod"),
        }
    }
}
