#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# ⚡ ZERVOX: LOCAL KUBERNETES DEPLOYMENT & VERIFICATION SCRIPT ⚡
# Track B: Live Cluster Target with victim-api (OOMKill verification)
# ==============================================================================

GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_APP="${SCRIPT_DIR}/demo-app/victim-memory-leak.yaml"

echo "Checking for accessible Kubernetes environment..."
if ! command -v kubectl &>/dev/null; then
    echo -e "${YELLOW}Notice: 'kubectl' is not installed locally.${NC}"
    echo "To connect Zervox to a live cluster, install k3s or minikube:"
    echo "  curl -sfL https://get.k3s.io | sh -"
    echo "  export KUBECONFIG=~/.kube/config"
    echo -e "Zervox will continue operating safely in ${GREEN}dry-run / simulated${NC} mode."
    exit 0
fi

if ! kubectl get nodes &>/dev/null; then
    echo -e "${RED}Kubernetes cluster unreachable via current KUBECONFIG.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Kubernetes cluster detected!${NC}"
echo "Deploying OOMKill victim-api in namespace 'default'..."
kubectl apply -f "${DEMO_APP}"

echo "Waiting for pod creation..."
kubectl get pods -l app=victim-api -w
