use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use colored::Colorize;

use crate::config::WatchConfig;
use crate::monitor::{run_once, WatchOptions};
use crate::store::{ProcessRecord, Store};

#[derive(Parser, Debug)]
#[command(name = "zervox")]
#[command(version)]
#[command(about = "A tiny Rust watchdog for Node.js apps and long-running commands")]
pub struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Start a command and restart it when it crashes.
    Start {
        /// Command to run. Examples: server.js, "npm run dev", "python app.py".
        command: Vec<String>,

        /// Maximum restart attempts before Zervox gives up.
        #[arg(long, default_value_t = 3)]
        max_restarts: u32,

        /// Seconds to wait before restarting.
        #[arg(long, default_value_t = 1)]
        restart_delay: u64,

        /// Working directory for the child process.
        #[arg(long)]
        cwd: Option<String>,

        /// Track the command in Zervox state before running.
        #[arg(long)]
        name: Option<String>,
    },

    /// Run a command once and print a crash summary if it fails.
    Check {
        /// Command to run once.
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

    /// Remove a tracked command from state.
    Remove { name: String },

    /// Run a tracked command by name.
    Run { name: String },

    /// Print Zervox state file location.
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
        } => {
            let command = normalize_command(command)?;
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
            run_once(WatchConfig {
                command,
                cwd,
                max_restarts,
                restart_delay,
            })
        }
        Commands::Check { command, cwd } => {
            let command = normalize_command(command)?;
            run_once(WatchConfig {
                command,
                cwd,
                max_restarts: 0,
                restart_delay: 0,
            })
        }
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
        Commands::List => {
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
            let store = Store::load_default()?;
            let record = store
                .find(&name)
                .with_context(|| format!("no tracked command named '{name}'"))?;
            run_once(WatchConfig {
                command: record.command,
                cwd: record.cwd,
                max_restarts: record.max_restarts,
                restart_delay: 1,
            })
        }
        Commands::Doctor => {
            let store = Store::load_default()?;
            println!("state: {}", store.path.display());
            println!("tracked: {}", store.processes.len());
            println!("tip: use `zervox start --max-restarts 5 -- node server.js`");
            Ok(())
        }
    }
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

#[allow(dead_code)]
fn _watch_options_for_future_api() -> WatchOptions {
    WatchOptions { capture_lines: 80 }
}
