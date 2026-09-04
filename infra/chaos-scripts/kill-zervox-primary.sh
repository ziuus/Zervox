#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# Chaos Script: Kill Zervox Primary to test Failover
# ==========================================================

echo "⚡ [CHAOS] Killing Zervox Primary binary to test Watchdog failover..."

PID=$(pgrep -f "role primary" || true)

if [ -n "${PID}" ]; then
    echo "Found Primary process with PID: ${PID}"
    kill -9 "${PID}"
    echo "✔ Zervox Primary process killed. Backup instance will take over within 6 seconds."
else
    echo "PIDs matching 'role primary' not found. Checking general zervox-core..."
    pkill -f "zervox-core.*primary" || echo "No primary instance active."
fi
