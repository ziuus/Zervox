#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# Chaos Script: Network Outage Simulation
# ==========================================================

echo "🌐 [CHAOS] Simulating total network isolation to force LLM timeout..."
echo "⚠️ WARNING: Dropping all TCP traffic except Port 22 (SSH) and established connections."

if command -v iptables &> /dev/null; then
    # Flush existing rules to start fresh
    sudo iptables -F
    
    # 1. Allow existing established/related connections
    sudo iptables -A INPUT -p tcp -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
    sudo iptables -A OUTPUT -p tcp -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
    
    # 2. Allow SSH (Port 22)
    sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
    sudo iptables -A OUTPUT -p tcp --sport 22 -j ACCEPT
    
    # 3. Allow Localhost (essential for internal Zervox API/DB traffic)
    sudo iptables -A INPUT -i lo -j ACCEPT
    sudo iptables -A OUTPUT -o lo -j ACCEPT
    
    # 4. Drop all other TCP traffic (simulating LLM API unreachability)
    sudo iptables -A INPUT -p tcp -j DROP
    sudo iptables -A OUTPUT -p tcp -j DROP

    echo "✔ Precise iptables rules applied. All outbound TCP to LLM APIs will now timeout."
    echo "To restore normal networking, run: ./infra/chaos-scripts/restore-network.sh"
else
    echo "Error: iptables not found. Required for this chaos simulation."
    exit 1
fi
