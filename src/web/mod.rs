use crate::runtime::{RuntimeStatus, RuntimeStore};
use crate::supervisor::{self, append_log};
use axum::Router;
use serde::{Deserialize, Serialize};
use serde_json::json;
use socketioxide::{extract::Data, extract::SocketRef, SocketIo};
use std::path::PathBuf;
use std::time::Duration;
use tokio::time::sleep;
use tower_http::services::ServeDir;

pub mod ai;
mod config_persist;

use config_persist::DashboardConfigPersisted;

#[derive(Serialize, Deserialize, Clone)]
struct DashboardConfig {
    mode: String,
    #[serde(rename = "webhookUrl")]
    webhook_url: Option<String>,
}

#[derive(Serialize)]
struct ProcessPayload {
    id: String,
    file: String,
    status: String,
    restarts: u32,
}

#[derive(Deserialize)]
struct ApplySolutionRequest {
    #[serde(rename = "processId")]
    process_id: String,
    #[serde(rename = "solutionId")]
    solution_id: u32,
    solution: ai::Solution,
}

pub async fn start_server(port: u16) -> anyhow::Result<()> {
    let (layer, io) = SocketIo::new_layer();

    // Serve the product website from root, dashboard from /dashboard/
    let app = Router::new()
        .nest_service("/dashboard", ServeDir::new("public"))
        .route("/api/analyze", axum::routing::post(analyze_incident))
        .route("/api/grafana_webhook", axum::routing::post(grafana_webhook))
        .fallback_service(ServeDir::new("web/zervox-site"))
        .layer(layer);

    // Initial state handler
    let io_clone = io.clone();
    io.ns("/", move |socket: SocketRef| async move {
        // Reconcile stale processes first so dashboard shows accurate state
        if let Ok(mut store) = RuntimeStore::load_default() {
            let _ = store.reconcile_stale_processes();
        }

        let store = RuntimeStore::load_default().unwrap_or_else(|_| RuntimeStore {
            path: "".into(),
            processes: vec![],
        });
        let mut processes = Vec::new();
        for p in store.processes {
            processes.push(ProcessPayload {
                id: p.name.clone(),
                file: p.command.first().cloned().unwrap_or_default(),
                status: match p.status {
                    RuntimeStatus::Online => "online",
                    RuntimeStatus::Crashed => "crashed",
                    RuntimeStatus::Restarting => "restarting",
                    RuntimeStatus::Stopped => "stopped",
                    RuntimeStatus::Starting => "restarting",
                }
                .to_string(),
                restarts: p.restarts,
            });
        }

        let _ = socket.emit("init_state", &json!({ "processes": processes }));

        // Emit persisted config
        let cfg = DashboardConfigPersisted::load();
        let _ = socket.emit(
            "config_update",
            &json!({ "mode": cfg.mode, "webhookUrl": cfg.webhook_url }),
        );

        socket.on(
            "get_process_details",
            |socket: SocketRef, Data::<String>(id)| async move {
                let store = RuntimeStore::load_default().unwrap_or_else(|_| RuntimeStore {
                    path: "".into(),
                    processes: vec![],
                });
                if let Some(p) = store.find(&id) {
                    let logs = supervisor::tail_log(&p.log_path, 100).unwrap_or_default();
                    let _ = socket.emit(
                        "process_details",
                        &json!({
                            "id": id,
                            "logs": logs,
                            "lastCrash": p.last_error_hint,
                        }),
                    );
                }
            },
        );

        socket.on(
            "update_config",
            |socket: SocketRef, Data::<DashboardConfig>(config)| async move {
                let persisted = DashboardConfigPersisted {
                    mode: config.mode.clone(),
                    webhook_url: config.webhook_url.clone().unwrap_or_default(),
                };
                persisted.save();
                let _ = socket.broadcast().emit("config_update", &config);
            },
        );

        socket.on(
            "apply_solution",
            |socket: SocketRef, Data::<ApplySolutionRequest>(request)| async move {
                let log_path = RuntimeStore::load_default()
                    .ok()
                    .and_then(|store| {
                        store
                            .find(&request.process_id)
                            .map(|p| p.log_path.clone())
                    })
                    .unwrap_or_else(|| {
                        let base = crate::store::state_dir()
                            .unwrap_or_else(|_| PathBuf::from("."));
                        base.join("logs").join(format!("{}.log", request.process_id))
                    });

                let _ = append_log(
                    &log_path,
                    &format!(
                        "[Zervox] Solution #{} selected: {}",
                        request.solution_id, request.solution.description
                    ),
                );

                // Emit the user-facing log
                let line = format!(
                    "[Zervox] Solution #{} selected: {}{}",
                    request.solution_id,
                    request.solution.description,
                    request
                        .solution
                        .command
                        .as_deref()
                        .map(|cmd| format!(" | suggested command: {cmd}"))
                        .unwrap_or_default()
                );
                let _ = socket.emit(
                    "log",
                    &json!({
                        "id": request.process_id,
                        "file": request.process_id,
                        "line": line
                    }),
                );

                // Actually run the fix command if one was suggested
                if let Some(command) = request.solution.command {
                    let log_path_clone = log_path.clone();
                    let pid = request.process_id.clone();
                    let proc_cwd = RuntimeStore::load_default()
                        .ok()
                        .and_then(|s| s.find(&request.process_id))
                        .and_then(|p| p.cwd);
                    tokio::spawn(async move {
                        let _ = append_log(
                            &log_path_clone,
                            &format!("[Zervox] Executing fix: {command}\n"),
                        );
                        let mut cmd = tokio::process::Command::new("sh");
                        cmd.arg("-c").arg(&command);
                        if let Some(ref dir) = proc_cwd {
                            let _ = append_log(
                                &log_path_clone,
                                &format!("[Zervox] fix cwd: {dir}\n"),
                            );
                            cmd.current_dir(dir);
                        }
                        match cmd.output().await
                        {
                            Ok(output) => {
                                let _ = append_log(
                                    &log_path_clone,
                                    &format!(
                                        "[Zervox] Fix exited status={}\n",
                                        output.status
                                    ),
                                );
                                if !output.stdout.is_empty() {
                                    let text = String::from_utf8_lossy(&output.stdout);
                                    for line in text.lines().take(20) {
                                        let _ = append_log(
                                            &log_path_clone,
                                            &format!("[Zervox] fix stdout: {line}\n"),
                                        );
                                    }
                                }
                                if !output.stderr.is_empty() {
                                    let text = String::from_utf8_lossy(&output.stderr);
                                    for line in text.lines().take(20) {
                                        let _ = append_log(
                                            &log_path_clone,
                                            &format!("[Zervox] fix stderr: {line}\n"),
                                        );
                                    }
                                }
                                let log = if output.status.success() {
                                    format!("[Zervox] Solution applied successfully for {pid}")
                                } else {
                                    format!(
                                        "[Zervox] Solution failed for {pid} (status={})",
                                        output.status
                                    )
                                };
                                let _ = append_log(&log_path_clone, &format!("{log}\n"));
                            }
                            Err(e) => {
                                let _ = append_log(
                                    &log_path_clone,
                                    &format!("[Zervox] Failed to execute fix: {e}\n"),
                                );
                            }
                        }
                    });
                }
            },
        );
    });

    println!("Starting web dashboard at http://127.0.0.1:{}", port);

    tokio::spawn(poll_state_changes(io_clone));

    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{port}"))
        .await?;

    // Graceful shutdown on SIGTERM / Ctrl+C
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = tokio::signal::ctrl_c();
    #[cfg(unix)]
    let mut term = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        .expect("failed to install SIGTERM handler");
    #[cfg(not(unix))]
    let term = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = term.recv() => {},
    }
    println!("Shutdown signal received, closing web server...");
}

async fn poll_state_changes(io: SocketIo) {
    let mut last_state = RuntimeStore::load_default().unwrap_or_else(|_| RuntimeStore {
        path: "".into(),
        processes: vec![],
    });

    loop {
        sleep(Duration::from_millis(1000)).await;
        if let Ok(current_state) = RuntimeStore::load_default() {
            for current_p in &current_state.processes {
                let prev_p = last_state.find(&current_p.name);

                let payload = ProcessPayload {
                    id: current_p.name.clone(),
                    file: current_p.command.first().cloned().unwrap_or_default(),
                    status: match current_p.status {
                        RuntimeStatus::Online => "online",
                        RuntimeStatus::Crashed => "crashed",
                        RuntimeStatus::Restarting => "restarting",
                        RuntimeStatus::Stopped => "stopped",
                        RuntimeStatus::Starting => "restarting",
                    }
                    .to_string(),
                    restarts: current_p.restarts,
                };

                if let Some(prev) = prev_p {
                    if prev.status != current_p.status || prev.restarts != current_p.restarts {
                        let _ = io.emit("process_update", &payload);

                        if current_p.status == RuntimeStatus::Crashed
                            && prev.status != RuntimeStatus::Crashed
                        {
                            tokio::spawn(trigger_ai_analysis(io.clone(), current_p.clone()));
                        }
                    }
                } else {
                    let _ = io.emit("process_new", &payload);
                }
            }
            last_state = current_state;
        }
    }
}

async fn trigger_ai_analysis(io: SocketIo, process: crate::runtime::RuntimeRecord) {
    let logs = supervisor::tail_log(&process.log_path, 50).unwrap_or_default();

    if let Ok(crash_data) = ai::analyze_crash(&process.name, logs).await {
        let _ = io.emit("crash", &crash_data);
    }

    // Send webhook if configured
    let cfg = DashboardConfigPersisted::load();
    if !cfg.webhook_url.is_empty() {
        let url = cfg.webhook_url;
        let payload = json!({
            "event": "crash",
            "process": process.name,
            "pid": process.supervisor_pid,
            "restarts": process.restarts,
        });
        tokio::spawn(async move {
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap_or_default();
            let _ = client.post(&url).json(&payload).send().await;
        });
    }
}

async fn analyze_incident(axum::Json(payload): axum::Json<crate::models::schema::IncidentInput>) -> axum::Json<serde_json::Value> {
    let incident_context = match crate::analysis::correlator::correlate_incident(&payload.metrics, &payload.logs) {
        Some(ctx) => ctx,
        None => return axum::Json(json!({"status": "healthy", "message": "No anomalies detected"})),
    };

    let recommendations = crate::recommend::engine::generate_recommendations(&incident_context);
    
    axum::Json(json!({
        "status": "incident_detected",
        "summary": incident_context.summary,
        "anomalies_count": incident_context.anomalies.len(),
        "errors_count": incident_context.error_logs.len(),
        "recommendations": recommendations
    }))
}

async fn grafana_webhook(axum::Json(payload): axum::Json<serde_json::Value>) -> axum::Json<serde_json::Value> {
    println!("[Zervox API] Received Grafana Webhook Alert");
    
    // Async worker queue pattern (spawn off main thread)
    tokio::spawn(async move {
        println!("[Background Worker] Processing Grafana webhook payload...");
        
        if let Ok(db) = crate::models::db::IncidentStore::new("zervox_incidents.db") {
            let summary = format!("Grafana Alert: {}", payload["title"].as_str().unwrap_or("Unknown Incident"));
            let _ = db.insert_incident(&summary, 1, 0);
            println!("[Background Worker] Persisted incident to DB.");
        }
    });

    axum::Json(json!({"status": "accepted"}))
}
