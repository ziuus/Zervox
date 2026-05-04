use std::{process::Command, thread, time::Duration};

fn zervox() -> Command {
    Command::new(env!("CARGO_BIN_EXE_zervox"))
}

fn isolated() -> tempfile::TempDir {
    tempfile::tempdir().expect("tempdir")
}

fn with_home<'a>(cmd: &'a mut Command, dir: &tempfile::TempDir) -> &'a mut Command {
    cmd.env("XDG_CONFIG_HOME", dir.path().join("config"))
        .env("XDG_STATE_HOME", dir.path().join("state"))
}

#[test]
fn add_list_and_generate_systemd_unit() {
    let dir = isolated();

    let status = with_home(
        zervox()
            .arg("add")
            .arg("api")
            .arg("--")
            .arg("node")
            .arg("server.js"),
        &dir,
    )
    .status()
    .expect("add command");
    assert!(status.success());

    let output = with_home(zervox().arg("list"), &dir)
        .output()
        .expect("list command");
    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("api"));
    assert!(stdout.contains("node server.js"));

    let output = with_home(zervox().arg("systemd").arg("api"), &dir)
        .output()
        .expect("systemd command");
    assert!(output.status.success());
    let unit = String::from_utf8_lossy(&output.stdout);
    assert!(unit.contains("Description=Zervox watchdog for api"));
    assert!(unit.contains("ExecStart="));
}

#[test]
fn detached_process_has_status_logs_and_can_stop() {
    let dir = isolated();

    let status = with_home(
        zervox()
            .arg("start")
            .arg("--detach")
            .arg("--name")
            .arg("smoke")
            .arg("--max-restarts")
            .arg("1")
            .arg("--")
            .arg("node")
            .arg("-e")
            .arg("setInterval(()=>console.log('tick'), 100)"),
        &dir,
    )
    .status()
    .expect("start detached");
    assert!(status.success());

    thread::sleep(Duration::from_millis(500));

    let output = with_home(zervox().arg("status").arg("smoke"), &dir)
        .output()
        .expect("status command");
    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("smoke"));
    assert!(stdout.contains("Online") || stdout.contains("Starting"));

    let output = with_home(zervox().arg("logs").arg("smoke").arg("-n").arg("5"), &dir)
        .output()
        .expect("logs command");
    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("tick") || stdout.contains("starting child"));

    let status = with_home(zervox().arg("stop").arg("smoke"), &dir)
        .status()
        .expect("stop command");
    assert!(status.success());
}
