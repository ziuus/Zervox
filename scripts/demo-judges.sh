#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# ⚡ ZERVOX: 3-MINUTE JUDGES DEMO RUNBOOK (HAC'KP 2026) ⚡
# Autonomous Air-Gapped Cyber Resilience & SRE Engine
# 5 Sequential Steps for Best Innovation Award Pitch
# ==============================================================================

CYAN='\033[1;36m'
GREEN='\033[1;32m'
RED='\033[1;31m'
YELLOW='\033[1;33m'
PURPLE='\033[1;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

PRIMARY_URL="http://localhost:8080"
UI_URL="http://localhost:3000"

header() {
    echo -e "${CYAN}"
    echo "  ================================================================"
    echo "  ⚡ ZERVOX 3-MINUTE AUTOMATED JUDGES DEMO SCRIPT ⚡"
    echo "  Kerala Police Cyberdome — HAC'KP 2026 Presentation"
    echo "  ================================================================"
    echo -e "${NC}"
}

step_prompt() {
    local step_num="$1"
    local title="$2"
    local desc="$3"
    echo ""
    echo -e "${PURPLE}┌───────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${PURPLE}│ STEP ${step_num}: ${title}${NC}"
    echo -e "${PURPLE}└───────────────────────────────────────────────────────────────┘${NC}"
    echo -e "${YELLOW}👉 WHAT TO SHOW ON SCREEN (${UI_URL}):${NC}"
    echo -e "   ${desc}"
    echo ""
    echo -ne "${DIM}Press [ENTER] to execute Step ${step_num}...${NC} "
    read -r
}

header

echo -e "Verifying Zervox Primary Engine is reachable at ${PRIMARY_URL}..."
if curl -s -f "${PRIMARY_URL}/healthz" > /dev/null; then
    echo -e "${GREEN}✓ Primary engine active!${NC}"
else
    echo -e "${RED}✗ Primary engine not responding at ${PRIMARY_URL}. Please start stack with 'docker compose up -d'.${NC}"
    exit 1
fi

# ── STEP 1 ───────────────────────────────────────────────────────────────────
step_prompt "1" "MALICIOUS RBAC ATTACK -> OPA POLICY DENIAL THEATER" \
    "Show the Policy Firewall Replay modal & live incident timeline blocking namespace destruction."

echo -e "${BOLD}Injecting Hostile Action: Simulated Namespace Deletion...${NC}"
RESPONSE_STEP1=$(curl -s -X POST "${PRIMARY_URL}/api/simulate_attack" \
    -H "Content-Type: application/json" \
    -d '{"attack_type":"delete_namespace","namespace":"default","target_name":"victim-api"}')
echo -e "${GREEN}Response from Zervox Policy Gate:${NC}"
echo "${RESPONSE_STEP1}" | (command -v jq >/dev/null && jq . || cat)

# ── STEP 2 ───────────────────────────────────────────────────────────────────
step_prompt "2" "POD CRASH -> FORENSIC FREEZE & CRYPTOGRAPHIC SEAL" \
    "Show Forensic Freeze Frame capturing volatile heap/socket state before pod restart with SHA-256 Merkle hash."

echo -e "${BOLD}Injecting Critical Alert: PodCrashLooping (OOMKill / Memory Tamper)...${NC}"
RESPONSE_STEP2=$(curl -s -X POST "${PRIMARY_URL}/api/v1/alerts" \
    -H "Content-Type: application/json" \
    -d '{"alerts":[{"labels":{"alertname":"PodCrashLooping","severity":"critical","pod":"victim-api-prod","namespace":"default"}}]}')
echo -e "${GREEN}Remediation Execution Response:${NC}"
echo "${RESPONSE_STEP2}" | (command -v jq >/dev/null && jq . || cat)

# ── STEP 3 ───────────────────────────────────────────────────────────────────
step_prompt "3" "GLASS BOX ROOT CAUSE TRAIL -> DETERMINISTIC FALLBACK" \
    "Point to the Glass Box Root Cause reasoning chain & sub-1.2ms rule fallback."

echo -e "${BOLD}Checking Current Engine Mode & Diagnostic Reasoning Trail...${NC}"
STATUS_RESP=$(curl -s "${PRIMARY_URL}/api/status")
echo -e "${GREEN}Current Engine Status:${NC}"
echo "${STATUS_RESP}" | (command -v jq >/dev/null && jq '{service, role, engine_mode, opa_status, total_incidents}' || cat)

# ── STEP 4 ───────────────────────────────────────────────────────────────────
step_prompt "4" "PRIMARY NODE ASSASSINATION -> ACTIVE BACKUP TAKEOVER" \
    "Watch the top indicator pulse red, watchdog miss 3 heartbeats, and backup promote to leader on stage."

echo -e "${BOLD}Assassinating Primary Engine container (docker compose stop zervox-primary)...${NC}"
docker compose stop zervox-primary
echo -e "${YELLOW}Primary container stopped. Waiting 4 seconds for watchdog heartbeat detection...${NC}"
sleep 4
echo -e "${GREEN}Stack state after failover:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# ── STEP 5 ───────────────────────────────────────────────────────────────────
step_prompt "5" "AIR-GAP ATTESTATION BEACON -> ZERO EXFILTRATION PROOF" \
    "Show the Air-Gap Attestation Beacon header and Optical QR air-gap code verification."

echo -e "${BOLD}Restarting Primary container to restore balanced HA state...${NC}"
docker compose start zervox-primary
sleep 2
echo -e "${GREEN}All services operational:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo -e "${CYAN}================================================================${NC}"
echo -e "${GREEN}🎉 3-MINUTE JUDGES DEMO COMPLETE!${NC}"
echo -e "   Next.js Control Plane: ${UI_URL}"
echo -e "   Kerala Police Cyberdome Best Innovation Presentation Ready."
echo -e "${CYAN}================================================================${NC}"
