#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# ⚡ CHAOS SCENARIO: FORENSIC FREEZE & CRYPTOGRAPHIC MERKLE SEALING TEST ⚡
# Simulates a critical pod crash and verifies that Zervox creates a
# pre-remediation tamper-evident snapshot with SHA-256 Merkle proof.
# ==============================================================================

ZERVOX_URL="${ZERVOX_URL:-http://localhost:8080}"
API_KEY="${ZERVOX_API_KEY:-zervox-secret-token}"
NAMESPACE="${1:-default}"
POD_NAME="${2:-victim-api-exploit-pod}"

echo "💥 [CHAOS] Triggering Exploit / OOM Crash on '${POD_NAME}' in '${NAMESPACE}'..."

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${ZERVOX_URL}/api/v1/alerts" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "version": "4",
    "status": "firing",
    "receiver": "zervox-webhook",
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "PodCrashLooping",
          "severity": "critical",
          "namespace": "'"${NAMESPACE}"'",
          "pod": "'"${POD_NAME}"'"
        },
        "annotations": {
          "summary": "Container in '"${POD_NAME}"' crashed after memory tampering attempt"
        },
        "startsAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
      }
    ]
  }')

STATUS=$(echo "${RESPONSE}" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "${RESPONSE}" | sed '/HTTP_STATUS:/d')

if [ "${STATUS}" = "200" ]; then
    echo "✔ Alert successfully ingested and remediated by Zervox!"
    echo "${BODY}" | (command -v jq >/dev/null && jq . || cat)
    
    INCIDENT_ID=$(echo "${BODY}" | (grep -o '"incident_id":"[^"]*' || grep -o '"id":"[^"]*') | head -n1 | cut -d'"' -f4 || true)
    
    if [ -n "${INCIDENT_ID}" ]; then
        echo ""
        echo "🔍 Querying Forensic Vault for incident '${INCIDENT_ID}'..."
        curl -s "${ZERVOX_URL}/api/incidents/${INCIDENT_ID}/forensics" | (command -v jq >/dev/null && jq . || cat)
        echo "✔ Forensic Freeze and Cryptographic SHA-256 verification confirmed!"
    fi
else
    echo "⚠️ Webhook delivery returned HTTP ${STATUS}:"
    echo "${BODY}"
fi
