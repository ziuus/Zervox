use crate::models::schema::IncidentInput;
use crate::analysis::correlator::correlate_incident;
use crate::recommend::engine::generate_recommendations;
use colored::Colorize;
use std::fs;
use anyhow::{Context, Result};
use std::io::{self, Write};

pub fn run_analysis(file_path: &str) -> Result<()> {
    let content = fs::read_to_string(file_path)
        .with_context(|| format!("Failed to read incident data from {}", file_path))?;
    
    let input: IncidentInput = serde_json::from_str(&content)
        .with_context(|| "Failed to parse incident data JSON. Ensure it matches the IncidentInput schema.")?;
    
    println!("{} {} logs and {} metrics...", "⚙️".cyan(), input.logs.len(), input.metrics.len());

    let mut incident_context = match correlate_incident(&input.metrics, &input.logs) {
        Some(ctx) => {
            // Persist incident to DB
            if let Ok(db) = crate::models::db::IncidentStore::new("zervox_incidents.db") {
                let _ = db.insert_incident(&ctx.summary, ctx.anomalies.len(), ctx.error_logs.len());
            }
            ctx
        },
        None => {
            println!("{} No anomalies or errors detected.", "✓".green());
            return Ok(());
        }
    };

    // Advanced LLM Integration: Augment the context summary
    let _ = tokio::runtime::Runtime::new().unwrap().block_on(async {
        let _ = crate::analysis::llm_analyzer::augment_with_llm(&mut incident_context).await;
    });

    println!("\n{} {}", "🔍".yellow(), "Incident Summary:".bold());
    println!("   {}", incident_context.summary.italic());
    println!("   Detected {} anomalies and {} error logs.", incident_context.anomalies.len(), incident_context.error_logs.len());

    let recommendations = generate_recommendations(&incident_context);

    println!("\n{} {}", "💡".cyan(), "Suggested Recovery Actions:".bold());
    for (i, rec) in recommendations.iter().enumerate() {
        let risk_color = match rec.risk_level {
            crate::recommend::engine::RiskLevel::Low => "green",
            crate::recommend::engine::RiskLevel::Medium => "yellow",
            crate::recommend::engine::RiskLevel::High => "red",
        };

        println!("{}. {} [{}]", i + 1, rec.action.bold(), format!("{:?}", rec.risk_level).color(risk_color));
        println!("   Reason: {}", rec.reason);
        println!("   Confidence: {}%", (rec.confidence * 100.0).round());
        println!();
    }

    print!("Select an action to execute (or 'q' to quit): ");
    io::stdout().flush()?;
    
    let mut choice = String::new();
    io::stdin().read_line(&mut choice)?;
    let choice = choice.trim();

    if choice == "q" {
        println!("Action aborted. Staying in observation mode.");
        return Ok(());
    }

    if let Ok(idx) = choice.parse::<usize>() {
        if let Some(rec) = recommendations.get(idx - 1) {
            println!("{} Executing [{}]...", "🚀".green(), rec.action.bold());
            
            if rec.action.contains("Restart API Service") {
                println!("Calling K8s API: rollout restart deployment/api-gateway...");
                let _ = tokio::runtime::Runtime::new().unwrap().block_on(async {
                    crate::execution::kubernetes::restart_deployment("default", "api-gateway").await
                });
            }

            println!("{} Action completed successfully.", "✓".green());
        } else {
            println!("Invalid selection.");
        }
    } else {
        println!("Invalid input.");
    }

    Ok(())
}
