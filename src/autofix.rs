use anyhow::{Context, Result};
use serde_json::Value;
use std::{path::PathBuf, process::Command};

use crate::supervisor::append_log;

pub fn run_auto_fix(
    process_name: &str,
    cwd: Option<&str>,
    recent_lines: &[String],
    log_path: &PathBuf,
) -> Result<()> {
    append_log(
        log_path,
        &format!("[Zervox auto-fix] checking '{process_name}' for safe repairs\n"),
    )?;

    let Some(cwd) = cwd else {
        append_log(
            log_path,
            "[Zervox auto-fix] skipped: --cwd is required for project repairs\n",
        )?;
        return Ok(());
    };

    let project_dir = PathBuf::from(cwd);
    let package_json_path = project_dir.join("package.json");
    if !package_json_path.exists() {
        append_log(
            log_path,
            "[Zervox auto-fix] skipped: package.json not found in cwd\n",
        )?;
        return Ok(());
    }

    let logs = recent_lines.join("\n");
    let missing_package = extract_missing_package(&logs);
    let dependency_related = is_dependency_related(&logs);

    if !dependency_related && missing_package.is_none() {
        append_log(
            log_path,
            "[Zervox auto-fix] skipped: crash does not look like a dependency install issue\n",
        )?;
        return Ok(());
    }

    if let Some(package) = &missing_package {
        if !is_declared_dependency(&package_json_path, package)? {
            append_log(
                log_path,
                &format!(
                    "[Zervox auto-fix] skipped: missing package '{package}' is not declared in package.json\n"
                ),
            )?;
            return Ok(());
        }
    } else if project_dir.join("node_modules").exists() {
        append_log(
            log_path,
            "[Zervox auto-fix] skipped: node_modules exists and no declared missing package was found\n",
        )?;
        return Ok(());
    }

    let install = detect_install_command(&project_dir);
    append_log(
        log_path,
        &format!(
            "[Zervox auto-fix] running safe repair: {} {}\n",
            install.program,
            install.args.join(" ")
        ),
    )?;

    let output = Command::new(&install.program)
        .args(&install.args)
        .current_dir(&project_dir)
        .output()
        .with_context(|| format!("failed to run {}", install.program))?;

    append_log(
        log_path,
        &format!("[Zervox auto-fix] repair exited status={}\n", output.status),
    )?;
    log_output(log_path, "stdout", &output.stdout)?;
    log_output(log_path, "stderr", &output.stderr)?;
    Ok(())
}

struct InstallCommand {
    program: &'static str,
    args: Vec<&'static str>,
}

fn detect_install_command(project_dir: &std::path::Path) -> InstallCommand {
    if project_dir.join("bun.lockb").exists() || project_dir.join("bun.lock").exists() {
        return InstallCommand {
            program: "bun",
            args: vec!["install"],
        };
    }
    if project_dir.join("pnpm-lock.yaml").exists() {
        return InstallCommand {
            program: "pnpm",
            args: vec!["install"],
        };
    }
    if project_dir.join("yarn.lock").exists() {
        return InstallCommand {
            program: "yarn",
            args: vec!["install"],
        };
    }
    InstallCommand {
        program: "npm",
        args: vec!["install"],
    }
}

fn is_dependency_related(logs: &str) -> bool {
    let lower = logs.to_ascii_lowercase();
    lower.contains("cannot find module")
        || lower.contains("module not found")
        || lower.contains("err_module_not_found")
        || lower.contains("cannot find package")
        || lower.contains("could not resolve")
}

fn extract_missing_package(logs: &str) -> Option<String> {
    let patterns = [
        "Cannot find module '",
        "Cannot find package '",
        "Module not found: Can't resolve '",
        "Could not resolve \"",
    ];

    for pattern in patterns {
        if let Some(start) = logs.find(pattern) {
            let rest = &logs[start + pattern.len()..];
            let quote = if pattern.ends_with('"') { '"' } else { '\'' };
            if let Some(end) = rest.find(quote) {
                let package = normalize_package_name(&rest[..end]);
                if !package.is_empty() {
                    return Some(package);
                }
            }
        }
    }
    None
}

fn normalize_package_name(raw: &str) -> String {
    if raw.starts_with('.') || raw.starts_with('/') {
        return String::new();
    }
    let mut parts = raw.split('/');
    let Some(first) = parts.next() else {
        return String::new();
    };
    if first.starts_with('@') {
        if let Some(second) = parts.next() {
            return format!("{first}/{second}");
        }
        return String::new();
    }
    first.to_string()
}

fn is_declared_dependency(package_json_path: &std::path::Path, package: &str) -> Result<bool> {
    let text = std::fs::read_to_string(package_json_path)
        .with_context(|| format!("failed to read {}", package_json_path.display()))?;
    let json: Value = serde_json::from_str(&text)
        .with_context(|| format!("failed to parse {}", package_json_path.display()))?;
    let sections = [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
    ];
    Ok(sections.iter().any(|section| {
        json.get(section)
            .and_then(Value::as_object)
            .is_some_and(|deps| deps.contains_key(package))
    }))
}

fn log_output(log_path: &PathBuf, stream: &str, bytes: &[u8]) -> Result<()> {
    let text = String::from_utf8_lossy(bytes);
    for line in text.lines().take(40) {
        append_log(log_path, &format!("[Zervox auto-fix] {stream}: {line}\n"))?;
    }
    Ok(())
}
