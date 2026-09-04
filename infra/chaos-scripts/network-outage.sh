#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# Chaos Script: Network Outage Simulation (keeps SSH open)
# ==========================================================

echo "🌐 [CHAOS] Simulating total network isolation on VM..."
echo "⚠️ WARNING: Preserving Port 22 (SSH) for operator safety."

if command -v iptables &> /dev/null; then
    sudo iptables -F
    sudo iptables -A INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
    sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
    sudo iptables -A OUTPUT -p tcp --sport 22 -j ACCEPT
    # Allow localhost traffic
    sudo iptables -A INPUT -i lo -j ACCEPT
    sudo iptables -A OUTPUT -o lo -j ACCEPT
    # Block outbound internet/external AI access
    sudo iptables -P INPUT DROP
    sudo iptables -P OUTPUT DROP
    echo "✔ Network severed except SSH and loopback."
    echo "To restore normal networking, run: ./infra/chaos-scripts/restore-network.sh"
else
    echo "iptables not found or not permitted in this container."
fi
