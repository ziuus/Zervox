# Zervox ⚡

> **Autonomous Resilient Kubernetes SRE Incident Remediation Engine**

Zervox is an external, resilient SRE engine designed to run safely outside the Kubernetes failure domain. It ingests Prometheus & Alertmanager alerts, leverages LLM-driven root cause analysis with automatic fallback to deterministic rules, enforces strict unbypassable Open Policy Agent (OPA) security boundaries, and provides high-availability watchdog failover.

---

## 🏗 Architecture Overview

```
Alertmanager Webhook  ──► [ Ingestion & Auth Gate ]
                                   │
                                   ▼
                       [ LLM RCA with Timeout ] ──(on timeout/error)──► [ Local Fallback Engine ]
                                   │                                            │
                                   └──────────────┬─────────────────────────────┘
                                                  ▼
                                      [ OPA Rego Security Gate ]
                                      (Unbypassable Blast-Radius Guard)
                                                  │ (Allowed)
                                                  ▼
                                      [ Kubernetes Executor ] (kube-rs)
                                                  │
                                                  ▼
                                      [ SQLite WAL Incident Store ]
```

---

## 🚀 Key Capabilities

1. **Deterministic Local Fallback Mode**: If external LLMs or internet connections are disrupted, Zervox seamlessly drops to local verified deterministic remediation rules without downtime.
2. **Unbypassable Policy Gate (OPA & Embedded Rego Guard)**: Every remediation decision must be validated before execution. Strict rules prevent namespace deletion, container shell execution (`exec`), and out-of-bounds replica scaling (> 10).
3. **High-Availability Watchdog & Self-Preservation**: Built-in Primary/Backup active-standby topology with lightweight TCP heartbeat. If the primary instance goes down, the backup promotes itself to Active within seconds.
4. **Persistent SQLite WAL Incident Store**: All incoming alerts, decisions, policy checks, and execution results are persisted with SQLite Write-Ahead Logging (WAL) and 5s busy timeouts.

---

## 🛠 Quick Start

### 1. Build & Test Locally

```bash
cd zervox-core
cargo test --all
cargo run -- --role primary --http-port 8080 --heartbeat-port 9000
```

### 2. Run with Docker Compose (Full Stack with OPA & HA Backup)

```bash
docker compose up --build
```

### 3. Open the Status Dashboard

Navigate to: `http://localhost:8080/status`

---

## 📊 API Reference

- `GET /healthz` - Health probe endpoint
- `GET /status` - Rich HTML visual control plane
- `GET /api/status` - JSON status telemetry & recent incident log
- `POST /api/grafana_webhook` - Alertmanager webhook ingestion (requires `x-api-key` or `Authorization: Bearer` token)
- `POST /api/simulate_attack` - Security demonstration endpoint for testing OPA blast-radius enforcement

---

## 📁 Repository Structure

- `zervox-core/` — Rust engine (Ingest, LLM, Fallback, OPA Client, Executor, SQLite Store, Watchdog)
  - `policies/zervox.rego` — Rego security and authorization policy
- `infra/` — Cluster provisioning, Helm monitoring values, demo manifests, chaos injection scripts
  - `chaos-scripts/` — Automated chaos scripts (pod crash, RBAC attack, network outage, primary kill)
- `scripts/demo-runbook.sh` — Interactive demo runbook script
- `docs/` — Architecture and build specifications
