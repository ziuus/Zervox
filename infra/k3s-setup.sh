#!/usr/bin/env bash
set -euo pipefail

# ==========================================
# Zervox Infrastructure: k3s Single-Node Setup
# ==========================================

echo "================================================="
echo "⚡ Setting up k3s Kubernetes Environment for Zervox"
echo "================================================="

if ! command -v curl &> /dev/null; then
    echo "Error: curl is required to install k3s"
    exit 1
fi

if command -v kubectl &> /dev/null && kubectl get nodes &> /dev/null; then
    echo "✔ Kubernetes cluster is already active and reachable."
else
    echo "→ Installing k3s single-node cluster..."
    curl -sfL https://get.k3s.io | sh -
fi

echo "→ Verifying cluster node status..."
sudo kubectl get nodes -o wide

# Extract and configure kubeconfig for remote access
KUBECONFIG_DIR="${HOME}/.kube"
mkdir -p "${KUBECONFIG_DIR}"
KUBECONFIG_FILE="${KUBECONFIG_DIR}/zervox-config"

echo "→ Exporting kubeconfig to ${KUBECONFIG_FILE}..."
sudo cat /etc/rancher/k3s/k3s.yaml > "${KUBECONFIG_FILE}"
sudo chmod 600 "${KUBECONFIG_FILE}"

# Identify host IP
HOST_IP=$(hostname -I | awk '{print $1}')
echo "→ Updating server address to https://${HOST_IP}:6443 in ${KUBECONFIG_FILE}"
sed -i "s/127.0.0.1/${HOST_IP}/g" "${KUBECONFIG_FILE}" || true

echo "✔ Cluster ready!"
echo "To use this cluster in your shell:"
echo "  export KUBECONFIG=${KUBECONFIG_FILE}"
echo "  kubectl get pods -A"
