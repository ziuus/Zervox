# Zervox — AI Recovery Copilot for Production Systems

Zervox is an **AI-assisted production recovery agent** that helps engineers diagnose incidents, propose safe recovery options, execute after approval, and verify recovery.

It connects to existing infrastructure — process supervisors, logs, deployments — and gives you a copilot interface for incident response. Not another monitoring dashboard. Not an autonomous autopilot.

> **Current stage:** Foundation (process watchdog + rule-based diagnostics + web dashboard). The architecture is being built toward full observability integration and AI-assisted recovery planning.

→ [zervox.vercel.app](https://zervox.vercel.app)

---

## How It Works (Vision)

```
Applications / Servers / Kubernetes / Docker / PM2
        ↓
Logs + Metrics + Traces + Deployment Events
        ↓
OpenTelemetry / Prometheus / Grafana / Datadog / CloudWatch / ELK
        ↓
Zervox
        ↓
Diagnose incident → Propose recovery options
        ↓
Engineer reviews, modifies, or creates new plan
        ↓
Approval → Execute → Verify recovery → RCA summary
```

### Core Principles

- **Copilot, not autopilot** — Zervox discusses and proposes. Engineers decide and approve.
- **Integration-first** — connects to existing stacks (Grafana, Prometheus, Kubernetes, Jenkins, OpenTelemetry) instead of replacing them.
- **Safety as a feature** — actions are tiered by risk. Read-only is free. Execution requires approval.

---

## What Exists Now (v0.1)

The current build is a **single-binary process watchdog** for Node.js and shell commands:

```
zervox start --detach --name api -- node server.js
zervox status api
zervox logs api -n 50
zervox restart api
zervox stop api
```

| Capability | Status |
|---|---|
| Process supervision (PID tracking, restart limits, backoff) | ✅ |
| Crash detection with pattern-based diagnosis | ✅ |
| Web dashboard (real-time, Socket.IO) | ✅ |
| Systemd integration (generate user services) | ✅ |
| Auto-fix for missing dependencies (npm/bun/pnpm/yarn) | ✅ |
| Rule-based crash classification (port conflicts, permissions, syntax errors) | ✅ |
| CLI with status, logs, restart, detach | ✅ |
| Gemini AI–powered diagnostics | 🔜 |
| OpenTelemetry / Prometheus / Grafana integration | 🔜 |
| Kubernetes / Docker integration | 🔜 |
| Multi-option recovery proposals | 🔜 |
| Engineer-negotiated plan modification | 🔜 |
| Approval-based execution gates | 🔜 |
| Post-recovery verification | 🔜 |
| Incident / RCA summary generation | 🔜 |

---

## Quick Start

```bash
# Run a command once (check mode)
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

Zervox ships with a real-time web dashboard for monitoring processes, viewing logs, and applying suggested fixes.

```bash
zervox start --detach --name api -- node server.js
# Open http://localhost:4040
```

![Zervox Dashboard](public/screenshot.png)

> **Dashboard screenshot needed** — the interface exists and works. A screenshot will be added here after the next UI polish pass.

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

## Safety Model

Zervox is designed around a graduated risk model. This is the **target** safety model being built toward:

### Read-only (always allowed)
- Read logs, inspect metrics, check pod/process status
- Summarize incidents, explain root causes
- Simulate or preview recovery plans

### Requires approval
- Restart a service or process
- Rollback a deployment
- Scale replicas up or down
- Run shell scripts
- Change configuration
- Trigger a Jenkins job or CI/CD pipeline

### High-risk (restricted / require explicit escalation)
- Database mutations
- Secret or credential changes
- Resource deletion
- Infrastructure destruction (terraform destroy, etc.)
- Production code patch deployment

> **Current state:** The v0.1 watchdog already does read-only (status, logs) and medium-risk actions (restart, stop). Approval gates are being implemented in the next phase.

---

## Roadmap

```
Phase 1 (current)
  └─ Process watchdog + rule-based diagnostics + web dashboard

Phase 2
  ├─ Jenkins / GitHub Actions integration
  ├─ Deployment rollback support
  ├─ Approval-based execution gates
  └─ AI-driven root cause analysis (Gemini / local LLM)

Phase 3
  ├─ OpenTelemetry integration (traces + metrics)
  ├─ Prometheus / Grafana / Loki data sources
  ├─ Multi-option recovery proposals
  └─ Engineer-negotiated plan modification

Phase 4
  ├─ Kubernetes integration (pod health, deployments, scaling)
  ├─ Distributed tracing (Jaeger)
  └─ CloudWatch / ELK integration

Phase 5
  ├─ Slack / PagerDuty / Jira integrations
  ├─ Automated RCA generation
  └─ Post-incident summary
```

---

## Architecture (Current)

```
zervox/
├── src/
│   ├── bin/             # Entry point
│   ├── cli.rs           # CLI argument parsing (clap)
│   ├── monitor.rs       # Process execution + crash detection
│   ├── supervisor.rs    # Process lifecycle management
│   ├── autofix.rs       # Rule-based dependency repair
│   ├── web/             # Axum web server + Socket.IO
│   ├── runtime.rs       # Daemon state management
│   ├── store.rs         # Persistent state (JSON)
│   ├── config.rs        # Watch configuration
│   └── systemd.rs       # Systemd unit generation
├── public/              # Web dashboard frontend
├── scripts/             # Installer + demo scripts
└── docs/                # Documentation
```

---

## Build from source

```bash
cargo fmt --check
cargo test --all-targets
cargo clippy --all-targets --all-features -- -D warnings
cargo build --release
```

---

## Related

- [zervox.vercel.app](https://zervox.vercel.app) — web dashboard and docs
- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution guide
- [docs/](docs/) — additional documentation

---

## License

MIT — see [LICENSE](LICENSE).

Built with Rust, Axum, Socket.IO.
