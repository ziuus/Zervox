
# Zervox: Master System Specification
**Autonomous Air-Gapped Cyber Resilience Engine**
**Track:** IT Security & Cyber Resilience | Industry 4.0 — Automation For Good[cite: 6]

## 1. System Philosophy & Purpose
Zervox is a proactive last-responder engine designed to protect critical infrastructure when all other systems, networks, and personnel fail[cite: 6]. It operates entirely out-of-band to mitigate two fatal architectural flaws in modern monitoring:
* **The Host Paradox:** Security tools deployed inside the cluster they monitor are destroyed if the cluster's RBAC or control plane is compromised[cite: 6].
* **The External Dependency Trap:** Cloud-dependent AI remediation tools hang or crash when network outages sever their connection to external LLM APIs[cite: 6].

Zervox assumes the worst-case scenario. It switches from intelligent AI-driven remediation to deterministic local rules when the network drops, blocks its own actions via immutable policies, and self-heals if its primary process is killed[cite: 6].

## 2. Infrastructure & Network Topology
The environment strictly isolates the workload from the protection engine to guarantee survivability[cite: 4].

### Track B: Infrastructure (The Victim Environment)
* **VM 1 (k3s Cluster):** A single-node k3s instance acting as the vulnerable control plane and worker node[cite: 4, 5].
* **Monitoring Stack:** Runs `kube-prometheus-stack` installed via Helm to provide Prometheus, Grafana, and Alertmanager[cite: 4].
* **Demo Workload:** A lightweight dummy API (`nginx:latest`) with 3 replicas, utilized as the target for scaling and pod-crash simulations[cite: 4].

### Track A: Zervox Core (The Protection Engine)
* **VM 2 (Primary Node):** Hosts the main Zervox Rust binary, the SQLite database, and the OPA server[cite: 4].
* **VM 3 (Backup Node / Process):** Runs the secondary Zervox instance polling the primary via a TCP heartbeat[cite: 4]. 
* **Network Contracts:** The Rust engine on VM 2/3 must possess network reachability to VM 1's API server (via `kubeconfig`) and VM 1's Alertmanager webhook endpoint[cite: 4].

## 3. Core Engine Architecture (Rust)
The Zervox engine is a modular, high-performance Rust binary minimizing CPU and memory overhead[cite: 6]. 

### 3.1. Webhook Ingestion (`ingest.rs`)
* Exposes a `POST /api/grafana_webhook` endpoint utilizing `axum`[cite: 4].
* Mandates strict authentication via a bearer token or `x-api-key` header[cite: 4]. Unauthenticated payloads are rejected instantly with a 401[cite: 4].

### 3.2. Dual-Tier Reasoning (`llm.rs` & `fallback.rs`)
* **Primary Analysis:** Queries an external LLM for root-cause analysis with short, exponential backoff retries[cite: 4]. 
* **Local Fallback Mode:** The LLM request is wrapped in a hard 10-second `timeout`[cite: 4]. If unreachable, the engine drops into a local deterministic rule table[cite: 4, 6].
* **Fallback Rules:** 
  * `PodCrashLooping` or `PodNotReady` ➔ Trigger Pod Restart[cite: 4].
  * `HighLatency` or `HighErrorRate` ➔ Scale up within cap[cite: 4].
  * Any unknown alert ➔ NoAction (never guesses outside the known set)[cite: 4].

### 3.3. Unbypassable Policy Gate (`policy.rs` & `zervox.rego`)
Before execution, every proposed action is serialized and evaluated by a local Open Policy Agent (OPA) server running on `localhost:8181`[cite: 4]. Zervox is hard-coded to deny[cite: 6]:
* **Namespace Deletion:** `input.action == "delete"` and `input.resource == "namespace"`[cite: 4].
* **Container Shell Execution:** `input.command[_] == "exec"`[cite: 4].
* **Runaway Scaling:** `input.action == "scale"` and `input.target_replicas > 10`[cite: 4].
* **Permission Escalation:** Modifying RBAC, roles, or service accounts[cite: 6].
* **Secret Access:** Directly reading private data[cite: 6].

### 3.4. Execution & State (`executor.rs` & `store.rs`)
* **Executor:** Uses `kube-rs` to authenticate with Track B's `kubeconfig` and perform sanitized actions (pod deletion, deployment patching for scale, node cordoning)[cite: 4, 5].
* **State Persistence:** All incident data, mode switches, and OPA verdicts are written to a bundled SQLite database[cite: 4]. The database uses `journal_mode=WAL` (Write-Ahead Logging) with a 5-second busy timeout to guarantee integrity under heavy read/write concurrency and allow the backup instance to resume smoothly[cite: 4, 6].

## 4. High-Availability & Self-Preservation
Zervox avoids becoming a single point of failure by actively defending itself[cite: 6].
* **Leader Election (`watchdog.rs`):** The primary instance binds to `0.0.0.0:9000` and accepts connections as proof of life[cite: 4]. 
* **Automated Takeover:** The backup instance polls `primary_ip:9000` every 2 seconds[cite: 4]. If the connection drops, the backup immediately assumes the primary role, instantiates its own ingestion web server, and takes over the execution loop reading from the shared WAL database[cite: 4, 6].

## 5. Interface Contracts
To prevent integration failure between Track A and Track B, these specifications must align perfectly[cite: 5]:
* **Kubeconfig:** Track B must provide Track A with an RBAC-permissioned configuration for pod, deployment, and node actions[cite: 5].
* **Webhook Routing:** Alertmanager on Track B must point precisely to `http://<zervox-vm-ip>:8080/api/grafana_webhook` with the agreed `x-api-key`[cite: 4, 5].
* **Ports:** `8080` for the ingestion webhook; `9000` for the HA heartbeat[cite: 5].
* **Label Selectors:** The fallback rules explicitly target `app=victim-api`[cite: 5].

## 6. Chaos Testing & Verification Procedures
The system must successfully withstand four live-injected failure modes[cite: 4, 5]:
1. **Workload Failure (`pod-crash.sh`):** Deletes the victim pod; Zervox must catch the alert and trigger a restart via the LLM pipeline[cite: 4].
2. **Malicious Actor (`rbac-attack.sh`):** Simulates a namespace deletion attempt; the OPA gate must forcefully block execution and log the denial[cite: 4].
3. **Dependency Outage (`network-outage.sh`):** Drops all VM 1 TCP output except SSH via `iptables`[cite: 4]. Zervox must time out, seamlessly drop into Local Fallback Mode, and resolve subsequent incidents without AI[cite: 4, 6].
4. **Responder Assassination (`kill-zervox-primary.sh`):** Executes `pkill -f zervox-primary`[cite: 4]. The backup heartbeat must fail, promoting the backup instance to active duty within seconds[cite: 4].

## 7. Future Roadmap
* **Full Mesh Node Survival:** Evolving from a primary/backup pair into a decentralized mesh where the active control role can float across multiple nodes seamlessly[cite: 6].
* **Physical Hardware Resets:** Integrating IPMI/Redfish protocols to execute hard server reboots when the OS/software layer is completely frozen[cite: 6].

a new documentation ,maybe store this in some file

<ADDITIONAL_METADATA>
The current local time is: 2026-09-04T21:33:52+05:30.
</ADDITIONAL_METADATA>
<USER_SETTINGS_CHANGE>
The user changed setting `Model Selection` from Gemini 3.7 Flash (Medium) to Gemini 3.1 Pro (Low). No need to comment on this change if the user doesn't ask about it. If reporting what model you are, please use a human readable name instead of the exact string.
</USER_SETTINGS_CHANGE>
