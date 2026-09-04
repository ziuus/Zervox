#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# Scenario 2: Trigger Malicious RBAC Attack (OPA Denial)
# Injects a prohibited action (namespace deletion / privilege escalation)
# to prove the unbypassable OPA security gate blocks it.
# ==========================================================

ZERVOX_URL="${ZERVOX_URL:-http://localhost:8080}"
API_KEY="${ZERVOX_API_KEY:-zervox-secret-token}"

echo "🛡️ [CHAOS] Injecting Malicious Payload against Zervox Control Plane..."
echo "→ Target Vector: Unauthorized namespace deletion ('delete_namespace')"

RESPONSE=$(curl -s -X POST "${ZERVOX_URL}/api/simulate_attack" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "attack_type": "delete_namespace",
    "namespace": "default",
    "target_name": "victim-api"
  }')

echo "Zervox Policy Engine Response:"
echo "${RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${RESPONSE}"

if echo "${RESPONSE}" | grep -q "ATTACK_SUCCESSFULLY_BLOCKED_BY_OPA"; then
    echo "✔ SUCCESS: The OPA Security Policy Gate blocked the malicious blast radius!"
else
    echo "⚠️ Warning: Expected policy block response. Ensure Zervox engine is active."
fi
