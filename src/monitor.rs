use anyhow::{Context, Result};
use colored::Colorize;
use std::{
    io::{BufRead, BufReader},
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};
use time::OffsetDateTime;

use crate::config::WatchConfig;

#[derive(Debug, Clone, Copy)]
pub struct WatchOptions {
    pub capture_lines: usize,
}

impl Default for WatchOptions {
    fn default() -> Self {
        Self { capture_lines: 80 }
    }
}

pub fn run_once(config: WatchConfig) -> Result<()> {
    let options = WatchOptions::default();
    let mut attempt = 0;

    loop {
        let result = run_child(&config, options)?;
        if result.success {
            println!("{} command exited cleanly", "✓".green());
            return Ok(());
        }

        print_crash_summary(&config.command, result.code, &result.recent_lines);

        if attempt >= config.max_restarts {
            anyhow::bail!("command failed after {} restart attempt(s)", attempt);
        }

        attempt += 1;
        println!(
            "{} restarting in {}s ({}/{})",
            "↻".yellow(),
            config.restart_delay,
            attempt,
            config.max_restarts
        );
        thread::sleep(Duration::from_secs(config.restart_delay));
    }
}

#[derive(Debug)]
struct RunResult {
    success: bool,
    code: Option<i32>,
    recent_lines: Vec<String>,
}

fn run_child(config: &WatchConfig, options: WatchOptions) -> Result<RunResult> {
    let (program, args) = config.command.split_first().context("empty command")?;
    println!("{} {}", "▶".cyan(), config.command.join(" ").bold());

    let mut command = Command::new(program);
    command
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(cwd) = &config.cwd {
        command.current_dir(cwd);
    }

    let mut child = command
        .spawn()
        .with_context(|| format!("failed to spawn `{}`", config.command.join(" ")))?;
    let stdout = child.stdout.take().context("failed to capture stdout")?;
    let stderr = child.stderr.take().context("failed to capture stderr")?;
    let recent = Arc::new(Mutex::new(Vec::<String>::new()));

    let out_recent = Arc::clone(&recent);
    let out_handle =
        thread::spawn(move || stream_lines(stdout, false, out_recent, options.capture_lines));

    let err_recent = Arc::clone(&recent);
    let err_handle =
        thread::spawn(move || stream_lines(stderr, true, err_recent, options.capture_lines));

    let status = child.wait().context("failed to wait for child process")?;
    let _ = out_handle.join();
    let _ = err_handle.join();

    let lines = recent.lock().expect("recent log lock poisoned").clone();
    Ok(RunResult {
        success: status.success(),
        code: status.code(),
        recent_lines: lines,
    })
}

fn stream_lines<R: std::io::Read>(
    reader: R,
    is_err: bool,
    recent: Arc<Mutex<Vec<String>>>,
    limit: usize,
) {
    let reader = BufReader::new(reader);
    for line in reader.lines().map_while(Result::ok) {
        let stamped = format!("{} {}", timestamp(), line);
        if is_err {
            eprintln!("{} {}", "stderr".red(), line);
        } else {
            println!("{} {}", "stdout".dimmed(), line);
        }
        let mut lock = recent.lock().expect("recent log lock poisoned");
        lock.push(stamped);
        let overflow = lock.len().saturating_sub(limit);
        if overflow > 0 {
            lock.drain(0..overflow);
        }
    }
}

fn timestamp() -> String {
    let now = OffsetDateTime::now_local().unwrap_or_else(|_| OffsetDateTime::now_utc());
    now.format(&time::macros::format_description!(
        "[hour]:[minute]:[second]"
    ))
    .unwrap_or_else(|_| "00:00:00".into())
}

fn print_crash_summary(command: &[String], code: Option<i32>, recent_lines: &[String]) {
    eprintln!("\n{}", "Crash detected".on_red().white().bold());
    eprintln!("command: {}", command.join(" ").bold());
    eprintln!(
        "exit code: {}",
        code.map(|c| c.to_string())
            .unwrap_or_else(|| "signal/unknown".into())
            .yellow()
    );

    if let Some(hint) = classify_failure(recent_lines) {
        eprintln!("hint: {}", hint.cyan());
    }

    if !recent_lines.is_empty() {
        eprintln!("\n{}", "recent output".bold());
        for line in recent_lines
            .iter()
            .rev()
            .take(12)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
        {
            eprintln!("  {line}");
        }
    }
    eprintln!();
}

fn classify_failure(lines: &[String]) -> Option<&'static str> {
    let joined = lines.join("\n").to_lowercase();
    if joined.contains("eaddrinuse") || joined.contains("address already in use") {
        Some("port conflict detected. Stop the existing process or change PORT.")
    } else if joined.contains("cannot find module") || joined.contains("module_not_found") {
        Some("missing dependency or wrong entry path. Try reinstalling deps or checking imports.")
    } else if joined.contains("permission denied") || joined.contains("eacces") {
        Some("permission issue detected. Check file permissions or privileged port usage.")
    } else if joined.contains("syntaxerror") {
        Some("syntax error detected. Check the file and line shown above.")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::classify_failure;

    #[test]
    fn classifies_common_node_errors() {
        assert!(
            classify_failure(&["Error: listen EADDRINUSE: address already in use".into()])
                .unwrap()
                .contains("port")
        );
        assert!(
            classify_failure(&["Error: Cannot find module 'express'".into()])
                .unwrap()
                .contains("missing")
        );
        assert!(classify_failure(&["SyntaxError: Unexpected token".into()])
            .unwrap()
            .contains("syntax"));
    }
}
