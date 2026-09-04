# Zervox ⚡
> **Autonomous Resilient Kubernetes SRE Incident Remediation Engine**
> *Engineered for Mission-Critical Infrastructure & Kerala Police Cyberdome Digital Forensics*

[![Rust Core](https://img.shields.io/badge/Rust-1.85+-orange.svg?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg?style=flat-square&logo=next.js)](https://nextjs.org/)
[![OPA](https://img.shields.io/badge/OPA-Rego%20v1-blue.svg?style=flat-square&logo=open-policy-agent)](https://www.openpolicyagent.org/)
[![Tests](https://img.shields.io/badge/Tests-31%2F31%20Passed-emerald.svg?style=flat-square)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](LICENSE)

Zervox is an **out-of-band, high-availability SRE engine** engineered to survive catastrophic Kubernetes control-plane failures. It autonomously ingests alerts, conducts AI-powered root-cause analysis, preserves tamper-evident forensic memory traces, enforces unbypassable hardware and OPA security gates, and self-heals its own leadership topology via active-standby mTLS heartbeats.

---

## 🏗 Architecture & Deployment Topology

```text
                                     [ OUT-OF-BAND SRE DOMAIN ]
                                   
   ┌────────────────────────────────────────────────────────────────────────────────────────┐
   │                                                                                        │
   │   ┌────────────────────────┐                        ┌──────────────────────────────┐   │
   │   │ Next.js Control Plane  │                        │  STANDBY DORMANT NODE        │   │
   │   │ (Port 3000)            │◄──[ REST Telemetry ]───┤  [ zervox-core --backup ]    │   │
   │   │ • Forensic Vault UI    │                        │                              │   │
   │   │ • Air-Gap Optical QR   │                        └──────────────▲───────────────┘   │
   │   │ • Proof Simulation Bar │                                       │                   │
   │   └───────────▲────────────┘                                       │ (mTLS Heartbeat)  │
   │               │                                                    ▼                   │
   │   ┌───────────▼────────────────────────────────────────────────────┴────────────────┐   │
   │   │ ACTIVE PRIMARY LEADER (zervox-core --primary)                                  │   │
   │   │                                                                                │   │
   │   │  [ Ingestion Gate ] (JWT Auth / Alertmanager / Fuzz-Tested)                    │   │
   │   │          │                                                                     │   │
   │   │          ├─────────────────────────────────────────┐                           │   │
   │   │          ▼                                         ▼                           │   │
   │   │  [ AI Engine ] ◄──(10s Wall Clock / Cut)──► [ Local Fallback ]                 │   │
   │   │  (gpt-4o-mini)                              (Deterministic Rules)              │   │
   │   │          │                                         │                           │   │
   │   │          └────────────────┬────────────────────────┘                           │   │
   │   │                           ▼                                                    │   │
   │   │                 [ OPA Rego Security Gate ] ◄───────► [ Embedded OPA Server ]   │   │
   │   │                 (Immutable Blast-Radius)             (localhost:8181)          │   │
   │   │                           │                                                    │   │
   │   │                 [ Adaptive Immune System ]                                     │   │
   │   │                 (30-Min Dynamic Quarantine on Repeating Attacks)               │   │
   │   │                           │                                                    │   │
   │   │          ┌────────────────┴────────────────────────┐                           │   │
   │   │          ▼                                         ▼                           │   │
   │   │  [ Forensic Freeze Vault ]             [ Hardware Circuit-Breaker ]            │   │
   │   │  (SHA-256 Memory Snapshot)             (ESP32-C3 / RISC-V Dual-Key)            │   │
   │   │          │                                         │                           │   │
   │   │          └────────────────┬────────────────────────┘                           │   │
   │   │                           ▼                                                    │   │
   │   │                 [ Kubernetes Executor ] (Server-Side Apply force)              │   │
   │   │                           │                                                    │   │
   │   │                           ▼                                                    │   │
   │   │                 [ SQLite WAL Store ] (5s Busy Timeout / Retry Backoff)         │   │
   │   └───────────────────────────┬────────────────────────────────────────────────────┘   │
   └───────────────────────────────┼────────────────────────────────────────────────────────┘
                                   │
      ┌────────────────────────────┼──────────────────────────────────────────────────┐
      │ KUBERNETES CLUSTER         │ (kube-rs via TLS)                                │
      │                            ▼                                                  │
      │   [ Prometheus ] ──(Webhook Alerts)──► (victim-api / Deployments / Nodes)     │
      └───────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏆 Hackathon Innovation Showcase (HAC'KP 2026)

See full technical documentation in [`docs/INNOVATIONS.md`](docs/INNOVATIONS.md).

1. **Forensic Freeze Vault (Pre-Remediation Evidence Preservation)**:
   - *Problem*: Standard auto-healing instantly deletes broken pods, permanently destroying volatile memory, active network sockets, and attacker artifacts.
   - *Innovation*: Captures memory dumps, container tail logs, and pod specs, computes an immutable **SHA-256 cryptographic digest**, and locks it into the forensic vault before pod destruction.

2. **Physical Dual-Key Hardware Circuit-Breaker (RISC-V / ESP32-C3 Guard)**:
   - *Problem*: If an AI model or API token is poisoned, malicious prompts could instruct the engine to cordon all cluster nodes.
   - *Innovation*: Destructive cluster-level actions require physical challenge-response cryptographic authorization from an embedded RISC-V coprocessor over UART.

3. **Adaptive Policy Tightening (Self-Learning Immune System)**:
   - *Problem*: Traditional rule gates evaluate incoming incidents in isolation, allowing repeated probing.
   - *Innovation*: Tracks violation frequencies across workloads. If repeated attacks occur (≥ 2 within session), the workload is dynamically placed under a **30-minute quarantine lockdown**, pre-emptively blocking further execution.

4. **Air-Gapped Optical Telemetry (Zero-Packet Extraction)**:
   - *Problem*: In classified networks, SCADA control rooms, or during complete network isolation, operators cannot connect web browsers.
   - *Innovation*: Cryptographically signs health and incident data into a real-time high-density **QR visual matrix** on the dashboard for zero-packet optical capture.

---

## 📡 API Reference Catalog

| Endpoint | Method | Description |
|:---|:---:|:---|
| `/healthz` | `GET` | Health probe returning role, cluster state, and uptime |
| `/api/status` | `GET` | Telemetry payload (engine mode, peer status, incident feed, hardware state) |
| `/api/grafana_webhook` | `POST` | Prometheus / Alertmanager / Grafana webhook ingestion endpoint |
| `/api/v1/alerts` | `POST` | Prometheus native alert webhook endpoint |
| `/api/simulate_attack` | `POST` | Security simulation trigger (evaluates OPA / Immune gate) |
| `/api/incidents/:id/forensics` | `GET` | Retrieve cryptographic SHA-256 forensic snapshot package |
| `/api/immune/status` | `GET` | Inspect workloads currently under active 30-minute quarantine |
| `/api/immune/reset` | `POST` | Operator override to release workload from quarantine |
| `/api/hardware/status` | `GET` | Query physical RISC-V / ESP32 coprocessor armed state |
| `/api/hardware/toggle` | `POST` | Toggle hardware circuit-breaker arm/disarm simulation |

---

## 🧪 Test Suite & Quality Verification

```bash
cd zervox-core
cargo test --all
```

- **Unit Tests**: 25/25 PASSED (Policy OPA rules, LLM fallback timeouts, Hardware breaker, SQLite WAL retry, Watchdog promotion)
- **Fuzz Tests**: 1/1 PASSED (Arbitrary byte Grafana webhook payload fuzzing)
- **Integration Tests**: 5/5 PASSED (E2E Webhook, Security policy rejection, Health check, Status telemetry)
- **Total**: **31/31 passing tests with 0 failures**.

---

## 🚀 Live Demo & Chaos Engineering Runbook

Run the interactive terminal orchestrator to demonstrate all 6 scenarios live to judges:

```bash
chmod +x scripts/demo-runbook.sh
./scripts/demo-runbook.sh
```

### Supported Scenarios:
1. **Scenario 1: Organic Pod OOM Crash → Forensic Freeze & Auto-Restart**
2. **Scenario 2: Malicious RBAC Namespace Deletion → OPA Gate Blocked**
3. **Scenario 3: Total WAN Cut → Instant Deterministic Local Fallback**
4. **Scenario 4: Primary Node SIGKILL → Dormant Standby Watchdog Promotion (<6s)**
5. **Scenario 5: Node Cordon → Physical Dual-Key Hardware Circuit-Breaker Verification**
6. **Scenario 6: Repeating Attack → Adaptive Immune System 30-Minute Quarantine**

---

## 🛠 Docker Stack Quickstart

Launch the complete 4-service stack:
```bash
docker compose up --build -d
```

- **Control Plane UI**: [http://localhost:3000](http://localhost:3000)
- **Primary Core API**: [http://localhost:8080/api/status](http://localhost:8080/api/status)
- **OPA Policy Server**: [http://localhost:8181/v1/data/zervox/authz](http://localhost:8181/v1/data/zervox/authz)
