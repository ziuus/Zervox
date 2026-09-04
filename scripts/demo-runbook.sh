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
curl -s "${ZERVOX_PRIMARY_URL}/api/status" | jq '.' || true

# Step 2: Pod Crash Remediation
pause_step "2. Inject Pod Crash Chaos & Observe Autonomous Remediation"
echo "Firing PodCrashLooping alert to Zervox..."
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
                    "pod": "victim-api-6d7c8f",
                    "severity": "critical"
                },
                "annotations": {
                    "summary": "Pod victim-api-6d7c8f in CrashLoopBackOff"
                }
            }
        ]
    }' | jq '.' || true

# Step 3: OPA Policy Blast-Radius Attack Block
pause_step "3. Simulate Malicious RBAC Namespace Deletion (OPA Security Gate)"
echo "Injecting unauthorized namespace deletion payload..."
curl -s -X POST "${ZERVOX_PRIMARY_URL}/api/simulate_attack" \
    -H "Content-Type: application/json" \
    -d '{
        "attack_type": "delete_namespace",
        "namespace": "default",
        "target_name": "default"
    }' | jq '.' || true

# Step 4: Network Outage & Local Fallback Mode
pause_step "4. Simulate External Network Outage & Trigger Local Fallback Mode"
echo "Simulating external cloud / LLM outage with high latency alert in fallback mode..."
curl -s -X POST "${ZERVOX_PRIMARY_URL}/api/grafana_webhook" \
    -H "Content-Type: application/json" \
    -H "x-api-key: zervox-secret-token" \
    -d '{
        "status": "firing",
        "alerts": [
            {
                "status": "firing",
                "labels": {
                    "alertname": "HighLatency",
                    "namespace": "default",
                    "app": "victim-api",
                    "severity": "warning"
                },
                "annotations": {
                    "summary": "High traffic latency on victim-api"
                }
            }
        ]
    }' | jq '.' || true

# Step 5: Primary Failure & Watchdog Leader Failover
pause_step "5. Kill Zervox Primary to Demonstrate Watchdog Self-Preservation Failover"
echo "Simulating sudden crash of primary binary..."
./infra/chaos-scripts/kill-zervox-primary.sh || true

echo "Checking Backup instance status after failover promotion..."
sleep 4
curl -s "${ZERVOX_BACKUP_URL}/api/status" 2>/dev/null | jq '.' || echo "Backup node at ${ZERVOX_BACKUP_URL} ready to query."

# Step 6: Final Incident Timeline Review
pause_step "6. Review Complete Incident Timeline and SQLite Audit Trail"
echo "Fetching full audit timeline from Zervox..."
curl -s "${ZERVOX_PRIMARY_URL}/api/status" 2>/dev/null | jq '.recent_incidents' || curl -s "${ZERVOX_BACKUP_URL}/api/status" 2>/dev/null | jq '.recent_incidents' || true

echo -e "\n${COLOR_GREEN}✔ Demo Runbook completed successfully!${COLOR_RESET}"
