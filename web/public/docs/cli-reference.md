# CLI Reference

The Zervox CLI is your primary interface for managing autonomous processes.

## Basic Commands

### `zervox start`
Starts a new process under Zervox monitoring.
- **Usage**: `zervox start <file> [options]`
- **Flags**:
  - `--auto-fix`: Enable autonomous AI-powered repairs.
  - `--mode <type>`: Set operating mode (`INTERACTIVE`, `AUTO_FIX`, `NOTIFY_ONLY`).
  - `--port <number>`: Specify custom daemon port.

### `zervox list`
Displays all active processes managed by the Zervox daemon.
- **Output**: PID, Name, Status, Resurrections, Uptime.

### `zervox stop`
Gracefully terminates a managed process.
- **Usage**: `zervox stop <pid|name>`

### `zervox logs`
Streams the output of a managed process.
- **Usage**: `zervox logs <pid|name>`

## Global Options
- `--version`: Show Zervox version.
- `--help`: Show command assistance.
