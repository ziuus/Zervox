# Zervox — Build Guide
### Complete reference for building and demoing the system
**Audience:** the two builders (or coding agents assisting them). This document is the single source of truth — refer back to it instead of re-deriving decisions mid-build.

---

## 0. Repo Layout

```
zervox/
├── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUILD_GUIDE.md          ← this file
│   └── TASK_SPLIT.md
├── zervox-core/                ← Track A: the Rust engine
│   ├── src/
│   │   ├── main.rs
│   │   ├── ingest.rs           # webhook receivers (Grafana/Prometheus alerts)
│   │   ├── llm.rs              # LLM call + timeout/backoff + fallback trigger
│   │   ├── fallback.rs         # local deterministic rule table
│   │   ├── policy.rs           # OPA client / rego evaluation
│   │   ├── executor.rs         # kube-rs actions (restart, scale, isolate)
│   │   ├── store.rs            # SQLite WAL incident state
│   │   └── watchdog.rs         # heartbeat / leader-election
│   ├── policies/
│   │   └── zervox.rego
│   ├── Cargo.toml
│   └── Dockerfile
├── infra/                      ← Track B: cluster, monitoring, chaos
│   ├── k3s-setup.sh
│   ├── helm/
│   │   └── values-monitoring.yaml
│   ├── demo-app/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── chaos-scripts/
│       ├── pod-crash.sh
│       ├── rbac-attack.sh
│       ├── network-outage.sh
│       └── kill-zervox-primary.sh
└── scripts/
    └── demo-runbook.sh         # the exact live-demo sequence
```

---

## 1. System Overview (recap)

Zervox is a Rust binary that runs **outside** a Kubernetes cluster, on its own VM, and:
1. Ingests Prometheus/Grafana alerts + K8s audit events.
2. Tries LLM-based root cause analysis; on timeout, switches to a small local rule table (**Local Fallback Mode**).
3. Every proposed action — AI or fallback — passes through an OPA/Rego policy gate before execution.
4. Persists incident state to local SQLite (WAL mode).
5. Runs as two instances with a heartbeat; if the primary goes silent, the backup takes over (**Self-Preservation**).

---

## 2. Environment Topology

| Machine | Role | Owner (Track) |
|---|---|---|
| VM 1 | k3s single-node cluster (control plane + workload) | B |
| VM 1 (in-cluster) | `kube-prometheus-stack` (Prometheus, Grafana, Alertmanager) | B |
| VM 1 (in-cluster) | Demo "victim" app (simple API + DB) | B |
| VM 2 | Zervox primary instance (native binary or Docker) | A |
| VM 3 (or 2nd process on VM 2) | Zervox backup instance | A |

Zervox on VM 2/3 must be able to reach: the k3s API server on VM 1 (via kubeconfig), and the Grafana/Alertmanager webhook endpoint on VM 1. Keep both VMs on the same private network or VPC for simplicity — don't spend hackathon time on cross-region networking.

---

## 3. TRACK B — Infrastructure & Demo Environment

### 3.1 Stand up k3s (single-node, "real" Kubernetes)

On VM 1 (Ubuntu, e.g. AWS t3.medium):
```bash
curl -sfL https://get.k3s.io | sh -
sudo kubectl get nodes          # verify: one node, Ready
```
Copy the kubeconfig off the box for anyone who needs remote `kubectl`/`kube-rs` access:
```bash
sudo cat /etc/rancher/k3s/k3s.yaml
# replace the "server: https://127.0.0.1:6443" with the VM's public/private IP
# save locally as ~/.kube/zervox-config
```
This kubeconfig is the interface contract with Track A — hand it to them as soon as it exists.

### 3.2 Deploy monitoring stack

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace
kubectl -n monitoring get pods    # wait until all Running
```
Port-forward Grafana to check it's alive:
```bash
kubectl -n monitoring port-forward svc/prometheus-grafana 3000:80
# open http://<vm-ip>:3000, login admin / prom-operator
```
Configure an Alertmanager webhook receiver pointing at Zervox's ingestion endpoint (`http://<zervox-vm-ip>:8080/api/grafana_webhook`) — this is the second interface contract with Track A. Do this once Track A has a working `/api/grafana_webhook` endpoint, even a stub that just logs the payload.

### 3.3 Deploy the demo "victim" app

Keep this deliberately simple — a small API + a DB (or just an nginx deployment if time is short; the point is something Zervox can restart/scale/isolate, not a complex app).

`infra/demo-app/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: victim-api
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels: { app: victim-api }
  template:
    metadata:
      labels: { app: victim-api }
    spec:
      containers:
        - name: victim-api
          image: nginx:latest
          ports: [{ containerPort: 80 }]
```
```bash
kubectl apply -f infra/demo-app/deployment.yaml
kubectl get pods -l app=victim-api
```

### 3.4 Chaos / failure-injection scripts

Keep every script idempotent and safe to re-run. Test each one solo before combining into the full demo runbook.

**Pod crash** (`chaos-scripts/pod-crash.sh`):
```bash
#!/bin/bash
POD=$(kubectl get pods -l app=victim-api -o jsonpath='{.items[0].metadata.name}')
echo "Killing pod: $POD"
kubectl delete pod "$POD"
```

**RBAC attack simulation** (`chaos-scripts/rbac-attack.sh`):
```bash
#!/bin/bash
kubectl create ns test-ns --dry-run=client -o yaml | kubectl apply -f -
kubectl create sa attacker -n test-ns --dry-run=client -o yaml | kubectl apply -f -
if kubectl auth can-i delete namespace default --as=system:serviceaccount:test-ns:attacker; then
  echo "ATTACK: deletion allowed — BAD"
else
  echo "ATTACK BLOCKED — namespace delete correctly denied"
fi
```
This demonstrates the attempt; Zervox's own OPA layer is the thing that should independently also refuse to *execute* such an action if it were ever proposed by the AI/fallback layer — narrate both layers in the demo.

**Network outage** (`chaos-scripts/network-outage.sh`) — run this **on VM 1**, and always keep an SSH session open in a separate window before running it:
```bash
#!/bin/bash
sudo iptables -F
sudo iptables -P INPUT DROP
sudo iptables -P OUTPUT DROP
sudo iptables -A INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
echo "Network cut except SSH. Restore with restore-network.sh"
```
`chaos-scripts/restore-network.sh`:
```bash
#!/bin/bash
sudo iptables -F
sudo iptables -P INPUT ACCEPT
sudo iptables -P OUTPUT ACCEPT
echo "Network restored."
```

**Kill Zervox primary** (`chaos-scripts/kill-zervox-primary.sh`) — run on VM 2:
```bash
#!/bin/bash
pkill -f zervox-primary || echo "already down"
```

### 3.5 Track B checklist
- [ ] k3s cluster up, `kubectl get nodes` clean
- [ ] kube-prometheus-stack installed, Grafana reachable
- [ ] Alertmanager webhook pointed at Zervox ingestion endpoint
- [ ] Demo victim app deployed and stable
- [ ] All 4 chaos scripts tested individually, and restore scripts confirmed working
- [ ] Kubeconfig handed to Track A

---

## 4. TRACK A — Zervox Core Engine (Rust)

### 4.1 Project skeleton

```bash
cargo new zervox-core
cd zervox-core
cargo add tokio --features full
cargo add axum          # web server for webhook ingestion
cargo add rusqlite --features bundled
cargo add kube --features runtime
cargo add k8s-openapi --features latest
cargo add reqwest --features json
cargo add serde --features derive
cargo add serde_json
```

### 4.2 Ingestion endpoint (`src/ingest.rs`)

Minimum viable version: an Axum route that accepts Alertmanager webhook POSTs, checks a bearer token / `x-api-key` header, and logs + stores the payload.
```rust
// POST /api/grafana_webhook
// - reject if missing/invalid auth header -> 401
// - parse JSON payload
// - hand off to correlation/analysis step
```
Build this first — Track B needs it live before they can wire Alertmanager to it.

### 4.3 LLM call + fallback trigger (`src/llm.rs`)

```rust
// pseudocode
async fn analyze(alert: &Alert) -> Decision {
    match timeout(Duration::from_secs(10), call_llm(alert)).await {
        Ok(Ok(decision)) => decision,
        _ => {
            // exponential backoff already attempted inside call_llm;
            // hard timeout or exhausted retries -> switch modes
            log::warn!("LLM unreachable, entering Local Fallback Mode");
            fallback::match_rule(alert)
        }
    }
}
```
Retry/backoff belongs *inside* `call_llm` (2–3 attempts, short backoff) — don't retry forever. The `timeout()` wrapper is what guarantees you always fall through to `fallback::match_rule` within a bounded time, which is what makes this demoable on stage.

### 4.4 Local Fallback rule table (`src/fallback.rs`)

Keep this intentionally small — 3 rules is enough for a hackathon demo and matches the "narrow, low-risk action set" story in your docs.

```rust
pub fn match_rule(alert: &Alert) -> Decision {
    if alert.matches("PodCrashLooping") || alert.matches("PodNotReady") {
        Decision::RestartPod(alert.resource_name())
    } else if alert.matches("HighLatency") || alert.matches("HighErrorRate") {
        Decision::ScaleWithinCap(alert.resource_name(), current_replicas + 1)
    } else {
        Decision::NoAction  // never guess outside the known set
    }
}
```

### 4.5 OPA policy gate (`src/policy.rs` + `policies/zervox.rego`)

Run OPA as a sidecar/local process (`opa run --server`) and query it over HTTP, or embed via the `regorus` Rust crate if you want zero extra process. For a hackathon, running standalone `opa run --server` on the same VM and hitting `localhost:8181` is faster to set up and easier to demo (you can literally show the OPA server logs).

`policies/zervox.rego` (from your existing spec — keep as-is):
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
Every decision from either `llm.rs` or `fallback.rs` must be serialized and POSTed to OPA before `executor.rs` is allowed to touch the cluster. No code path skips this — this is the "unbypassable" claim in your pitch, so it needs to be structurally true (one function, one call site) not just true by convention.

### 4.6 Executor (`src/executor.rs`)

Wraps `kube-rs` calls with retry/backoff, using the same kubeconfig Track B hands you:
```rust
// restart_pod(name) -> kube Api::delete (K8s recreates via ReplicaSet)
// scale_deployment(name, replicas) -> kube Api::patch scale subresource
// isolate_node / cordon -> kube Api::patch node with taint
```

### 4.7 SQLite WAL store (`src/store.rs`)

```rust
let conn = Connection::open("zervox.db")?;
conn.pragma_update(None, "journal_mode", &"WAL")?;
conn.busy_timeout(Duration::from_secs(5))?;
// table: incidents(id, alert, decision, mode ['ai'|'fallback'], action, status, timestamp)
```
Both the primary and backup instance should point at the **same** SQLite file (on shared storage, or replicate on handover) so a failover doesn't lose incident history — even a simple approach (backup reads the same file path over a mounted network share, or just re-opens the file post-takeover) is enough for the demo.

### 4.8 Watchdog / leader election (`src/watchdog.rs`)

Use the TCP-bind approach from the research doc — it's genuinely the fastest correct thing to build for this scope:
```rust
// primary: binds 0.0.0.0:9000, accepts connections as proof-of-life
// backup: connects to primary_ip:9000 every 2s
//   - success -> sleep, retry
//   - failure -> assume primary dead, start own ingestion+execution loop
```
For the demo, run "primary" and "backup" as two separate processes/binaries (`zervox --role=primary` / `zervox --role=backup --peer=<primary-ip>`) so `chaos-scripts/kill-zervox-primary.sh` has something concrete to `pkill`.

### 4.9 Track A checklist
- [ ] `/api/grafana_webhook` live and auth-checked (unblocks Track B's Alertmanager config)
- [ ] LLM call with timeout + fallback trigger working (test by pointing at a dead API URL)
- [ ] Fallback rule table returns a decision for at least "pod crash" and "high latency"
- [ ] OPA denies namespace-delete and shell-exec, allows pod restart / in-cap scale — test both paths
- [ ] Executor can restart a pod and scale a deployment on Track B's cluster
- [ ] SQLite WAL file persists incidents across a process restart
- [ ] Primary/backup watchdog: killing primary causes backup to take over within a few seconds

---

## 5. Integration Checkpoints (do these together, not solo)

| Checkpoint | What to verify | Both present? |
|---|---|---|
| 1 | Track A's webhook receives a real Alertmanager POST from Track B's cluster | Yes |
| 2 | Track A's executor can actually restart a pod in Track B's cluster (real kubeconfig, real result) | Yes |
| 3 | Full pipeline: `chaos-scripts/pod-crash.sh` → alert fires → Zervox restarts it → visible in Grafana | Yes |
| 4 | OPA blocks the RBAC-attack script's underlying action if fed through Zervox's decision path | Yes |
| 5 | `network-outage.sh` on VM 1 → Zervox on VM 2 detects LLM unreachable → Local Fallback Mode fires → action still happens | Yes |
| 6 | `kill-zervox-primary.sh` → backup takes over → next chaos script still gets handled | Yes |

Do not let these two tracks stay separate until the last day — checkpoint 1 should happen as early as day 1/2, since it's the thing most likely to reveal a mismatch (wrong port, wrong payload shape, auth header mismatch).

---

## 6. Demo Runbook (final form, script this precisely)

1. Show Grafana dashboard, cluster healthy, Zervox primary + backup both showing "alive" in your own status view.
2. Run `pod-crash.sh` → narrate: alert fires, Zervox restarts it, show it in the incident log (SQLite dump or a tiny status endpoint).
3. Run `rbac-attack.sh` → narrate: OPA blocks the dangerous action; show the deny message.
4. Run `network-outage.sh` on VM 1 → narrate: Zervox loses LLM reachability, switches to Local Fallback Mode, still resolves the next injected pod-crash without external AI.
5. Run `restore-network.sh`.
6. Run `kill-zervox-primary.sh` → narrate: backup instance takes over within seconds, keeps handling incidents.
7. Close on the incident timeline / report view, showing the full sequence end-to-end.

Rehearse this exact sequence at least 3 times before presenting. Keep `restore-network.sh` and a manual pod-restart command ready in a spare terminal in case a script doesn't fire on cue — per the research notes, have a fallback narration ("here's what it does, here's a recording from our test run") ready rather than fighting a live failure in front of judges.

---

## 7. Explicit Non-Goals for This Build

To keep both tracks focused, do **not** build: multi-region DR, full CI/CD pipeline with branching strategy, cost/FinOps tooling, chaos engineering framework (Chaos Mesh etc. — hand-rolled scripts are enough), formal governance/change-control workflow, IPMI/hardware resets, full mesh-node survival beyond the two-instance pair.
