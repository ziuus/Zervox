use regex::Regex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Serialize, Deserialize, Clone)]
pub struct Solution {
    pub id: u32,
    pub description: String,
    pub command: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CrashData {
    pub id: String,
    pub file: String,
    pub reason: String,
    pub solutions: Vec<Solution>,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Deserialize)]
struct Message {
    content: String,
}

pub async fn analyze_crash(process_id: &str, logs: Vec<String>) -> anyhow::Result<CrashData> {
    // 1. Redact secrets
    let redacted_logs = redact_secrets(logs.join("\n"));

    // 2. Call AI provider
    let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();

    if api_key.is_empty() {
        return Ok(CrashData {
            id: process_id.to_string(),
            file: process_id.to_string(),
            reason: format!(
                "Crash detected, but no OPENAI_API_KEY set for analysis.\nRedacted Logs: {}",
                redacted_logs.lines().last().unwrap_or("")
            ),
            solutions: vec![Solution {
                id: 1,
                description: "Set OPENAI_API_KEY to enable AI crash analysis".to_string(),
                command: Some("export OPENAI_API_KEY=your_key".to_string()),
            }],
        });
    }

    let client = Client::new();
    let prompt = format!(
        "Analyze the following application crash logs. Provide a root cause and a list of actionable solutions (like commands or config changes).\n\nLogs:\n{}",
        redacted_logs
    );

    let res = client.post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&json!({
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "system",
                    "content": "You are Zervox, a process watchdog AI. Output your analysis strictly as JSON matching this schema: {\"reason\": \"string\", \"solutions\": [{\"id\": 1, \"description\": \"string\", \"command\": \"string\"}]}. If no command is needed, leave it null."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "response_format": { "type": "json_object" }
        }))
        .send()
        .await?;

    if !res.status().is_success() {
        let err = res.text().await?;
        anyhow::bail!("API Error: {}", err);
    }

    let openai_res: OpenAiResponse = res.json().await?;
    let content = &openai_res.choices[0].message.content;

    #[derive(Deserialize)]
    struct AiResult {
        reason: String,
        solutions: Vec<Solution>,
    }

    let result: AiResult = serde_json::from_str(content)?;

    Ok(CrashData {
        id: process_id.to_string(),
        file: process_id.to_string(), // In full implementation, map from store
        reason: result.reason,
        solutions: result.solutions,
    })
}

fn redact_secrets(input: String) -> String {
    // Regex for common secrets
    let mut redacted = input;

    let patterns = [
        (r"Bearer\s+[A-Za-z0-9\-\._~+]+", "Bearer [REDACTED]"),
        (
            r"gh[p|u|s|r]_[A-Za-z0-9_]{36,255}",
            "[REDACTED_GITHUB_TOKEN]",
        ),
        (
            r"(?i)(api[_-]?key|secret|password|passwd|token)[^\w]*[:=][^\w]*[A-Za-z0-9\-\._]+",
            "$1 = [REDACTED]",
        ),
        (
            r"mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@",
            "mongodb://[REDACTED]:[REDACTED]@",
        ),
        (
            r"postgres(?:ql)?:\/\/[^:]+:[^@]+@",
            "postgres://[REDACTED]:[REDACTED]@",
        ),
    ];

    for (pat, rep) in patterns {
        if let Ok(re) = Regex::new(pat) {
            redacted = re.replace_all(&redacted, rep).to_string();
        }
    }

    redacted
}
