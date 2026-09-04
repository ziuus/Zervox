#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# ZERVOX LIVE DEMO RUNBOOK
# End-to-End Automated & Guided SRE Remediation Demonstration
# ==============================================================================

ZERVOX_PRIMARY_URL="${ZERVOX_PRIMARY_URL:-http://localhost:8080}"
ZERVOX_BACKUP_URL="${ZERVOX_BACKUP_URL:-http://localhost:8081}"

COLOR_CYAN='\033[0;36m'
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_RESET='\033[0m'

pause_step() {
    local step_title="$1"
    echo -e "\n${COLOR_YELLOW}==============================================================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}▶ STEP: ${step_title}${COLOR_RESET}"
    echo -e "${COLOR_YELLOW}==============================================================================${COLOR_RESET}"
    read -p "Press [Enter] to execute this step..."
}

echo -e "${COLOR_GREEN}"
cat << "BANNER"
  ______ ___________ _    _ _______   __
 |___  /|  ___| ___ \ |  | |  _  \ \ / /
    / / | |__ | |_/ / |  | | | | |\ V / 
   / /  |  __||    /| |/\| | | | |/   \ 
 ./ /___| |___| |\ \\  /\  / |/ // /^\ \
 \_____/\____/\_| \_|\/  \/|___/ \/   \/
  Autonomous Resilient SRE Remediation Engine
BANNER
echo -e "${COLOR_RESET}"

# Step 1: Health & HA Topology Check
pause_step "1. Verify Cluster & Zervox High-Availability Topology"
echo "Checking Zervox Primary status at ${ZERVOX_PRIMARY_URL}..."
curl -s "${ZERVOX_PRIMARY_URL}/api/status" | jq '.' || echo -e "${COLOR_RED}Primary unreachable!${COLOR_RESET}"

# Step 2: Pod Crash Remediation
pause_step "2. Workload Failure (Pod Crash Chaos)"
echo "Executing pod-crash.sh to dynamically kill the victim-api pod..."
bash infra/chaos-scripts/pod-crash.sh
echo -e "\nWaiting for Prometheus Alertmanager to fire webhook to Zervox..."
sleep 15
echo "Fetching recent Zervox remediation decisions..."
curl -s "${ZERVOX_PRIMARY_URL}/api/status" | jq '.recent_incidents' || true

# Step 3: OPA Policy Blast-Radius Attack Block
pause_step "3. Malicious Actor (RBAC Namespace Deletion Attack)"
echo "Executing rbac-attack.sh to simulate rogue SA and Zervox OPA evaluation..."
bash infra/chaos-scripts/rbac-attack.sh

# Step 4: Network Outage & Local Fallback Mode
pause_step "4. Dependency Outage (LLM Network Sever)"
echo "Executing network-outage.sh to sever external dependencies..."
bash infra/chaos-scripts/network-outage.sh
echo -e "\nWaiting a moment, then querying Zervox to see if Fallback Mode activates on next webhook..."
# We trigger a webhook manually because prometheus might be isolated depending on network-outage config
# Note: network-outage script allows localhost traffic so we can test Zervox API locally!
curl -s -X POST "${ZERVOX_PRIMARY_URL}/api/grafana_webhook" \
    -H "Content-Type: application/json" \
    -H "x-api-key: zervox-secret-token" \
    -d '{
        "status": "firing",
        "alerts": [
            {
                "status": "firing",
                "labels": {
                    "alertname": "PodCrashLooping",
                    "namespace": "default",
                    "pod": "victim-api-fallback-test",
                    "severity": "critical"
                }
            }
        ]
    }' | jq '.' || true

echo -e "\nRestoring network access..."
bash infra/chaos-scripts/restore-network.sh

# Step 5: Primary Failure & Watchdog Leader Failover
pause_step "5. Responder Assassination (Watchdog Failover)"
echo "Executing kill-zervox-primary.sh to assassinate active engine..."
bash infra/chaos-scripts/kill-zervox-primary.sh
echo -e "\nWaiting for backup node heartbeat timeout and promotion..."
sleep 8
echo "Querying Backup instance (which should now be ACTIVE leader)..."
curl -s "${ZERVOX_BACKUP_URL}/api/status" | jq '.' || echo -e "${COLOR_RED}Backup node not responding!${COLOR_RESET}"

echo -e "\n${COLOR_GREEN}✔ Live Demo Runbook completed successfully!${COLOR_RESET}"
