# Zervox — Task Split (2 People)

Refer to `BUILD_GUIDE.md` for all technical detail. This doc only assigns ownership, order, and sync points.

---

## Person A — "Core" (Zervox engine, Rust)
Owns: `zervox-core/`

1. Project skeleton + dependencies (Cargo.toml set up)
2. `/api/grafana_webhook` ingestion endpoint with auth check — **ship this first**, Person B is blocked on it for their Alertmanager config
3. LLM call wrapper with timeout + retry/backoff
4. Local Fallback rule table (3 rules: pod restart, scale-in-cap, no-op default)
5. OPA policy integration (`opa run --server` + `policies/zervox.rego` + HTTP client from Rust)
6. Executor (`kube-rs`) — restart pod, scale deployment, cordon node
7. SQLite WAL incident store
8. Watchdog / leader-election (primary + backup binaries)
9. Minimal status endpoint (`/status`) showing: current mode (AI/fallback), primary/backup role, last 5 incidents — needed for the demo narration in step 1 and 7 of the runbook

## Person B — "Infra" (cluster, monitoring, chaos)
Owns: `infra/`

1. k3s cluster on VM 1, verified with `kubectl get nodes`
2. Hand kubeconfig to Person A as soon as cluster is up — **don't wait until it's "polished"**
3. `kube-prometheus-stack` via Helm, Grafana reachable
4. Demo victim app deployed (`infra/demo-app/`)
5. Alertmanager webhook config pointed at Person A's `/api/grafana_webhook` (once step A2 above is live)
6. Chaos scripts: pod-crash, rbac-attack, network-outage (+restore), kill-zervox-primary — each tested solo first
7. VM 2 (and optionally VM 3) provisioned for Zervox primary/backup, network reachability to VM 1 confirmed
8. Demo runbook script (`scripts/demo-runbook.sh`) that runs the full sequence with pauses for narration

---

## Build Order & Dependencies

```
Day 1 AM   Person A: skeleton + webhook stub        Person B: k3s up, hand off kubeconfig
Day 1 PM   Person A: LLM+fallback logic              Person B: monitoring stack + demo app
Day 1 EOD  ── Checkpoint 1: webhook receives a real alert from B's cluster ──
Day 2 AM   Person A: OPA integration + executor       Person B: chaos scripts (solo-tested)
Day 2 PM   ── Checkpoint 2 & 3: executor really restarts a pod; full pod-crash pipeline works ──
Day 3 AM   Person A: SQLite store + watchdog          Person B: VM2/3 provisioning, network outage script
Day 3 PM   ── Checkpoint 4, 5, 6: RBAC block, fallback mode, primary/backup failover ──
Final day  Both: joint rehearsal of full demo runbook, 3x minimum
```

Adjust day counts to your actual hackathon length — the point is the checkpoint order: **don't let both tracks build in isolation past checkpoint 1**, since integration mismatches (auth headers, payload shape, kubeconfig permissions) are the highest-risk failure and are cheapest to catch early.

## Interface Contract (the only things that must match exactly)

| Item | Owned by | Consumed by | Must match |
|---|---|---|---|
| Kubeconfig | B | A | Cluster address, valid token/cert, RBAC permissions for pod/deployment/node actions |
| `/api/grafana_webhook` URL + auth header format | A | B (Alertmanager config) | Exact path, exact header name (`x-api-key` or `Authorization: Bearer`) |
| Alert payload shape (Alertmanager's default JSON) | B (sends) | A (parses) | Confirm against real Alertmanager output, not assumed schema |
| Demo app name/namespace/labels | B | A (fallback rules reference `app=victim-api`) | Keep label selectors identical everywhere |
| Zervox primary/backup ports (9000 for heartbeat, 8080 for webhook) | A | B (chaos scripts, network rules) | Don't change without telling the other person |

## Definition of Done (for demo readiness)
- [ ] All 6 integration checkpoints from BUILD_GUIDE.md pass
- [ ] Full demo runbook rehearsed 3x without manual intervention
- [ ] Restore scripts (network, namespace cleanup) confirmed to leave the environment clean between rehearsals
- [ ] A fallback (recording or screenshots) exists in case live injection misfires on stage
