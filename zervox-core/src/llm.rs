use crate::fallback;
use crate::types::{AlertItem, Decision, EngineMode, RemediationAction};
use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::timeout;
use tracing::{info, warn};
use uuid::Uuid;

/// Hard timeout for the entire LLM round-trip including all retries.
const LLM_HARD_TIMEOUT: Duration = Duration::from_secs(10);
/// Per-attempt HTTP timeout (must be < LLM_HARD_TIMEOUT to leave retry time)
const LLM_REQUEST_TIMEOUT: Duration = Duration::from_secs(7);
/// Max retry attempts within the hard timeout window
const LLM_MAX_RETRIES: u32 = 2;

#[derive(Clone)]
pub struct LlmAnalyzer {
    client: Client,
    endpoint: Option<String>,
    api_key: Option<String>,
    model: String,
    force_fallback: bool,
}

// ── OpenAI-compatible wire types ─────────────────────────────────────────────

#[derive(Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat>,
    /// Maximum tokens to avoid runaway cost on misconfigured models
    max_tokens: u32,
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

/// Structured output expected from the LLM (JSON mode)
#[derive(Deserialize, Debug)]
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

// ─────────────────────────────────────────────────────────────────────────────

impl LlmAnalyzer {
    pub fn new(
        endpoint: Option<String>,
        api_key: Option<String>,
        model: String,
        force_fallback: bool,
    ) -> Self {
        // Per-request HTTP timeout is set here; the outer tokio::time::timeout
        // provides the hard 10s wall-clock guarantee
        let client = Client::builder()
            .timeout(LLM_REQUEST_TIMEOUT)
            .connect_timeout(Duration::from_secs(3))
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

    /// Primary analysis entry-point. Always returns a Decision within 10 seconds.
    /// Route: LLM (with 2 retries) → timeout/error → local fallback rules.
    pub async fn analyze(&self, alert: &AlertItem) -> Decision {
        // Short-circuit: forced fallback or no credentials configured
        if self.force_fallback {
            info!("ZERVOX_FORCE_FALLBACK=true — routing directly to local rules");
            return fallback::match_rule(alert);
        }

        if self.endpoint.is_none() && self.api_key.is_none() {
            info!("No LLM credentials configured — using local deterministic fallback");
            return fallback::match_rule(alert);
        }

        // Hard 10-second wall-clock timeout wraps everything including retries
        match timeout(LLM_HARD_TIMEOUT, self.call_with_retry(alert)).await {
            Ok(Ok(decision)) => {
                info!(
                    mode = "ai",
                    root_cause = %decision.root_cause,
                    confidence = decision.confidence,
                    "LLM root-cause analysis succeeded"
                );
                decision
            }
            Ok(Err(err)) => {
                warn!(
                    error = %err,
                    "LLM analysis returned error after retries — switching to Local Fallback Mode"
                );
                fallback::match_rule(alert)
            }
            Err(_elapsed) => {
                warn!(
                    timeout_secs = LLM_HARD_TIMEOUT.as_secs(),
                    "LLM analysis hit hard timeout — switching to Local Fallback Mode"
                );
                fallback::match_rule(alert)
            }
        }
    }

    // ── Retry loop ────────────────────────────────────────────────────────────

    async fn call_with_retry(&self, alert: &AlertItem) -> Result<Decision> {
        let mut last_err = anyhow::anyhow!("No attempts made");

        for attempt in 1..=LLM_MAX_RETRIES {
            match self.call_single(alert).await {
                Ok(d) => return Ok(d),
                Err(e) => {
                    warn!(
                        attempt,
                        max = LLM_MAX_RETRIES,
                        error = %e,
                        "LLM attempt failed"
                    );
                    last_err = e;
                    // Exponential back-off: 500ms, 1000ms …
                    if attempt < LLM_MAX_RETRIES {
                        tokio::time::sleep(Duration::from_millis(500 * u64::from(attempt))).await;
                    }
                }
            }
        }

        warn!("All LLM attempts exhausted (timeouts/parsing errors); routing directly to fallback");
        Err(last_err)
    }

    // ── Single HTTP call ─────────────────────────────────────────────────────

    async fn call_single(&self, alert: &AlertItem) -> Result<Decision> {
        let endpoint = self
            .endpoint
            .as_deref()
            .unwrap_or("https://api.openai.com/v1/chat/completions");

        let system_prompt = concat!(
            "You are Zervox — an autonomous Kubernetes SRE Remediation AI.\n",
            "Analyze the Prometheus/Alertmanager alert and respond ONLY with a JSON object:\n",
            "{\n",
            "  \"root_cause\": \"concise failure diagnosis\",\n",
            "  \"action_type\": \"restart_pod\" | \"scale\" | \"cordon\" | \"no_action\",\n",
            "  \"namespace\": \"kubernetes namespace\",\n",
            "  \"target_name\": \"pod / deployment / node name\",\n",
            "  \"target_replicas\": 4,\n",
            "  \"confidence\": 0.92,\n",
            "  \"reasoning\": \"rationale\"\n",
            "}\n",
            "Rules: scale target_replicas must be ≥1 and ≤10. Output ONLY valid JSON."
        );

        let user_prompt = format!(
            "Alert: {}\nSeverity: {}\nNamespace: {}\nPod: {}\nDeployment: {}\nSummary: {}\nLabels: {:?}",
            alert.alertname(),
            alert.severity(),
            alert.namespace(),
            alert.pod_name().unwrap_or("unknown"),
            alert.deployment_name().unwrap_or("unknown"),
            alert.summary(),
            alert.labels,
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
            temperature: 0.1, // Low temperature for deterministic, structured output
            response_format: Some(ResponseFormat {
                format_type: "json_object".to_string(),
            }),
            max_tokens: 512,
        };

        let mut req = self.client.post(endpoint).json(&body);
        if let Some(key) = &self.api_key {
            req = req.bearer_auth(key);
        }

        let resp = req
            .send()
            .await
            .context("HTTP request to LLM endpoint failed")?;

        let status = resp.status();
        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            anyhow::bail!(
                "LLM API returned {} — body: {}",
                status,
                body_text.chars().take(400).collect::<String>()
            );
        }

        let chat_resp: ChatCompletionResponse = resp
            .json()
            .await
            .context("Failed to deserialize LLM response as ChatCompletionResponse")?;

        let content = chat_resp
            .choices
            .first()
            .map(|c| c.message.content.as_str())
            .context("LLM returned empty choices array")?;

        let output: LlmRemediationOutput = serde_json::from_str(content)
            .with_context(|| {
                format!(
                    "Failed to parse LLM JSON output: {}",
                    content.chars().take(200).collect::<String>()
                )
            })?;

        self.build_decision(alert, output)
    }

    // ── Decision builder ─────────────────────────────────────────────────────

    fn build_decision(&self, alert: &AlertItem, output: LlmRemediationOutput) -> Result<Decision> {
        let namespace = output
            .namespace
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| alert.namespace().to_string());

        let target_name = output
            .target_name
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| {
                alert
                    .pod_name()
                    .or_else(|| alert.deployment_name())
                    .unwrap_or("victim-api")
                    .to_string()
            });

        let action_type = output.action_type.to_lowercase();
        let action = match action_type.as_str() {
            "restart_pod" => RemediationAction::RestartPod {
                namespace,
                pod_name: target_name,
            },
            "scale" => {
                // Enforce replica cap at the LLM output level (OPA will also check)
                let replicas = output
                    .target_replicas
                    .unwrap_or(4)
                    .clamp(1, 10);
                RemediationAction::ScaleDeployment {
                    namespace,
                    deployment_name: target_name,
                    target_replicas: replicas,
                }
            }
            "cordon" => RemediationAction::CordonNode {
                node_name: target_name,
            },
            "no_action" => RemediationAction::NoAction {
                reason: output
                    .reasoning
                    .clone()
                    .unwrap_or_else(|| "LLM determined no action is warranted".to_string()),
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
            confidence: output.confidence.unwrap_or(0.85).clamp(0.0, 1.0),
            reasoning: output
                .reasoning
                .unwrap_or_else(|| "LLM reasoning not provided".to_string()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn make_alert(alertname: &str, pod: Option<&str>) -> AlertItem {
        let mut labels = HashMap::new();
        labels.insert("alertname".to_string(), alertname.to_string());
        labels.insert("namespace".to_string(), "default".to_string());
        if let Some(p) = pod {
            labels.insert("pod".to_string(), p.to_string());
        }
        AlertItem {
            status: "firing".to_string(),
            labels,
            ..Default::default()
        }
    }

    #[tokio::test]
    async fn test_force_fallback_bypasses_llm() {
        let analyzer = LlmAnalyzer::new(
            Some("http://127.0.0.1:59999/v1/chat/completions".to_string()),
            Some("dummy-key".to_string()),
            "gpt-4o-mini".to_string(),
            true, // force_fallback=true
        );
        let alert = make_alert("PodCrashLooping", Some("victim-api-abc"));
        let d = analyzer.analyze(&alert).await;
        assert_eq!(d.mode, EngineMode::Fallback);
    }

    #[tokio::test]
    async fn test_unreachable_llm_falls_back_within_timeout() {
        // Port 59999 should be closed — triggers connection refused quickly
        let analyzer = LlmAnalyzer::new(
            Some("http://127.0.0.1:59999/v1/chat/completions".to_string()),
            Some("fake-key".to_string()),
            "gpt-4o-mini".to_string(),
            false,
        );
        let alert = make_alert("PodCrashLooping", Some("victim-api-xyz"));
        let start = std::time::Instant::now();
        let d = analyzer.analyze(&alert).await;
        // Must complete well under the 10s hard timeout
        assert!(start.elapsed().as_secs() < 10, "Fallback took too long");
        assert_eq!(d.mode, EngineMode::Fallback);
        match d.action {
            RemediationAction::RestartPod { pod_name, .. } => {
                assert_eq!(pod_name, "victim-api-xyz");
            }
            _ => panic!("Expected RestartPod from fallback"),
        }
    }

    #[tokio::test]
    async fn test_no_credentials_uses_fallback() {
        let analyzer = LlmAnalyzer::new(None, None, "gpt-4o-mini".to_string(), false);
        let alert = make_alert("HighLatency", None);
        let d = analyzer.analyze(&alert).await;
        assert_eq!(d.mode, EngineMode::Fallback);
    }
}
