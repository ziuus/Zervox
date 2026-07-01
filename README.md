# Zervox

**Autonomous SRE. Unmatched Scale.**

Zervox is a next-generation SRE daemon that detects crashes, analyzes root causes with Gemini AI, and executes fixes autonomously.

- **Auto-Fix Loop** — Autonomous crash detection and AI-powered repair cycles that heal your apps in seconds.
- **Global Daemon** — Manage a swarm of processes across multiple environments with a single unified interface.
- **Visual Insights** — Minimalist dashboard designed for high cognitive fluency and rapid incident response.

→ [zervox.vercel.app](https://zervox.vercel.app)

---

## Features

- **AI-Powered Diagnostics** — When a crash occurs, Zervox analyzes logs via Gemini AI, identifies root causes, and suggests precise fix commands.
- **Auto-Fix Dependency Issues** — Scans crash logs for `Cannot find module` patterns, detects missing packages, and runs the correct install command.
- **Process Supervision** — Track PIDs, persistent logs, restart limits, and exponential backoff for every process.
- **Real-Time Dashboard** — Web-based dashboard with Socket.IO live updates. View process status, tail logs, and apply AI-suggested fixes with one click.
- **Systemd Integration** — Generate systemd user services from any tracked process. Survive reboots and crashes transparently.
- **7KB Binary in Rust** — Single lean binary with zero runtime dependencies. Installs in seconds.

---

## Quick Start

```bash
# Run a command once
zervox check -- node server.js

# Foreground watchdog with auto-restart
zervox start --max-restarts 5 -- node server.js

# Background daemon
zervox start --detach --name api -- node server.js

# Inspect and control
zervox status api
zervox logs api -n 50
zervox restart api
zervox stop api
```

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/ziuus/Zervox/master/scripts/install.sh | bash
```

Or build from source:

```bash
cargo build --release
./target/release/zervox
```

---

## Web Dashboard

Zervox ships with a real-time web dashboard for monitoring processes, viewing logs, and applying AI-suggested fixes. Open it after starting the daemon:

```
http://localhost:4040
```

---

## Documentation

Comprehensive guides on setting up autonomous agents, fine-tuning repair strategies, and scaling your SRE operations:

- [Getting Started](https://zervox.vercel.app/#/docs)
- [CLI Reference](https://zervox.vercel.app/#/docs)
- [Configuration](https://zervox.vercel.app/#/docs)

---

## CLI Reference

| Command | Description |
|---|---|
| `zervox check -- <cmd>` | Run once and summarize failures |
| `zervox start -- <cmd>` | Foreground watchdog with restart limit |
| `zervox start --detach --name <n> -- <cmd>` | Background supervisor |
| `zervox add <name> -- <cmd>` | Save a command locally |
| `zervox up <name>` | Start a saved command in detached mode |
| `zervox status [name]` | Show runtime status, PID, restarts, log path |
| `zervox logs <name>` | Tail persistent logs |
| `zervox stop <name>` | Stop supervisor and child process |
| `zervox restart <name>` | Restart a saved supervised process |
| `zervox systemd <name>` | Generate a systemd unit for a tracked command |
| `zervox list` | List all tracked commands |

---

## Runtime Files

| Path | Purpose |
|---|---|
| `~/.config/zervox/processes.json` | Saved command definitions |
| `~/.local/state/zervox/runtime.json` | Active supervisor state |
| `~/.local/state/zervox/logs/<name>.log` | Per-process logs |

Use `zervox doctor` to print the exact paths on your machine.

---

## Build from source

```bash
cargo fmt --check
cargo test --all-targets
cargo clippy --all-targets --all-features -- -D warnings
cargo build --release
```

---

## License

MIT — see [LICENSE](LICENSE).

Built with Rust, Actix-Web, Axum, Gemini AI.
