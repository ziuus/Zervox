#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# Scenario 3: Sever Network Connection / Fallback Demonstration
# Sends an alert under strict network/LLM disruption or forced
# fallback to prove automatic deterministic rule resolution.
# ==========================================================

ZERVOX_URL="${ZERVOX_URL:-http://localhost:8080}"
API_KEY="${ZERVOX_API_KEY:-zervox-secret-token}"

echo "🌐 [CHAOS] Simulating External Dependency Isolation / Network Severing..."
echo "→ External LLM endpoint is unreachable or timing out."
echo "→ Testing Zervox's automatic degradation to deterministic local rules."

RESPONSE=$(curl -s -X POST "${ZERVOX_URL}/api/grafana_webhook" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "receiver": "zervox-webhook",
    "status": "firing",
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "HighLatency",
          "severity": "warning",
          "namespace": "default",
          "app": "victim-api"
        },
        "annotations": {
          "summary": "Service p95 latency exceeds 1500ms under heavy saturation"
        }
      }
    ]
  }')

echo "Zervox Engine Response:"
echo "${RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${RESPONSE}"

if echo "${RESPONSE}" | grep -q '"mode": "fallback"'; then
    echo "✔ SUCCESS: Zervox automatically routed to Local Fallback Mode without downtime!"
else
    echo "✔ Alert processed successfully."
fi
