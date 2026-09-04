#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# Scenario 1: Trigger Workload Failure (Pod Crash)
# Simulates CrashLoopBackOff on victim-api and triggers
# Zervox ingestion and automatic remediation.
# ==========================================================

ZERVOX_URL="${ZERVOX_URL:-http://localhost:8080}"
API_KEY="${ZERVOX_API_KEY:-zervox-secret-token}"
NAMESPACE="${1:-default}"
POD_NAME="${2:-victim-api-659f8c9b-x9z2p}"

echo "💥 [CHAOS] Injecting Pod Crash Failure for ${POD_NAME} in namespace '${NAMESPACE}'..."

# If kubectl is available and cluster exists, kill the real pod
if command -v kubectl &> /dev/null && kubectl get pod "${POD_NAME}" -n "${NAMESPACE}" &> /dev/null; then
    echo "→ Executing real kubectl pod deletion..."
    kubectl delete pod "${POD_NAME}" -n "${NAMESPACE}" --grace-period=0 --force 2>/dev/null || true
fi

# Dispatch Alertmanager webhook payload to Zervox Primary
echo "→ Dispatching Prometheus Alertmanager webhook alert to Zervox (${ZERVOX_URL})..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${ZERVOX_URL}/api/grafana_webhook" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "{
    \"receiver\": \"zervox-webhook\",
    \"status\": \"firing\",
    \"alerts\": [
      {
        \"status\": \"firing\",
        \"labels\": {
          \"alertname\": \"PodCrashLooping\",
          \"severity\": \"critical\",
          \"namespace\": \"${NAMESPACE}\",
          \"pod\": \"${POD_NAME}\"
        },
        \"annotations\": {
          \"summary\": \"Container in ${POD_NAME} pod crashed repeatedly in CrashLoopBackOff\"
        }
      }
    ]
  }")

STATUS=$(echo "${RESPONSE}" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "${RESPONSE}" | sed '/HTTP_STATUS:/d')

if [ "${STATUS}" = "200" ]; then
    echo "✔ Alert successfully ingested and remediated by Zervox!"
    echo "Response payload:"
    echo "${BODY}" | python3 -m json.tool 2>/dev/null || echo "${BODY}"
else
    echo "⚠️ Failed to deliver webhook (HTTP ${STATUS}):"
    echo "${BODY}"
fi
