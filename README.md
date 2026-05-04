# Zervox

A Rust watchdog for Node.js apps and long-running development commands.

Zervox can run commands in the foreground for quick checks, or start a detached supervisor that keeps runtime state, tracks PIDs, writes persistent logs, restarts crashed processes with backoff, and reports useful crash hints.

This repo still contains the earlier TypeScript prototype in `src/*.ts`. The Rust implementation is now the primary direction.

## Why Rust

- Ships as a single binary
- Lower memory footprint than a Node daemon
- Better fit for long-running process supervision
- Easier to install on servers and developer machines
- Strong foundation for native process control, systemd integration, and safe AI-assisted diagnostics

## Implemented

- `zervox check -- <command>` - run once and summarize failures
- `zervox start -- <command>` - foreground watchdog with restart limit
- `zervox start --detach --name <name> -- <command>` - background supervisor
- `zervox add <name> -- <command>` - save a command locally
- `zervox up <name>` - start a saved command in detached mode
- `zervox status [name]` - show runtime status, supervisor PID, child PID, restarts, and log path
- `zervox logs <name>` - tail persistent logs
- `zervox stop <name>` - stop supervisor and child process
- `zervox restart <name>` - restart a saved supervised process
- `zervox list`, `zervox run`, `zervox remove`, `zervox doctor`
- Crash hints for common Node errors like port conflicts, missing modules, permission issues, and syntax errors

## Runtime files

- Config: `~/.config/zervox/processes.json`
- Runtime state: `~/.local/state/zervox/runtime.json`
- Logs: `~/.local/state/zervox/logs/<name>.log`

Use `zervox doctor` to print the exact paths on your machine.

## Build

```bash
cargo build --release
```

The binary will be available at:

```bash
./target/release/zervox
```

## Usage

Run a command once:

```bash
zervox check -- node server.js
```

Run in the foreground and restart it up to five times:

```bash
zervox start --max-restarts 5 -- node server.js
```

Start as a detached supervised process:

```bash
zervox start --detach --name api --max-restarts 5 -- node server.js
```

Inspect and operate it:

```bash
zervox status api
zervox logs api -n 50
zervox restart api
zervox stop api
```

JavaScript entry files are automatically run with Node:

```bash
zervox start server.js
```

Track a command for later:

```bash
zervox add api --max-restarts 5 -- node server.js
zervox list
zervox up api
```

Run in another directory:

```bash
zervox start --detach --name api --cwd ./apps/api -- npm run dev
```

## Example crash summary

```text
Crash detected
command: node server.js
exit code: 1
hint: port conflict detected. Stop the existing process or change PORT.

recent output
  Error: listen EADDRINUSE: address already in use :::3000
```

## Production-readiness status

Zervox now has the core pieces of a production watchdog:

- Detached supervisor process
- PID tracking for supervisor and child
- Persistent runtime state
- Persistent per-process logs
- Stop/restart/status/log commands
- Restart limit and exponential backoff
- Strict Rust checks passing

Still needed before a serious public release:

1. Integration test suite around detached processes and stop/restart behavior
2. Stale PID detection and runtime state cleanup after machine reboot
3. systemd service generation
4. Binary release pipeline for Linux
5. Optional AI diagnostics with review-before-run safety controls
6. TUI or web dashboard

## Development

```bash
cargo fmt --check
cargo test --all-targets
cargo clippy --all-targets --all-features -- -D warnings
cargo run -- check -- node -e "console.log('ok')"
```
