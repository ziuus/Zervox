# Zervox ⚡
> **Autonomous Resilient Kubernetes SRE Incident Remediation Engine**
> *Engineered for Mission-Critical Infrastructure & Kerala Police Cyberdome Digital Forensics*

[![Rust Core](https://img.shields.io/badge/Rust-1.85+-orange.svg?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2%20App%20Router-black.svg?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v3%20Class%20Theme-blue.svg?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![OPA](https://img.shields.io/badge/OPA-Rego%20v1-blue.svg?style=flat-square&logo=open-policy-agent)](https://www.openpolicyagent.org/)
[![Tests](https://img.shields.io/badge/Tests-41%2F41%20Passed-emerald.svg?style=flat-square)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](LICENSE)

Zervox is an **out-of-band, high-availability SRE resilience engine** engineered to survive catastrophic Kubernetes control-plane failures. Operating strictly outside the clusters it protects, Zervox autonomously ingests alerts, conducts AI and deterministic root-cause analysis, preserves tamper-evident forensic memory traces, enforces unbypassable hardware and OPA security gates, and self-heals its own leadership topology via active-standby mTLS heartbeats.

---

## 🖥️ Modern Multi-Page Control Plane (Next.js App Router)

The Zervox UI is built on a clean, modern SaaS design system (inspired by Linear and Vercel) with dedicated, spacious routes and high-contrast Light/Dark mode accessibility:

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ⚡ Zervox SRE    [Overview]    [Incidents]    [Forensics & Air-Gap]    [Chaos]   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

| Route | Page Name | Core Capabilities & Components |
|:---|:---|:---|
| **`/`** | **System Dashboard & Telemetry** | • **Dual-Engine Watchdog**: Telemetry cards for Primary Engine (Track A) & Backup Engine (Track B) with round-trip latency, uptime, and peer mTLS status.<br>• **Autonomous Engine Mode**: Real-time AI (cloud LLM) vs Deterministic Fallback status.<br>• **Split-Brain Sentinel Graph**: Full-width interactive network topology map with one-click mTLS heartbeat sever simulation.<br>• **8-Point KPI Matrix**: Live health checkpoints for Commander, State, Mode, Hardware, Uptime, Incidents, OPA, and K8s. |
| **`/incidents`** | **Incident Control & Remediation** | • **Glass Box Root Cause Trail**: 4-step visualizer revealing raw alert payload, prompt construction, LLM reasoning chain vs 1.2ms fallback execution, and OPA policy evaluation.<br>• **Remediation Timeline**: Vertical SQLite WAL audit ledger displaying tamper-evident Merkle hashes, execution times, and one-click cryptographic snapshot downloads. |
| **`/forensics`** | **Air-Gap Defense & Forensic Vault** | • **Forensic Freeze Frame**: Pre-remediation `/proc` memory dumps and open socket dumps sealed with SHA-256 Merkle trees before container restarts.<br>• **Optical QR Data Diode**: Fullscreen camera-scannable QR beacon transmitting telemetry across physical air-gaps without network cables.<br>• **Ed25519 Attestation Beacon**: Continuous cryptographic signature rotating every 3s with active socket breach detection.<br>• **OPA Rego Diff Modal**: Visual comparison of blocked destructive actions vs safe remediation alternatives. |
| **`/chaos`** | **Judges Chaos Simulation Bench** | • **One-Click Injections**: Pod Crash Loop (01), Malicious RBAC Deletion (02), Node Cordon Dual-Key (03), Repeating Attack Adaptive Immune Quarantine (04).<br>• **Live Feedback Banners**: Instant visual confirmation with direct deep-links to WAL ledger and forensic snapshots.<br>• **Primary Host Kill Simulator**: Heartbeat failover test ensuring sub-3s backup promotion with zero data loss. |

---

## 🎨 Theme & Accessibility System

- **Light Mode**: Crisp white (`#ffffff`) surface with deep slate typography (`#0f172a`, `#334155`) and deep teal accents (`#0f766e`) passing strict WCAG AAA contrast standards.
- **Dark Mode**: Deep slate (`#020617`) canvas with subtle gray borders (`rgba(255,255,255,0.08)`) and soft teal glowing accents.
- **Class-Based Switching**: Fully synchronized `.dark` class and `data-theme` attribute powered by `darkMode: 'class'` in Tailwind to eliminate OS preference conflicts and FOUC.

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

### 🏆 Hackathon Innovation Showcase (HAC'KP 2026)

See full technical documentation in [`docs/INNOVATIONS.md`](docs/INNOVATIONS.md) and pending tasks in [`TODO.md`](TODO.md).

1. **Forensic Freeze Frame (Immutable Evidence Snapshot Before Remediation)**:
   - *Problem*: Standard auto-healing instantly deletes broken pods, permanently destroying volatile memory, active network sockets, and attacker artifacts.
   - *Innovation*: On threat detection, captures `/proc` memory dumps and network sockets into an immutable **SHA-256 Merkle tree**, writing to an append-only ledger before container teardown.
   - *Policy Guarantee*: Rego gate enforces `remediate == true only if evidence_hash != null`.

2. **Glass Box Root Cause Trail (LLM Reasoning Chain Visualizer)**:
   - *Problem*: SOC teams distrust black-box AI remediation because nobody can audit why actions fired.
   - *Innovation*: Emits a structured chain-of-thought decision graph with live confidence percentages. If the LLM exceeds a **10s deadline**, the graph visibly reroutes to the deterministic rule engine in **1.2ms**.

3. **Policy Firewall Replay (Rego Gate "Blocked Action" Theater)**:
   - *Problem*: Zero-trust automation demos only show the happy path, never proving the safety ceiling.
   - *Innovation*: Staged attack replay with live diff modal: proposed destructive action (strikethrough) vs allowed alternative, citing exact Rego rule `REG-001`.

4. **Split-Brain Sentinel (Live Failover Visualization)**:
   - *Problem*: HA claims are difficult to prove without causing chaos in production.
   - *Innovation*: Real-time topology map connected by an mTLS heartbeat link (`TCP 9000`). Severing primary triggers automated sub-3s backup promotion with **zero dropped incidents** via replicated SQLite WAL.

5. **Air-Gap Attestation Beacon (Cryptographic Isolation Proof)**:
   - *Problem*: Regulated facilities (critical infra, police crime labs) require proof of zero internet egress.
   - *Innovation*: Continuous Ed25519 cryptographic attestation signed every 3s into the immutable ledger, with real-time breach detection if an unauthorized socket is opened.

---

## 🛡️ Autonomous Cyber Threat Intelligence & Remediation Engine

Zervox analyzes raw Kubernetes control plane behavior rather than just hardware telemetry, correlating multi-stage attacks across an uncompromisable out-of-band sliding window:

### 1. Kubernetes Audit Webhook & Threat Signatures (`POST /api/v1/audit`)
Ingests standard Kubernetes Audit Webhook JSON batches (`EventList`, single `Event`, or arrays) and executes real-time signature matching:
- **`SIG-DESTRUCTIVE-API` (+80 Score)**: Malicious or unauthorized deletion of namespaces or cluster nodes.
- **`SIG-PRIV-CONTAINER` (+50 Score)**: Spawning privileged containers, `hostPID`/`hostNetwork` escapes, or host root filesystem mounts.
- **`SIG-RBAC-TAMPER` (+40 Score)**: Unauthorized patching or creation of `ClusterRole`, `Role`, `ClusterRoleBinding`, or `RoleBinding`.
- **`SIG-SECRET-SWEEP` (+30 Score)**: Bulk unauthorized reconnaissance or sweeping access to cluster secrets (`GET /api/v1/secrets`).
- **`SIG-UNKNOWN-IDENTITY` (+20 Score)**: Anomalous access patterns from unauthenticated subjects or unrecognized service accounts.

### 2. Stateful Threat Correlation & Integer Scoring Matrix
Suspicious events are buffered in a thread-safe sliding window (**5-minute TTL**) keyed by normalized actor identities (ServiceAccount > Source IP > User). Cumulative threat scores determine autonomous escalation:
- **`0 – 30` (LOW)**: Passive logging & baseline observation.
- **`31 – 60` (MEDIUM)**: Automatic alert elevation, SOC notification, and forensic memory snapshotting.
- **`61 – 80` (HIGH)**: Targeted workload containment (safe pod eviction / replica restart).
- **`81 – 100+` (CRITICAL)**: Immediate automated cluster isolation via zero-trust network quarantine.

### 3. Closed-Loop Remediation Verification & Dynamic Containment
- **Dynamic NetworkPolicy Quarantine**: When critical attacks or repeat violations occur, Zervox dynamically synthesizes and applies a default-deny Ingress and Egress `NetworkPolicy` targeting the compromised workload using `kube-rs` and `k8s-openapi`.
- **Post-Action Polling Loop**: Following any remediation action (e.g. `RestartPod`), the engine polls the Kubernetes API until the target workload reaches desired state (`Pod phase == Running` and condition `Ready == True`), avoiding assumption-based healing.
- **Automated Escalation Matrix**: If post-remediation polling times out or fails (e.g., container crashloops or threat score keeps rising), Zervox automatically escalates containment:
  $$\text{RestartPod Failure} \longrightarrow \text{NetworkPolicy Quarantine} \longrightarrow \text{Node Cordon}$$

---

## 📡 API Reference Catalog

| Endpoint | Method | Description |
|:---|:---:|:---|
| `/healthz` | `GET` | Health probe returning role, cluster state, and uptime |
| `/api/status` | `GET` | Telemetry payload (engine mode, peer status, incident feed, hardware state) |
| `/api/telemetry` | `GET` | Next.js server-side unified telemetry route (zero CORS / zero browser shields issue) |
| `/api/action` | `POST` | Next.js server-side chaos & simulation proxy route |
| `/api/v1/audit` | `POST` | Kubernetes Audit Webhook ingestion for threat signatures & correlation |
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

- **Unit Tests**: 34/34 PASSED (Policy OPA rules, Threat signatures, Correlation sliding window, NetworkPolicy quarantine, Closed-loop verification & escalation, Hardware breaker, SQLite WAL retry, Watchdog promotion)
- **Fuzz Tests**: 1/1 PASSED (Arbitrary byte Grafana webhook payload fuzzing)
- **Integration Tests**: 6/6 PASSED (E2E Webhook, Audit Webhook threat detection & correlation, Security policy rejection, Health check, Status telemetry)
- **Total**: **41/41 passing tests with 0 failures**.

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

| Service | Endpoint | Description |
|:---|:---|:---|
| **Control Plane UI** | [http://localhost:3000](http://localhost:3000) | Next.js 14 App Router Multi-Page Control Plane |
| **Primary Core Engine** | [http://localhost:8080](http://localhost:8080) | Active Leader (Ingestion, OPA, WAL, TCP 9000 Heartbeat) |
| **Backup Core Engine** | [http://localhost:8081](http://localhost:8081) | Dormant Standby Sentinel (mTLS Polling Listener) |
| **OPA Policy Server** | [http://localhost:8181](http://localhost:8181) | Rego Zero-Trust Policy Decision Engine |

To view live service logs:
```bash
docker compose logs -f zervox-ui zervox-primary
```
