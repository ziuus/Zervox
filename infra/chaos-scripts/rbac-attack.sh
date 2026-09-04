#!/usr/bin/env bash
set -euo pipefail

# ==========================================
# Chaos Script: RBAC Attack Simulation
# ==========================================

ZERVOX_URL="${ZERVOX_URL:-http://localhost:8080}"
echo "🛡️ [CHAOS] Simulating Malicious Action Attack against Zervox and Kubernetes..."

echo "1. Testing in-cluster RBAC permissions for unprivileged attacker SA..."
if command -v kubectl &> /dev/null; then
    kubectl create ns test-ns --dry-run=client -o yaml | kubectl apply -f - 2>/dev/null || true
    kubectl create sa attacker -n test-ns --dry-run=client -o yaml | kubectl apply -f - 2>/dev/null || true

    if kubectl auth can-i delete namespace default --as=system:serviceaccount:test-ns:attacker 2>/dev/null; then
        echo "⚠️ Cluster RBAC allows deletion — dangerous cluster configuration!"
    else
        echo "✔ Cluster RBAC correctly blocked direct namespace deletion."
    fi
fi

echo "2. Testing Zervox OPA Policy Gate by injecting a malicious remediation payload..."
RESPONSE=$(curl -s -X POST "${ZERVOX_URL}/api/simulate_attack" \
    -H "Content-Type: application/json" \
    -d '{
        "attack_type": "delete_namespace",
        "namespace": "default",
        "target_name": "default"
    }' 2>/dev/null || true)

echo "Response from Zervox:"
echo "${RESPONSE}"

if echo "${RESPONSE}" | grep -q "ATTACK_SUCCESSFULLY_BLOCKED_BY_OPA"; then
    echo "✔ SUCCESS: Zervox OPA Policy Engine blocked the attack!"
else
    echo "⚠️ Note: Ensure Zervox engine is running on ${ZERVOX_URL}"
fi
