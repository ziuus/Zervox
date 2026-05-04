use anyhow::{Context, Result};
use colored::Colorize;
use nix::sys::signal::{kill, Signal};
use nix::unistd::Pid;
use std::{
    fs::{File, OpenOptions},
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};
use time::OffsetDateTime;

use crate::{
    config::WatchConfig,
    monitor::classify_failure_text,
    runtime::{runtime_log_path, RuntimeRecord, RuntimeStatus, RuntimeStore},
};

pub fn spawn_detached_supervisor(name: &str, config: &WatchConfig) -> Result<u32> {
    let exe = std::env::current_exe().context("failed to locate current executable")?;
    let encoded = serde_json::to_string(config)?;
    let child = Command::new(exe)
        .arg("supervise")
        .arg(name)
        .arg(encoded)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .context("failed to spawn detached supervisor")?;
    Ok(child.id())
}

pub fn supervise(name: String, config: WatchConfig) -> Result<()> {
    let log_path = runtime_log_path(&name)?;
    let mut store = RuntimeStore::load_default()?;
    store.upsert(RuntimeRecord::new(
        name.clone(),
        std::process::id(),
        config.command.clone(),
        config.cwd.clone(),
        config.max_restarts,
        log_path.clone(),
    ));
    store.save()?;

    append_log(
        &log_path,
        &format!(
            "zervox supervisor started pid={} command={}\n",
            std::process::id(),
            config.command.join(" ")
        ),
    )?;

    let mut attempts = 0;
    loop {
        let result = run_child_logged(&name, &config, &log_path)?;
        if result.success {
            RuntimeStore::load_default()?.update(&name, |r| {
                r.status = RuntimeStatus::Stopped;
                r.child_pid = None;
                r.last_exit_code = result.code;
                r.last_error_hint = None;
            })?;
            append_log(&log_path, "child exited cleanly; supervisor stopping\n")?;
            return Ok(());
        }

        let hint = classify_failure_text(&result.recent_lines.join("\n")).map(ToString::to_string);
        RuntimeStore::load_default()?.update(&name, |r| {
            r.status = RuntimeStatus::Crashed;
            r.child_pid = None;
            r.last_exit_code = result.code;
            r.last_error_hint = hint.clone();
        })?;

        if attempts >= config.max_restarts {
            append_log(
                &log_path,
                &format!("restart limit reached ({attempts}); supervisor stopping\n"),
            )?;
            return Ok(());
        }

        attempts += 1;
        let delay = backoff(config.restart_delay, attempts);
        RuntimeStore::load_default()?.update(&name, |r| {
            r.status = RuntimeStatus::Restarting;
            r.restarts = attempts;
        })?;
        append_log(
            &log_path,
            &format!(
                "restarting in {delay}s attempt={attempts}/{}\n",
                config.max_restarts
            ),
        )?;
        thread::sleep(Duration::from_secs(delay));
    }
}

pub fn stop_runtime(name: &str) -> Result<()> {
    let mut store = RuntimeStore::load_default()?;
    let record = store
        .find(name)
        .with_context(|| format!("no runtime process named '{name}'"))?;
    if let Some(pid) = record.child_pid {
        let _ = kill(Pid::from_raw(pid as i32), Signal::SIGTERM);
    }
    let _ = kill(Pid::from_raw(record.supervisor_pid as i32), Signal::SIGTERM);
    store.update(name, |r| {
        r.status = RuntimeStatus::Stopped;
        r.child_pid = None;
    })?;
    Ok(())
}

#[derive(Debug)]
struct ChildResult {
    success: bool,
    code: Option<i32>,
    recent_lines: Vec<String>,
}

fn run_child_logged(name: &str, config: &WatchConfig, log_path: &PathBuf) -> Result<ChildResult> {
    let (program, args) = config.command.split_first().context("empty command")?;
    let mut command = Command::new(program);
    command
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(cwd) = &config.cwd {
        command.current_dir(cwd);
    }

    append_log(
        log_path,
        &format!("starting child: {}\n", config.command.join(" ")),
    )?;
    let mut child = command
        .spawn()
        .with_context(|| format!("failed to spawn {}", config.command.join(" ")))?;
    RuntimeStore::load_default()?.update(name, |r| {
        r.status = RuntimeStatus::Online;
        r.child_pid = Some(child.id());
    })?;

    let recent = Arc::new(Mutex::new(Vec::<String>::new()));
    let out = child.stdout.take().context("failed to capture stdout")?;
    let err = child.stderr.take().context("failed to capture stderr")?;
    let log1 = log_path.clone();
    let recent1 = Arc::clone(&recent);
    let h1 = thread::spawn(move || stream_to_log(out, "stdout", log1, recent1));
    let log2 = log_path.clone();
    let recent2 = Arc::clone(&recent);
    let h2 = thread::spawn(move || stream_to_log(err, "stderr", log2, recent2));
    let status = child.wait().context("failed to wait for child")?;
    let _ = h1.join();
    let _ = h2.join();
    append_log(
        log_path,
        &format!("child exited code={:?}\n", status.code()),
    )?;
    let recent_lines = recent.lock().expect("recent log lock poisoned").clone();
    Ok(ChildResult {
        success: status.success(),
        code: status.code(),
        recent_lines,
    })
}

fn stream_to_log<R: std::io::Read>(
    reader: R,
    stream: &str,
    log_path: PathBuf,
    recent: Arc<Mutex<Vec<String>>>,
) {
    for line in BufReader::new(reader).lines().map_while(Result::ok) {
        let stamped = format!("{} {stream} {line}", timestamp());
        let _ = append_log(&log_path, &(stamped.clone() + "\n"));
        let mut lock = recent.lock().expect("recent log lock poisoned");
        lock.push(stamped);
        let overflow = lock.len().saturating_sub(120);
        if overflow > 0 {
            lock.drain(0..overflow);
        }
    }
}

pub fn append_log(path: &PathBuf, line: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    file.write_all(line.as_bytes())?;
    Ok(())
}

pub fn tail_log(path: &PathBuf, lines: usize) -> Result<Vec<String>> {
    let file = File::open(path).with_context(|| format!("failed to open {}", path.display()))?;
    let all: Vec<String> = BufReader::new(file).lines().map_while(Result::ok).collect();
    Ok(all
        .into_iter()
        .rev()
        .take(lines)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect())
}

fn timestamp() -> String {
    OffsetDateTime::now_utc()
        .format(&time::macros::format_description!(
            "[year]-[month]-[day]T[hour]:[minute]:[second]Z"
        ))
        .unwrap_or_else(|_| "time-error".into())
}
fn backoff(base: u64, attempt: u32) -> u64 {
    (base.max(1) * 2_u64.saturating_pow(attempt.saturating_sub(1))).min(30)
}

pub fn print_runtime_status(record: &RuntimeRecord) {
    println!(
        "{} {:?} supervisor={} child={:?} restarts={}/{}",
        record.name.cyan(),
        record.status,
        record.supervisor_pid,
        record.child_pid,
        record.restarts,
        record.max_restarts
    );
    println!("  command: {}", record.command.join(" "));
    println!("  log: {}", record.log_path.display());
    if let Some(hint) = &record.last_error_hint {
        println!("  hint: {}", hint.yellow());
    }
}
