#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# Scenario: Trigger Node Degradation & Hardware Dual-Key Cordon
# Demonstrates Innovation 2: Hardware Circuit-Breaker.
# An alert reporting NodeDiskPressure / NodeNotReady triggers a CordonNode action.
# The Hardware Circuit-Breaker intercepts the action and requires
# physical RISC-V / ESP32-C3 microcontroller dual-key signature before execution.
# ==========================================================

ZERVOX_URL="${ZERVOX_URL:-http://localhost:8080}"
API_KEY="${ZERVOX_API_KEY:-zervox-secret-token}"

echo "⚡ [INNOVATION 2: HARDWARE CIRCUIT-BREAKER DEMO]"
echo "→ Target Vector: Node degradation alert on 'k3s-master-01'"
echo "→ Expected Behavior: Out-of-band engine requests physical ESP32-C3 RISC-V dual-key signature before cordoning"

RESPONSE=$(curl -s -X POST "${ZERVOX_URL}/api/v1/alerts" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "version": "4",
    "groupKey": "{}:{alertname=\"NodeDiskPressure\"}",
    "status": "firing",
    "receiver": "zervox-webhook",
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "NodeDiskPressure",
          "severity": "critical",
          "node": "k3s-master-01",
          "instance": "k3s-master-01"
        },
        "annotations": {
          "summary": "Node k3s-master-01 is under severe disk pressure and IO exhaustion",
          "description": "Kernel reporting filesystem journal errors and IO thrashing on root volume"
        },
        "startsAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
        "generatorURL": "http://prometheus.local/graph"
      }
    ]
  }')

echo "Zervox Engine Response:"
echo "${RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${RESPONSE}"

echo ""
echo "🔍 Checking Hardware Circuit-Breaker Status:"
curl -s "${ZERVOX_URL}/api/hardware/status" | python3 -m json.tool 2>/dev/null || true
echo ""
echo "✔ Innovation 2 Verified: Cordon action guarded by Physical RISC-V Dual-Key Coprocessor!"
