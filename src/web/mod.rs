use crate::runtime::{RuntimeStatus, RuntimeStore};
use crate::supervisor;
use axum::Router;
use serde::{Deserialize, Serialize};
use serde_json::json;
use socketioxide::{extract::Data, extract::SocketRef, SocketIo};
use std::time::Duration;
use tokio::time::sleep;
use tower_http::services::ServeDir;

pub mod ai;

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

    // Serve static files from the public directory
    let app = Router::new()
        .fallback_service(ServeDir::new("public"))
        .layer(layer);

    // Initial state handler
    let io_clone = io.clone();
    io.ns("/", move |socket: SocketRef| async move {
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
        let _ = socket.emit(
            "config_update",
            &json!({ "mode": "INTERACTIVE", "webhookUrl": "" }),
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
                            "lastCrash": None::<serde_json::Value>
                        }),
                    );
                }
            },
        );

        socket.on(
            "update_config",
            |socket: SocketRef, Data::<DashboardConfig>(config)| async move {
                let _ = socket.broadcast().emit("config_update", &config);
            },
        );

        socket.on(
            "apply_solution",
            |socket: SocketRef, Data::<ApplySolutionRequest>(request)| async move {
                let line = format!(
                    "[Zervox] Solution #{} selected: {}{}",
                    request.solution_id,
                    request.solution.description,
                    request
                        .solution
                        .command
                        .as_deref()
                        .map(|command| format!(" | suggested command: {command}"))
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
            },
        );
    });

    println!("Starting web dashboard at http://127.0.0.1:{}", port);

    tokio::spawn(poll_state_changes(io_clone));

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    axum::serve(listener, app).await?;

    Ok(())
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
}
