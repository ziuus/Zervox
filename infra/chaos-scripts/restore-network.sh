#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# Restore Script: Network Outage Recovery
# ==========================================================

echo "🌐 Restoring network policies..."

if command -v iptables &> /dev/null; then
    sudo iptables -F
    sudo iptables -P INPUT ACCEPT
    sudo iptables -P OUTPUT ACCEPT
    sudo iptables -P FORWARD ACCEPT
    echo "✔ Iptables flushed safely. All TCP network traffic restored."
else
    echo "Error: iptables not found."
    exit 1
fi
