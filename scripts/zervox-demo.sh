#!/bin/bash

# Zervox AI - Terminal Demo with Crash & Recovery
# Clean and aesthetic version

clear

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m'

print_info() { echo -e "${GRAY}[$(date +%H:%M:%S)]${NC} ${GRAY}[INFO]${NC} $1"; }
print_error() { echo -e "${GRAY}[$(date +%H:%M:%S)]${NC} ${RED}[ERROR]${NC} $1"; }
print_success() { echo -e "${GRAY}[$(date +%H:%M:%S)]${NC} ${GREEN}[SUCCESS]${NC} $1"; }

print_header() {
    echo ""
    echo -e "${CYAN}================================================================${NC}"
    printf "${CYAN}|${NC}  ${WHITE}$1${NC}%59s ${CYAN}|${NC}\n" ""
    echo -e "${CYAN}================================================================${NC}"
    echo ""
}

print_process_table() {
    local crashed=$1
    echo -e "${CYAN}+================================================================+${NC}"
    echo -e "${CYAN}|${NC}  PID      Process               Status     CPU     Memory  ${CYAN}|${NC}"
    echo -e "${CYAN}+================================================================+${NC}"
    
    if [ "$crashed" = "yes" ]; then
        echo -e "${CYAN}|${NC}  ${RED}243638  node server.js       ${RED}CRASHED${RED}   ---    ---     ${CYAN}|${NC}"
    else
        echo -e "${CYAN}|${NC}  ${GREEN}243638  node server.js       ${GREEN}RUNNING${GREEN}   12.4%  245MB   ${CYAN}|${NC}"
    fi
    
    echo -e "${CYAN}|${NC}  ${GREEN}243642  worker-api.js      ${GREEN}RUNNING${GREEN}   8.2%   156MB   ${CYAN}|${NC}"
    echo -e "${CYAN}|${NC}  ${GREEN}243651  ai-processor.js    ${GREEN}RUNNING${GREEN}   24.1%  512MB   ${CYAN}|${NC}"
    echo -e "${CYAN}|${NC}  ${GREEN}243667  websocket.js       ${GREEN}RUNNING${GREEN}   3.8%    89MB   ${CYAN}|${NC}"
    echo -e "${CYAN}+================================================================+${NC}"
    echo ""
}

# Phase 1
clear
print_header "ZERVOX AI - PROCESS MONITOR"
print_process_table "no"

print_info "Server running on http://localhost:3000"
print_info "Environment: production | Node v20.11.0"
sleep 0.8

print_info "Database: postgresql://zervox@db.zervox.io:5432"
print_info "Redis: online | Sessions: 1,247"
sleep 0.8

print_info "API Gateway: port 3000 | WebSocket: port 3001"
print_success "AI Analysis complete: 3 websites (2.3s)"
sleep 0.8

print_error "FATAL: Uncaught Exception in PID 243638"
print_error "Error: ECONNREFUSED - Database timeout"
sleep 1.5

# Phase 2 - Transition
clear
for i in {1..3}; do sleep 0.1; done

# Phase 3 - Recovery
print_header "ZERVOX AI - AUTO RECOVERY"
print_process_table "yes"

echo -e "${YELLOW}[*]${NC} ${WHITE}zervox working on process 1${NC}"
sleep 1
echo ""

echo -e "${RED}[!]${NC} ${WHITE}CRITICAL: detected crash in process 1${NC}"
echo -e "    ${GRAY}-> Process: node server.js (PID: 243638)${NC}"
echo -e "    ${GRAY}-> Exit code: 1 (FATAL ERROR)${NC}"
echo -e "    ${GRAY}-> Restart attempts: 0/5${NC}"
sleep 1
echo ""

echo -e "${CYAN}[*]${NC} ${WHITE}analyzing errors and critical issues...${NC}"
echo -e "    ${GRAY}-> Database connection refused (ECONNREFUSED)${NC}"
echo -e "    ${GRAY}-> Failed requests: 3${NC}"
sleep 1
echo ""

echo -e "${PURPLE}[*]${NC} ${WHITE}editing files...${NC}"
echo -e "    ${GRAY}-> src/config/database.js${NC}"
echo -e "    ${GRAY}-> Adding retry logic with exponential backoff${NC}"
sleep 1
echo ""

echo -e "${GREEN}[*]${NC} ${WHITE}issue fixed successfully${NC}"
sleep 0.5
echo ""

echo -e "${YELLOW}[*]${NC} ${WHITE}notifying admin...${NC}"
echo -e "    ${GRAY}-> Email: admin@zervox.ai${NC}"
echo -e "    ${GRAY}-> Incident #INC-2847 created${NC}"
sleep 0.8
echo ""

echo -e "${CYAN}[*]${NC} ${WHITE}restarting process...${NC}"
for i in {1..10}; do
    printf "    "
    for j in $(seq 1 $i); do printf "#"; done
    for j in $(seq $i 10); do printf "-"; done
    printf " %d%%\n" $((i*10))
    sleep 0.08
done
echo ""

# Phase 4 - Server Live
print_header "SERVER IS LIVE"
print_process_table "no"

print_success "Server restarted: http://localhost:3000"
print_success "Database: connected | All services operational"
echo ""

echo -e "${CYAN}================================================================${NC}"
echo ""
