use anyhow::{Context, Result};
use std::path::PathBuf;

use crate::config::WatchConfig;
use crate::store::Store;

pub fn generate_user_service(name: &str) -> Result<String> {
    let record = Store::load_default()?
        .find(name)
        .with_context(|| format!("no tracked command named '{name}'"))?;
    let exe = std::env::current_exe().context("failed to locate zervox executable")?;
    let config = WatchConfig {
        command: record.command,
        cwd: record.cwd,
        max_restarts: record.max_restarts,
        restart_delay: 1,
    };
    let config_json = serde_json::to_string(&config)?;
    let escaped = shell_escape(&config_json);

    Ok(format!(
        r#"[Unit]
Description=Zervox watchdog for {name}
After=network.target

[Service]
Type=simple
ExecStart={exe} supervise {name} {escaped}
Restart=always
RestartSec=3
KillSignal=SIGTERM

[Install]
WantedBy=default.target
"#,
        exe = exe.display()
    ))
}

pub fn user_service_path(name: &str) -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("systemd")
        .join("user")
        .join(format!("zervox-{name}.service"))
}

pub fn install_user_service(name: &str) -> Result<PathBuf> {
    let unit = generate_user_service(name)?;
    let path = user_service_path(name);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, unit)?;
    Ok(path)
}

fn shell_escape(input: &str) -> String {
    format!("'{}'", input.replace('\'', "'\\''"))
}

#[cfg(test)]
mod tests {
    use super::shell_escape;

    #[test]
    fn escapes_single_quotes_for_shell() {
        assert_eq!(shell_escape("a'b"), "'a'\\''b'");
    }
}
