# Zervox
## Autonomous Air-Gapped Cyber Resilience Engine
### Complete Project Documentation

**Industry 4.0 — Automation For Good**
**Track: IT Security and Cyber Resilience**

---

## Table of Contents

1. Executive Summary
2. Problem Statement
3. Core Philosophy
4. System Overview
5. Architecture
6. How It Works — The Full Pipeline
7. Key Innovations
8. Recovery Mechanisms (Deep Dive)
9. Security & Policy Guardrails
10. Technical Stack
11. Infrastructure & Deployment Architecture
12. Crisis Scenarios / Use Cases
13. Testing & Validation Strategy
14. Demo Plan
15. Repository Structure
16. Team & Work Division
17. Roadmap
18. Glossary
19. Conclusion

---

## 1. Executive Summary

Zervox is an autonomous, self-hosted resilience engine that protects Kubernetes-based infrastructure during crises — cyberattacks, network outages, or infrastructure failures — by operating **outside** the systems it protects, so that a compromise of the primary environment does not compromise Zervox itself.

It watches infrastructure through standard observability tools (Prometheus/Grafana), reasons about incidents using an LLM when available, falls back to a small set of pre-approved deterministic actions when the LLM or network is unreachable, and enforces every action — regardless of source — through an unbypassable policy firewall (OPA/Rego) before anything touches the live cluster. Zervox also protects itself: a second instance takes over automatically if the primary is knocked out.

Built in Rust for a minimal resource footprint, backed by SQLite in WAL mode for reliable local state, and designed to run on constrained backup hardware, Zervox is meant to answer one question directly: **when the systems that protect your infrastructure go down, what protects them?**

---

## 2. Problem Statement

Modern infrastructure depends on layers of automation: AIOps platforms, LLM-assisted operations tools, dashboards, and auto-remediation scripts. Almost all of them share a structural weakness — **they depend on the exact systems they are meant to protect.**

Two failure patterns recur across real-world incidents:

### 2.1 The Host Paradox
Monitoring and remediation tools typically run **inside** the cluster or network they protect. When an attacker wipes RBAC permissions, deletes namespaces, or locks out administrators, the protection tool is taken down along with everything else. The defender and the defended share a single point of failure.

### 2.2 The External Dependency Trap
Most modern automation relies on external LLM APIs for reasoning and decision-making. During a grid failure, telecom outage, or targeted network disruption, that external "intelligence" becomes unreachable at precisely the moment it is needed most — leaving the system either stalled or blindly retrying a dead connection.

Standard AIOps tooling is designed for the good day. Zervox is designed for the worst one.

---

## 3. Core Philosophy

The hackathon track poses a direct question:

> *"When a crisis strikes, who or what will you save — or, at the end, save you?"*

Zervox's answer: **we protect the infrastructure that everything else runs on.**

Emergency services, hospitals, telecom networks, and power grids all ultimately depend on compute infrastructure. If that infrastructure fails silently during a crisis, every system built on top of it fails with it. Zervox sits beneath that layer, functioning as the last line of defense when the systems above it stop working.

This raises a natural follow-up: **if Zervox exists to save everything else, what saves Zervox?** This is answered structurally, not just philosophically — through out-of-band deployment, a deterministic fallback mode, and self-preserving redundancy, all detailed in Sections 6 and 8.

---

## 4. System Overview

At a high level, Zervox is an **autonomous incident-remediation engine** with four defining properties:

| Property | Description |
|---|---|
| **Out-of-band** | Runs on a separate node/VM, physically isolated from the cluster it protects |
| **Degrading gracefully, not silently** | Switches from AI-reasoning to a bounded local rule set instead of stalling when external dependencies fail |
| **Policy-gated** | Every action, from any source, is checked against a hard, code-level safety policy before execution |
| **Self-preserving** | Runs as a primary/backup pair with heartbeat-based failover, so Zervox itself has no single point of failure |

### What it does, step by step (plain description)
1. Watches for alerts from Prometheus/Grafana and audit events from Kubernetes.
2. Tries to understand the root cause using an LLM.
3. If the LLM can't be reached, switches to a small, pre-approved list of safe local actions.
4. Checks every proposed action against a strict policy engine (OPA) before doing anything.
5. Executes the action (or queues it for human approval, depending on configuration).
6. Records the entire incident locally so nothing is lost even if connectivity or availability is disrupted.

---

## 5. Architecture

### 5.1 Deployment Topology

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│         VM 1 (Cluster)       │        │        VM 2 (Zervox Primary)  │
│  ┌────────────────────────┐ │        │  ┌──────────────────────────┐ │
│  │   k3s (single-node K8s) │ │◄───────┤  │   Zervox core (Rust)     │ │
│  │   - Demo/victim workload│ │  kube  │  │   - Ingestion            │ │
│  │   - kube-prometheus-    │ │  API   │  │   - LLM + Fallback       │ │
│  │     stack (Prom/Grafana/│ │◄───────┤  │   - OPA policy gate      │ │
│  │     Alertmanager)       │ │webhook │  │   - Executor (kube-rs)   │ │
│  └────────────────────────┘ │        │  │   - SQLite WAL store     │ │
└─────────────────────────────┘        │  │   - Watchdog (leader)    │ │
                                        │  └──────────────────────────┘ │
                                        └──────────────┬─────────────────┘
                                                        │ heartbeat (TCP)
                                        ┌──────────────▼─────────────────┐
                                        │       VM 3 (Zervox Backup)      │
                                        │   Same components, standby      │
                                        │   role — takes over on primary  │
                                        │   heartbeat loss                │
                                        └──────────────────────────────────┘
```

Zervox is deliberately **not** deployed inside the cluster it protects. This is what makes the "Host Paradox" solution structurally true rather than a claim — a full compromise of VM 1 does not affect VM 2/3.

### 5.2 Component Responsibilities

| Component | Responsibility |
|---|---|
| Ingestion (Axum web server) | Receives authenticated webhook alerts from Alertmanager/Grafana |
| LLM Reasoning Layer | Root cause analysis via external LLM API, with timeout + backoff |
| Local Fallback Engine | Small, hardcoded rule table for when the LLM is unreachable |
| OPA / Rego Policy Gate | Hard-coded, unbypassable safety rules evaluated before any action executes |
| Executor (kube-rs) | Carries out approved actions against the Kubernetes API |
| SQLite (WAL mode) Store | Local, low-contention persistence of incident state |
| Watchdog / Leader Election | Heartbeat-based failover between primary and backup instances |

---

## 6. How It Works — The Full Pipeline

```
Prometheus / Grafana Alert
        │
        ▼
Zervox Ingestion (authenticated webhook)
        │
        ▼
Correlate alert + logs + audit trail
        │
   ┌────┴────┐
   ▼         ▼
LLM        LLM
Reachable  Unreachable
   │      (retry/backoff exhausted,
   │       hard timeout hit)
   ▼         ▼
AI-Proposed   Local Fallback Mode:
Remediation   match against small
              pre-approved rule set
   └────┬────┘
        ▼
OPA Rego Policy Engine (hard gate)
        │
   ┌────┴────┐
   ▼         ▼
🛑 BLOCKED   ✅ APPROVED
(namespace   (pod restart, scale
 delete,     within cap, reroute,
 RBAC edit,  isolate node)
 shell exec,
 secret read)
        │
        ▼
Execute (or queue for human approval)
        │
        ▼
Persist incident to SQLite (WAL)
```

Both the AI-reasoning path and the Local Fallback path converge on the **same** policy gate — there is no code path that bypasses OPA, regardless of how the decision was reached.

---

## 7. Key Innovations

| Innovation | Why It Matters |
|---|---|
| **Graceful degradation, not silent failure** | Most AIOps tools stall or do nothing when their LLM API times out. Zervox treats that timeout as an expected crisis condition and switches to a bounded, safe action set automatically. |
| **Policy beneath the AI, not beside it** | The safety layer does not trust the intelligence layer at all — even a hallucinating or manipulated AI cannot issue a destructive action, because OPA evaluates every action independent of its source. |
| **True out-of-band deployment** | Zervox does not run inside the cluster it protects, so a full compromise of the primary environment does not take Zervox down with it. |
| **Zero-contention local state** | SQLite in WAL mode with short busy-timeouts keeps recording incident data reliably even under heavy load or partial system failure, without depending on an external database that could itself be part of the outage. |
| **Configurable autonomy** | A single setting (`ZERVOX_REQUIRE_APPROVAL`) switches between full autonomy and human-in-the-loop approval, without needing a separate system. |
| **Self-preservation, not just self-service** | A watchdog/leader-election pair means Zervox does not just fix other systems' failures — it survives its own. |

---

## 8. Recovery Mechanisms (Deep Dive)

This section directly answers the track's core question: what saves Zervox when Zervox is the thing meant to save everything else?

### 8.1 Local Fallback Mode

Zervox already performs retries with exponential backoff on every LLM API call, wrapped in a hard timeout (10 seconds by default). Rather than retrying indefinitely, that same detection point now triggers a real recovery path:

- Once the LLM is confirmed unreachable, Zervox switches into **local-only mode**.
- A small, deliberately narrow set of **pre-approved, low-risk remediations** becomes available without any external call: pod/service restarts, and scaling actions that stay within the existing replica cap (also enforced by OPA).
- These actions were chosen because they are reversible and bounded — Local Fallback Mode is a smaller, safer toolkit, not a place to introduce more autonomy.
- The OPA policy gate still applies in full. This mode bypasses the LLM, never the safety rules.

**Why it matters:** the moment external connectivity fails is exactly the moment most automation goes silent — and exactly the moment Zervox is needed most. This turns an unreachable AI from a dead end into a mode switch.

### 8.2 Self-Preservation for Zervox's Own Host

A single Zervox instance is itself a single point of failure — the exact problem the tool exists to solve for other systems. To close that gap:

- Zervox runs as at least two instances: a primary and a backup.
- The primary emits a heartbeat (a simple TCP-bind based signal is sufficient for this scope).
- If the backup stops receiving that heartbeat — due to crash, host failure, or targeted attack — it takes over automatically as the new primary.
- Both instances read/write the same SQLite-backed incident store, so a handover does not mean losing incident history or starting from zero.

**Why it matters:** this is the structural difference between "a tool that fixes other systems' outages" and "a tool that also survives its own" — the most literal possible answer to the track's closing question.

---

## 9. Security & Policy Guardrails

Zervox treats its own reasoning layer — AI or local rule-based — as untrusted. Every proposed action passes through a Rego policy evaluation before it is allowed to execute.

**Absolute blocks enforced at all times:**
- 🚫 Deletion of any namespace, under any condition
- 🚫 Container shell execution (`kubectl exec -it` or equivalent)
- 🚫 RBAC modification (ClusterRole, RoleBinding, ServiceAccount edits)
- 🚫 Direct reads of Kubernetes Secret resources
- 📏 Hard cap of 10 replicas on any scaling action (enforced identically in AI mode and Local Fallback Mode)

**Additional guardrails:**
- All HTTP ingestion endpoints require Bearer token / `x-api-key` authentication; unauthenticated requests are rejected outright.
- Human-in-the-loop approval can be enforced globally via configuration for regulated or higher-risk environments.

```rego
package zervox.authz
default allow = false

deny[msg] {
    input.action == "delete"
    input.resource == "namespace"
    msg := "CRITICAL: Namespace deletion is absolutely prohibited during autonomous execution."
}
deny[msg] {
    input.command[_] == "exec"
    msg := "CRITICAL: Container shell execution is blocked."
}
deny[msg] {
    input.action == "scale"
    input.target_replicas > 10
    msg := "CRITICAL: Replica cap exceeded."
}
```

---

## 10. Technical Stack

| Layer | Technology | Reasoning |
|---|---|---|
| Core engine | Native Rust (cross-compiled x86_64/aarch64) | Minimal CPU/RAM footprint; runs on constrained backup hardware |
| Web/ingestion | Axum | Lightweight async HTTP server for webhook ingestion |
| Storage | SQLite (WAL mode, 5s busy timeout) | No external DB dependency; zero lock contention; supports state handover on failover |
| Policy | OPA + Rego | Declarative, auditable, unbypassable safety layer |
| Reasoning | External LLM API, with Local Fallback Mode | Root cause analysis when available, bounded rule-based path when not |
| Availability | Watchdog / leader-election (TCP heartbeat) between instances | Removes Zervox itself as a single point of failure |
| Cluster control | kube-rs | Native async Kubernetes API interaction with retry/backoff |
| Distribution | Docker + native binaries | One-line install; runs standalone or containerized |
| Monitoring (of protected system) | Prometheus, Grafana, Alertmanager (`kube-prometheus-stack`) | Standard, production-plausible observability feeding Zervox's ingestion |
| Cluster runtime (demo) | k3s (single-node) | Real Kubernetes, lightweight enough to stand up quickly for a demo environment |

---

## 11. Infrastructure & Deployment Architecture

### 11.1 Demo Environment Topology
- **VM 1** — k3s single-node cluster running the demo "victim" workload and the full `kube-prometheus-stack` (Prometheus, Grafana, Alertmanager).
- **VM 2** — Zervox primary instance, running as a native binary or in Docker, outside the cluster.
- **VM 3** (or a second process on VM 2, if resource-constrained) — Zervox backup instance.

### 11.2 Setup Summary
1. Install k3s on VM 1 (`curl -sfL https://get.k3s.io | sh -`).
2. Deploy `kube-prometheus-stack` via Helm for monitoring.
3. Deploy the demo victim workload (a simple API/deployment).
4. Deploy Zervox on VM 2/3, pointed at VM 1's kubeconfig and Alertmanager webhook.
5. Configure Alertmanager to send webhook alerts to Zervox's `/api/grafana_webhook` endpoint.

### 11.3 Chaos / Failure-Injection Tooling
A small set of scripts simulate real crisis conditions during the demo:
- **Pod crash** — deletes a pod to trigger detection and auto-restart.
- **RBAC attack simulation** — attempts an unauthorized namespace deletion to demonstrate policy blocking.
- **Network outage** — uses `iptables` to sever connectivity except SSH, simulating a grid/telecom-style outage and triggering Local Fallback Mode.
- **Kill Zervox primary** — terminates the primary process to trigger backup takeover.

Each script has a corresponding restore step and is tested individually before being run in sequence.

---

## 12. Crisis Scenarios / Use Cases

**Scenario A — Malicious Insider / RBAC Wipe**
An attacker with stolen credentials attempts to delete namespaces and modify RBAC to lock out administrators. Zervox ingests the anomalous audit trail within milliseconds, the OPA guardrail blocks the prohibited action, and a pre-approved remediation isolates the compromised access before a human is even paged.

**Scenario B — Total Network Severance**
A grid failure or telecom outage cuts external connectivity. The LLM API becomes unreachable. Zervox's existing retry/backoff logic detects this and, instead of retrying indefinitely, switches into Local Fallback Mode — matching the alert signature against a small local rule set and executing a bounded, safe remediation with zero external dependency.

**Scenario C — Zervox's Own Host Goes Silent**
The machine running the primary Zervox instance crashes or is directly targeted. The backup instance, monitoring the primary's heartbeat, detects the silence and takes over as the active responder — so incident response does not stall simply because the responder itself went down.

---

## 13. Testing & Validation Strategy

| Layer | What's Verified |
|---|---|
| Unit | Fallback rule matching, policy evaluation logic, SQLite read/write under WAL mode |
| Integration | Webhook ingestion against real Alertmanager payloads; executor actions against a real k3s cluster |
| Chaos / Fault Injection | Pod crash, RBAC attack attempt, network outage, primary instance kill — each run individually before being combined |
| End-to-End | Full pipeline run: alert → decision (AI or fallback) → policy check → execution → persistence, observed live in Grafana and Zervox's own incident log |
| Failover | Confirm backup instance takes over within a few seconds of primary heartbeat loss, and that incident history is not lost |

Integration between the infrastructure and engine tracks is checkpointed early and often — waiting until the final day to connect the two halves is treated as the highest-risk failure mode for this project and is explicitly avoided.

---

## 14. Demo Plan

1. Show the cluster and dashboard healthy; both Zervox instances reporting alive.
2. Trigger a pod crash → show Zervox detecting and restarting it, logged in the incident view.
3. Trigger the RBAC attack script → show OPA blocking the dangerous action live.
4. Cut network access to simulate an outage → show Zervox switching to Local Fallback Mode and still resolving an injected failure without AI or internet access.
5. Restore network access.
6. Kill the primary Zervox instance → show the backup taking over within seconds and continuing to handle incidents.
7. Close on the full incident timeline, showing the entire sequence end-to-end.

This sequence is rehearsed multiple times ahead of presentation, with restore scripts and a recorded fallback available in case a live injection does not fire exactly as expected.

---

## 15. Repository Structure

```
zervox/
├── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUILD_GUIDE.md
│   └── TASK_SPLIT.md
├── zervox-core/            # Rust engine
│   ├── src/
│   │   ├── main.rs
│   │   ├── ingest.rs       # webhook ingestion
│   │   ├── llm.rs          # LLM call + timeout/backoff + fallback trigger
│   │   ├── fallback.rs     # local deterministic rule table
│   │   ├── policy.rs       # OPA client
│   │   ├── executor.rs     # kube-rs actions
│   │   ├── store.rs        # SQLite WAL incident state
│   │   └── watchdog.rs     # heartbeat / leader-election
│   ├── policies/
│   │   └── zervox.rego
│   ├── Cargo.toml
│   └── Dockerfile
├── infra/                  # cluster, monitoring, chaos
│   ├── k3s-setup.sh
│   ├── helm/
│   ├── demo-app/
│   └── chaos-scripts/
└── scripts/
    └── demo-runbook.sh
```

A single repository, split by folder rather than separate repositories, keeps the interface contract between the engine and infrastructure visible and versioned together, and gives judges one place to evaluate the entire system.

---

## 16. Team & Work Division

| Track | Owner | Scope |
|---|---|---|
| **Core (Rust engine)** | Person A | Ingestion, LLM + fallback logic, OPA integration, executor, SQLite store, watchdog/failover |
| **Infrastructure & Demo** | Person B | k3s cluster, monitoring stack, demo workload, chaos-injection scripts, VM provisioning |

The two tracks share a small, explicit interface contract: the kubeconfig, the webhook endpoint URL and auth format, the alert payload shape, demo app naming, and the heartbeat/webhook ports. These are the only details that must match exactly between the two people's work, and are synchronized at defined integration checkpoints rather than left until final assembly.

---

## 17. Roadmap (Transparent Future Work)

- **Full mesh-node survival** — extending the two-instance failover model into a broader mesh of Zervox instances, so the active/commander role can move across many nodes rather than a single backup pair.
- **Hardware-level resets** — integrating IPMI/Redfish APIs to physically power-cycle frozen servers when the software layer itself becomes entirely unresponsive.

These are explicitly scoped as future work and are not part of the current build, to keep the hackathon implementation focused and demonstrable.

---

## 18. Glossary

| Term | Meaning |
|---|---|
| **OPA / Rego** | Open Policy Agent — a policy engine using the Rego language to declare hard rules that decide whether an action is allowed |
| **RBAC** | Role-Based Access Control — the permission system in Kubernetes controlling who can do what |
| **WAL mode** | Write-Ahead Logging — a SQLite mode that improves reliability and concurrency under load |
| **LLM** | Large Language Model — used here for AI-driven root cause analysis |
| **k3s** | A lightweight, fully compliant Kubernetes distribution suited for constrained or edge environments |
| **kube-rs** | A Rust client library for interacting with the Kubernetes API |
| **Watchdog / Leader Election** | A mechanism where one instance is designated active ("leader") and others stand by, ready to take over if the leader stops responding |
| **Out-of-band** | Deployed and operating separately from the system being monitored/protected, so a failure in one does not directly cause failure in the other |
| **Host Paradox** | The problem where a protection tool runs inside the system it protects, so a compromise takes both down together |

---

## 19. Conclusion

Most automation tooling is built to make a good day faster and easier. Zervox is built for the day when nothing else is working — when the network is down, the AI is unreachable, and no engineer is available to help. It does not assume the cloud, the network, or a human will be there when needed, and it does not even fully trust itself, which is why it is designed to hand off to a backup instance of itself and fall back to a simpler, more reliable version of itself whenever the smarter option disappears.

> Standard tools protect infrastructure when things are working.
> **Zervox protects infrastructure when nothing else is — including itself.**
