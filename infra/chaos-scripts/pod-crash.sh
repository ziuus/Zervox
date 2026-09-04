#!/usr/bin/env bash
set -euo pipefail

# ==========================================
# Chaos Script: Pod Crash Injection
# ==========================================

NAMESPACE="${1:-default}"
APP_LABEL="${2:-victim-api}"

echo "💥 [CHAOS] Initiating Pod Crash Injection for app=${APP_LABEL} in namespace=${NAMESPACE}..."

if ! command -v kubectl &> /dev/null; then
    echo "Error: kubectl is required"
    exit 1
fi

POD=$(kubectl get pods -n "${NAMESPACE}" -l "app=${APP_LABEL}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)

if [ -z "${POD}" ]; then
    echo "⚠️ No running pods found for app=${APP_LABEL} in namespace=${NAMESPACE}."
    echo "Attempting to create demo deployment..."
    kubectl apply -f infra/demo-app/deployment.yaml
    sleep 3
    POD=$(kubectl get pods -n "${NAMESPACE}" -l "app=${APP_LABEL}" -o jsonpath='{.items[0].metadata.name}')
fi

echo "🎯 Targeted Pod: ${POD}"
echo "→ Terminating pod to simulate abrupt crash / node evict..."
kubectl delete pod "${POD}" -n "${NAMESPACE}" --grace-period=0 --force 2>/dev/null || true

echo "✔ Pod terminated. Alertmanager and Zervox will detect and remediate."
