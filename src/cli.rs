use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use colored::Colorize;

use crate::config::WatchConfig;
use crate::monitor::run_once;
use crate::runtime::RuntimeStore;
use crate::store::{state_dir, ProcessRecord, Store};
use crate::supervisor::{
    print_runtime_status, spawn_detached_supervisor, stop_runtime, supervise, tail_log,
};
use crate::systemd::{generate_user_service, install_user_service};

#[derive(Parser, Debug)]
#[command(name = "zervox")]
#[command(version)]
#[command(about = "A Rust watchdog for Node.js apps and long-running commands")]
pub struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Start a command. Use --detach for production-style background supervision.
    Start {
        command: Vec<String>,
        #[arg(long, default_value_t = 3)]
        max_restarts: u32,
        #[arg(long, default_value_t = 1)]
        restart_delay: u64,
        #[arg(long)]
        cwd: Option<String>,
        #[arg(long)]
        name: Option<String>,
        /// Run as a background supervisor and record PID/status/logs.
        #[arg(long)]
        detach: bool,
    },

    /// Run a command once and print a crash summary if it fails.
    Check {
        command: Vec<String>,
        #[arg(long)]
        cwd: Option<String>,
    },

    /// Add a command to the local Zervox state file.
    Add {
        name: String,
        command: Vec<String>,
        #[arg(long)]
        cwd: Option<String>,
        #[arg(long, default_value_t = 3)]
        max_restarts: u32,
    },

    /// List tracked commands.
    List,
    /// Remove a tracked command from config state.
    Remove { name: String },
    /// Run a tracked command in the foreground.
    Run { name: String },
    /// Start a tracked command as a detached supervisor.
    Up { name: String },
    /// Stop a detached supervised process.
    Stop { name: String },
    /// Restart a detached supervised process.
    Restart { name: String },
    /// Show runtime status for all processes or one process.
    Status { name: Option<String> },
    /// Tail persistent logs for a supervised process.
    Logs {
        name: String,
        #[arg(short = 'n', long, default_value_t = 80)]
        lines: usize,
    },
    /// Generate or install a user-level systemd service for a tracked command.
    Systemd {
        name: String,
        #[arg(long)]
        install: bool,
    },
    /// Remove stopped runtime records and mark stale PIDs.
    Cleanup,
    /// Internal command used by detached supervisors.
    #[command(hide = true)]
    Supervise { name: String, config_json: String },
    /// Print Zervox state locations.
    Doctor,
}

pub fn run() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Start {
            command,
            max_restarts,
            restart_delay,
            cwd,
            name,
            detach,
        } => {
            let command = normalize_command(command)?;
            let config = WatchConfig {
                command: command.clone(),
                cwd: cwd.clone(),
                max_restarts,
                restart_delay,
            };
            if detach {
                let name = name.context("--detach requires --name <name>")?;
                let mut store = Store::load_default()?;
                store.upsert(ProcessRecord::new(name.clone(), command, cwd, max_restarts));
                store.save()?;
                let pid = spawn_detached_supervisor(&name, &config)?;
                println!(
                    "{} started '{}' supervisor pid={}",
                    "✓".green(),
                    name.bold(),
                    pid
                );
                return Ok(());
            }
            if let Some(name) = name {
                let mut store = Store::load_default()?;
                store.upsert(ProcessRecord::new(
                    name,
                    command.clone(),
                    cwd.clone(),
                    max_restarts,
                ));
                store.save()?;
            }
            run_once(config)
        }
        Commands::Check { command, cwd } => run_once(WatchConfig {
            command: normalize_command(command)?,
            cwd,
            max_restarts: 0,
            restart_delay: 0,
        }),
        Commands::Add {
            name,
            command,
            cwd,
            max_restarts,
        } => {
            let command = normalize_command(command)?;
            let mut store = Store::load_default()?;
            store.upsert(ProcessRecord::new(name.clone(), command, cwd, max_restarts));
            store.save()?;
            println!("{} tracked command '{}'", "✓".green(), name.bold());
            Ok(())
        }
        Commands::List => list_tracked(),
        Commands::Remove { name } => {
            let mut store = Store::load_default()?;
            if store.remove(&name) {
                store.save()?;
                println!("{} removed '{}'", "✓".green(), name.bold());
            } else {
                println!("{} no tracked command named '{}'", "!".yellow(), name);
            }
            Ok(())
        }
        Commands::Run { name } => {
            let record = Store::load_default()?
                .find(&name)
                .with_context(|| format!("no tracked command named '{name}'"))?;
            run_once(WatchConfig {
                command: record.command,
                cwd: record.cwd,
                max_restarts: record.max_restarts,
                restart_delay: 1,
            })
        }
        Commands::Up { name } => {
            let record = Store::load_default()?
                .find(&name)
                .with_context(|| format!("no tracked command named '{name}'"))?;
            let config = WatchConfig {
                command: record.command,
                cwd: record.cwd,
                max_restarts: record.max_restarts,
                restart_delay: 1,
            };
            let pid = spawn_detached_supervisor(&name, &config)?;
            println!(
                "{} started '{}' supervisor pid={}",
                "✓".green(),
                name.bold(),
                pid
            );
            Ok(())
        }
        Commands::Stop { name } => {
            stop_runtime(&name)?;
            println!("{} stopped '{}'", "✓".green(), name.bold());
            Ok(())
        }
        Commands::Restart { name } => {
            let record = Store::load_default()?
                .find(&name)
                .with_context(|| format!("no tracked command named '{name}'"))?;
            let _ = stop_runtime(&name);
            let config = WatchConfig {
                command: record.command,
                cwd: record.cwd,
                max_restarts: record.max_restarts,
                restart_delay: 1,
            };
            let pid = spawn_detached_supervisor(&name, &config)?;
            println!(
                "{} restarted '{}' supervisor pid={}",
                "✓".green(),
                name.bold(),
                pid
            );
            Ok(())
        }
        Commands::Status { name } => {
            let mut store = RuntimeStore::load_default()?;
            let _ = store.reconcile_stale_processes()?;
            if let Some(name) = name {
                let record = store
                    .find(&name)
                    .with_context(|| format!("no runtime process named '{name}'"))?;
                print_runtime_status(&record);
            } else if store.processes.is_empty() {
                println!("No runtime processes. Use `zervox start --detach --name api -- node server.js`.");
            } else {
                for record in &store.processes {
                    print_runtime_status(record);
                }
            }
            Ok(())
        }
        Commands::Systemd { name, install } => {
            if install {
                let path = install_user_service(&name)?;
                println!("{} installed {}", "✓".green(), path.display());
                println!("enable: systemctl --user enable --now zervox-{name}.service");
            } else {
                print!("{}", generate_user_service(&name)?);
            }
            Ok(())
        }
        Commands::Cleanup => {
            let mut store = RuntimeStore::load_default()?;
            let _ = store.reconcile_stale_processes()?;
            let removed = store.prune_stopped()?;
            println!(
                "{} removed {removed} stopped runtime record(s)",
                "✓".green()
            );
            Ok(())
        }
        Commands::Logs { name, lines } => {
            let record = RuntimeStore::load_default()?
                .find(&name)
                .with_context(|| format!("no runtime process named '{name}'"))?;
            for line in tail_log(&record.log_path, lines)? {
                println!("{line}");
            }
            Ok(())
        }
        Commands::Supervise { name, config_json } => {
            supervise(name, serde_json::from_str(&config_json)?)
        }
        Commands::Doctor => {
            let store = Store::load_default()?;
            println!("config: {}", store.path.display());
            println!("state: {}", state_dir()?.display());
            println!("tracked: {}", store.processes.len());
            println!("tip: zervox start --detach --name api -- node server.js");
            Ok(())
        }
    }
}

fn list_tracked() -> Result<()> {
    let store = Store::load_default()?;
    if store.processes.is_empty() {
        println!("No tracked commands yet. Use: zervox add <name> -- <command>");
        return Ok(());
    }
    println!("{}", "Tracked commands".bold());
    for p in store.processes {
        println!(
            "- {}  {}  restarts={} cwd={}",
            p.name.cyan(),
            p.command.join(" "),
            p.max_restarts,
            p.cwd.unwrap_or_else(|| ".".into())
        );
    }
    Ok(())
}

fn normalize_command(parts: Vec<String>) -> Result<Vec<String>> {
    if parts.is_empty() {
        anyhow::bail!("missing command. Use `--` before commands with flags, e.g. zervox start -- npm run dev");
    }
    if parts.len() == 1 && parts[0].ends_with(".js") {
        return Ok(vec!["node".into(), parts[0].clone()]);
    }
    Ok(parts)
}
