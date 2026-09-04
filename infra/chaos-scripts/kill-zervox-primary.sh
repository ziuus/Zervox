#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# Scenario 4: Assassinate Primary Zervox Node (Trigger HA Failover)
# Kills the Primary instance (port 8080/9000). The backup watchdog
# detects the dropped TCP heartbeat and promotes itself to Leader.
# ==========================================================

echo "⚡ [CHAOS] Assassinating Zervox Primary Process to force HA Failover..."

PID=$(pgrep -f "role primary" || true)

if [ -n "${PID}" ]; then
    echo "Found Primary process with PID: ${PID}"
    kill -9 "${PID}"
    echo "✔ Primary process terminated."
else
    echo "PIDs matching 'role primary' not found. Checking general zervox-core..."
    pkill -9 -f "zervox-core.*primary" || echo "No primary instance active."
fi

echo ""
echo "⏱️  Watchdog countdown: Backup instance will detect 3 missed heartbeats"
echo "    and promote itself to ACTIVE leader within 6 seconds."
echo ""

for i in {6..1}; do
    echo -ne "Waiting for backup failover promotion... ${i}s \r"
    sleep 1
done
echo ""

echo "Checking Backup status (port 8081)..."
curl -s http://localhost:8081/healthz | python3 -m json.tool 2>/dev/null || echo "Backup health probe sent."
echo ""
echo "✔ Primary assassination completed. Observe state transition on the Next.js Dashboard!"
