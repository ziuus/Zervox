# Getting Started with Zervox

Zervox is a lightweight, autonomous SRE daemon designed to monitor, analyze, and repair applications in real-time.

## Installation

```bash
npm install -g zervox
```

## Running your first process

To start a process with Zervox and enable autonomous auto-fixing:

```bash
zervox start myApp.js --auto-fix
```

## How it Works

1. **Detection**: Zervox monitors the child process's stdout/stderr and exit codes.
2. **Analysis**: Upon detection of a crash or specific error pattern, Zervox sends the last 50 lines of logs to Gemini AI.
3. **Execution**: The AI generates a shell fix (e.g., `npm install`, `sed` patch). Zervox executes this command in the environment.
4. **Resurrection**: Zervox restarts the process and monitors it to ensure the fix was successful.

## Configuration

You can configure Zervox via environment variables or CLI flags:

- `ZERVOX_PORT`: Port for the live dashboard (default: 4040)
- `--mode`: `INTERACTIVE`, `AUTO_FIX`, or `NOTIFY_ONLY`
