#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# ⚡ ZERVOX: LIVE HACKATHON DEMO ORCHESTRATOR ⚡
# Interactive CLI to demonstrate autonomous cyber resilience
# ==========================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CHAOS_DIR="${ROOT_DIR}/infra/chaos-scripts"

# ANSI Color Palette
CYAN='\033[1;36m'
GREEN='\033[1;32m'
RED='\033[1;31m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
PURPLE='\033[1;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

clear_screen() {
    clear 2>/dev/null || true
}

banner() {
    echo -e "${CYAN}"
    echo "  ███████╗███████╗██████╗ ██╗   ██╗ ██████╗ ██╗   ██╗"
    echo "  ╚══███╔╝██╔════╝██╔══██╗██║   ██║██╔═══██╗╚██╗ ██╔╝"
    echo "    ███╔╝ █████╗  ██████╔╝██║   ██║██║   ██║ ╚████╔╝ "
    echo "   ███╔╝  ██╔══╝  ██╔══██╗╚██╗ ██╔╝██║   ██║  ██╔═██╗ "
    echo "  ███████╗███████╗██║  ██║ ╚████╔╝ ╚██████╔╝ ██║  ██╗"
    echo "  ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝   ╚═════╝  ╚═╝  ╚═╝"
    echo -e "${NC}"
    echo -e "  ${BOLD}Autonomous Air-Gapped Cyber Resilience & SRE Engine${NC}"
    echo -e "  ${DIM}Live Demo Control Plane · Next.js Dashboard: ${CYAN}http://localhost:3000${NC}"
    echo -e "  ─────────────────────────────────────────────────────────────────"
}

check_dashboard() {
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200"; then
        echo -e "  ${GREEN}● Next.js Dashboard Online:${NC} ${CYAN}http://localhost:3000${NC}"
    else
        echo -e "  ${YELLOW}○ Next.js Dashboard Standby:${NC} ${DIM}Starting or unpolled${NC}"
    fi

    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/healthz 2>/dev/null | grep -q "200"; then
        echo -e "  ${GREEN}● Zervox Primary Engine Online:${NC} ${CYAN}http://localhost:8080${NC}"
    else
        echo -e "  ${RED}● Zervox Primary Engine Offline / In Failover${NC}"
    fi
    echo ""
}

pause() {
    echo ""
    echo -e "${DIM}Press [ENTER] to return to the Demo Menu...${NC}"
    read -r
}

scenario_1() {
    echo ""
    echo -e "${PURPLE}╔═════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║  SCENARIO 1: WORKLOAD FAILURE & AUTONOMOUS REMEDIATION          ║${NC}"
    echo -e "${PURPLE}╚═════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}👀 WHAT JUDGES SHOULD LOOK FOR ON THE DASHBOARD:${NC}"
    echo -e "  1. Watch ${CYAN}'Remediation Timeline'${NC} on ${CYAN}http://localhost:3000${NC}"
    echo -e "  2. An incoming ${RED}'PodCrashLooping'${NC} alert is ingested instantly."
    echo -e "  3. Root-cause is diagnosed, approved through OPA, and pod is rescheduled."
    echo -e "  4. Status turns ${GREEN}'RESOLVED'${NC} in the live SQLite WAL feed."
    echo ""
    echo -e "${BOLD}Executing chaos injection...${NC}"
    "${CHAOS_DIR}/pod-crash.sh"
    pause
}

scenario_2() {
    echo ""
    echo -e "${PURPLE}╔═════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║  SCENARIO 2: MALICIOUS RBAC ATTACK & OPA POLICY DENIAL          ║${NC}"
    echo -e "${PURPLE}╚═════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}👀 WHAT JUDGES SHOULD LOOK FOR ON THE DASHBOARD:${NC}"
    echo -e "  1. A simulated attack tries to delete the production ${RED}'default'${NC} namespace."
    echo -e "  2. Watch the ${CYAN}'OPA Gate'${NC} column in the incident timeline."
    echo -e "  3. Unbypassable OPA / Rego security boundary immediately blocks execution."
    echo -e "  4. Status flags ${RED}'BLOCKED_BY_POLICY'${NC} — zero cluster blast radius."
    echo ""
    echo -e "${BOLD}Executing chaos injection...${NC}"
    "${CHAOS_DIR}/rbac-attack.sh"
    pause
}

scenario_3() {
    echo ""
    echo -e "${PURPLE}╔═════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║  SCENARIO 3: NETWORK ISOLATION & LOCAL FALLBACK MODE            ║${NC}"
    echo -e "${PURPLE}╚═════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}👀 WHAT JUDGES SHOULD LOOK FOR ON THE DASHBOARD:${NC}"
    echo -e "  1. External LLM connection is severed or forced into fallback."
    echo -e "  2. 10-second bounded timeout engages — zero system stall."
    echo -e "  3. Watch the ${CYAN}'Engine Mode'${NC} badge dynamically display ${YELLOW}'FALLBACK'${NC}."
    echo -e "  4. Deterministic rules resolve ${CYAN}'HighLatency'${NC} by scaling replicas to 4."
    echo ""
    echo -e "${BOLD}Executing chaos injection...${NC}"
    "${CHAOS_DIR}/network-outage.sh"
    pause
}

scenario_4() {
    echo ""
    echo -e "${PURPLE}╔═════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║  SCENARIO 4: PRIMARY NODE ASSASSINATION & WATCHDOG HA FAILOVER  ║${NC}"
    echo -e "${PURPLE}╚═════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}👀 WHAT JUDGES SHOULD LOOK FOR ON THE DASHBOARD:${NC}"
    echo -e "  1. Primary node (Port 8080) is violently assassinated (SIGKILL)."
    echo -e "  2. Watch the top-bar pulse indicators: ${RED}PRIMARY TURNS RED${NC}."
    echo -e "  3. Backup node on TCP 9000 detects 3 missed heartbeats (6 seconds)."
    echo -e "  4. Backup promotes itself: ${GREEN}BACKUP TURNS ACTIVE${NC} and takes over traffic."
    echo ""
    echo -e "${BOLD}Executing chaos injection...${NC}"
    "${CHAOS_DIR}/kill-zervox-primary.sh"
    pause
}

# Interactive Main Loop
while true; do
    clear_screen
    banner
    check_dashboard

    echo -e "  ${BOLD}Select a Chaos Scenario to Trigger Live:${NC}"
    echo ""
    echo -e "  ${CYAN}[1]${NC} Trigger Workload Failure ${DIM}(Pod Crash -> Auto-Heal)${NC}"
    echo -e "  ${CYAN}[2]${NC} Trigger Malicious RBAC Attack ${DIM}(Hostile Action -> OPA Denial)${NC}"
    echo -e "  ${CYAN}[3]${NC} Sever Network Connection ${DIM}(LLM Drop -> Deterministic Fallback)${NC}"
    echo -e "  ${CYAN}[4]${NC} Assassinate Primary Node ${DIM}(SIGKILL 8080 -> Backup HA Failover)${NC}"
    echo ""
    echo -e "  ${RED}[q]${NC} Exit Demo Orchestrator"
    echo ""
    echo -ne "  ${BOLD}Enter choice [1-4, q]: ${NC}"
    read -r CHOICE

    case "${CHOICE}" in
        1) scenario_1 ;;
        2) scenario_2 ;;
        3) scenario_3 ;;
        4) scenario_4 ;;
        q|Q) 
            echo -e "\n${GREEN}Thank you for presenting Zervox! ⚡${NC}\n"
            exit 0
            ;;
        *)
            echo -e "\n${RED}Invalid option. Please choose between 1 and 4.${NC}"
            sleep 1
            ;;
    esac
done
