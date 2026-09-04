# Zervox ⚡

> **Autonomous Resilient Kubernetes SRE Incident Remediation Engine**

Zervox is an out-of-band, high-availability SRE engine engineered to survive catastrophic control-plane failures. It autonomously ingests alerts, attempts AI-driven remediation, enforces immutable blast-radius boundaries, and self-heals its own master process.

---

## 🏗 Architecture & Deployment Topology

```text
                                     [ OUT-OF-BAND SRE DOMAIN ]
                                   
   ┌────────────────────────────────────────────────────────────────────────────────────────┐
   │                                                                                        │
   │   ┌────────────────────┐                            ┌──────────────────────────────┐   │
   │   │ Next.js UI         │                            │  STANDBY NODE                │   │
   │   │ (Control Plane)    │◄──[ REST Telemetry ]───────┤  [ zervox-core --backup ]    │   │
   │   │ localhost:3000     │                            │                              │   │
   │   └─────────▲──────────┘                            └──────────────▲───────────────┘   │
   │             │                                                      │                   │
   │             │                                                      │ (mTLS Heartbeat)  │
   │             │                                                      ▼                   │
   │   ┌─────────▼──────────────────────────────────────────────────────┴───────────────┐   │
   │   │ ACTIVE PRIMARY NODE (zervox-core --primary)                                    │   │
   │   │                                                                                │   │
   │   │  [ Ingestion Gate ] (JWT Auth / Fuzz-Tested)                                   │   │
   │   │          │                                                                     │   │
   │   │          ├─────────────────────────────────────────┐                           │   │
   │   │          ▼                                         ▼                           │   │
   │   │  [ AI Engine ] ◄──(Timeout / Network Cut)──► [ Local Fallback ]                │   │
   │   │  (gpt-4o-mini)                               (Deterministic)                   │   │
   │   │          │                                         │                           │   │
   │   │          └────────────────┬────────────────────────┘                           │   │
   │   │                           ▼                                                    │   │
   │   │                 [ OPA Rego Security Gate ] ◄───────► [ Embedded OPA Server ]   │   │
   │   │                 (Immutable Blast-Radius)             (localhost:8181)          │   │
   │   │                           │                                                    │   │
   │   │                           ▼ (Allowed Actions)                                  │   │
   │   │                 [ Kubernetes Executor ]                                        │   │
   │   │                           │                                                    │   │
   │   │                           ▼                                                    │   │
   │   │                 [ SQLite WAL / IncidentStore ]                                 │   │
   │   └───────────────────────────┬────────────────────────────────────────────────────┘   │
   └───────────────────────────────┼────────────────────────────────────────────────────────┘
                                   │
      ┌────────────────────────────┼──────────────────────────────────────────────────┐
      │ KUBERNETES CLUSTER         │ (kube-rs via TLS)                                │
      │                            ▼                                                  │
      │   [ Prometheus ] ──(Webhook Alerts)──► (victim-api / Deployments / Pods)      │
      └───────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Capabilities

1. **Deterministic Local Fallback**: If external LLM networks are severed, Zervox instantly defaults to verified local remediation.
2. **mTLS Watchdog Failover**: Built-in Primary/Backup active-standby topology utilizing mutually authenticated TLS TCP heartbeats. Standby promotes to active leader instantly on primary failure.
3. **OPA Blast-Radius Enforcement**: All actions must clear an unbypassable Rego policy gate preventing namespace destruction and container escapes.
4. **Out-Of-Band Autonomy**: Designed explicitly to run outside the Kubernetes failure domain, breaking the "Host Paradox" of embedded operators.

---

## 🛠 Deployment (Docker Compose)

The entire stack (Rust Core, Standby Core, OPA Server, and Next.js UI) runs seamlessly via Docker Compose:

```bash
docker-compose up --build -d
```

- **Next.js Control Plane**: `http://localhost:3000`
- **Core Engine API**: `http://localhost:8080/api/status`

## 📊 Testing & Chaos Simulation

Inject an organic OOMKilled payload to observe the end-to-end resolution pipeline:
```bash
kubectl apply -f infra/demo-app/victim-memory-leak.yaml
```
