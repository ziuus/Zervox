# Zervox

A small Rust process watchdog for Node.js apps and long-running development commands.

Zervox runs a command, streams its output, detects crashes from non-zero exits, keeps the latest logs, prints a useful failure summary, and can restart the command a limited number of times.

This repo still contains the earlier TypeScript prototype in `src/*.ts`. The Rust rewrite is now the primary direction.

## Why Rust

- Ships as a single binary
- Lower memory footprint than a Node daemon
- Better fit for long-running process supervision
- Easier to install on servers and developer machines
- Good foundation for future native features like signals, log files, systemd integration, and desktop notifications

## Current MVP

Implemented:

- `zervox check -- <command>` - run once and summarize failures
- `zervox start -- <command>` - run and restart on crash
- `zervox add <name> -- <command>` - save a command locally
- `zervox list` - list tracked commands
- `zervox run <name>` - run a tracked command
- `zervox remove <name>` - remove a tracked command
- `zervox doctor` - show local state location
- Crash hints for common Node errors like port conflicts, missing modules, permission issues, and syntax errors

Not implemented yet:

- Background daemon mode
- Web dashboard
- AI-assisted fix suggestions
- Log file persistence
- systemd service generation

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

Start a command and restart it up to five times:

```bash
zervox start --max-restarts 5 -- node server.js
```

JavaScript entry files are automatically run with Node:

```bash
zervox start server.js
```

Track a command:

```bash
zervox add api --max-restarts 5 -- node server.js
zervox list
zervox run api
```

Run in another directory:

```bash
zervox start --cwd ./apps/api -- npm run dev
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

## Roadmap

1. Background daemon with PID tracking and `stop`/`restart` commands
2. Persistent per-process logs under `~/.local/state/zervox`
3. Optional AI analysis provider with safe, review-before-run fixes
4. Web or TUI dashboard
5. Release pipeline for Linux binaries

## Development

```bash
cargo fmt
cargo test
cargo run -- check -- node -e "console.log('ok')"
```
