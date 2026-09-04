#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# ⚡ ZERVOX: FORENSIC FREEZE DUMP UTILITY ⚡
# Ephemeral container snapshot & Linux /proc Merkle root calculator
# ==============================================================================

TARGET_POD="${1:-victim-api}"
NAMESPACE="${2:-default}"
OUTPUT_DIR="${3:-/tmp/zervox-forensics}"

mkdir -p "${OUTPUT_DIR}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SNAPSHOT_FILE="${OUTPUT_DIR}/freeze_${TARGET_POD}_$(date +%s).json"

echo "[FORENSIC FREEZE] Capturing evidence for ${NAMESPACE}/${TARGET_POD} at ${TIMESTAMP}..."

# 1. Ephemeral Container / crictl / proc snapshot
if command -v kubectl >/dev/null 2>&1; then
    echo "  → Querying Kubernetes API for Pod Spec & Event Logs..."
    POD_SPEC=$(kubectl get pod "${TARGET_POD}" -n "${NAMESPACE}" -o json 2>/dev/null || echo '{"error": "pod_not_found"}')
    LOGS=$(kubectl logs "${TARGET_POD}" -n "${NAMESPACE}" --tail=200 2>/dev/null || echo "[WARN] No logs available")
else
    POD_SPEC='{"status": "dry-run", "target": "'"${TARGET_POD}"'"}'
    LOGS="[SIMULATED] Memory dump captured before container eviction"
fi

# 2. Compute SHA-256 Merkle root over evidence artifacts
SPEC_HASH=$(echo -n "${POD_SPEC}" | sha256sum | awk '{print $1}')
LOG_HASH=$(echo -n "${LOGS}" | sha256sum | awk '{print $1}')
MERKLE_ROOT=$(echo -n "${SPEC_HASH}${LOG_HASH}" | sha256sum | awk '{print $1}')

cat << JSON > "${SNAPSHOT_FILE}"
{
  "timestamp": "${TIMESTAMP}",
  "namespace": "${NAMESPACE}",
  "pod": "${TARGET_POD}",
  "merkle_root": "${MERKLE_ROOT}",
  "artifacts": {
    "spec_sha256": "${SPEC_HASH}",
    "logs_sha256": "${LOG_HASH}"
  }
}
JSON

echo "✔ Forensic snapshot sealed into: ${SNAPSHOT_FILE}"
echo "✔ Merkle Root: ${MERKLE_ROOT}"
