# Zervox ⚡ — Engineering Roadmap & Pending Tasks

> **Kerala Police Cyberdome — HAC'KP 2026 Hackathon**  
> **Target Award:** Best Innovation Award & Cybersecurity SRE Resilience

---

## ⚡ Quick Sync Instructions for Teammates (Get Latest Code)

If your local branch is behind, diverged, or experiencing git/docker issues, run the following commands to pull the exact latest state from `main` without conflicts:

```bash
# 1. Fetch latest commits from remote
git fetch origin main

# 2. Hard reset your working branch to match remote main exactly
git reset --hard origin/main

# 3. Clean any untracked or leftover build artifacts
git clean -fd

# 4. Pull fresh dependencies & compile UI standalone
cd zervox-ui && npm install && npm run build && cd ..

# 5. Rebuild & launch the full stack in Docker
docker compose down -v
docker compose up --build -d

# 6. Verify stack health
curl -s http://localhost:8080/healthz
curl -s http://localhost:3000/api/telemetry
```

---

## 🏆 Completed Milestones (Production Ready)

- [x] **Rust SRE Engine (`zervox-core`)**:
  - [x] Axum HTTP server with `/healthz`, `/api/status`, `/api/v1/alerts`, `/api/simulate_attack`
  - [x] 31/31 unit & integration tests passing (`cargo test`)
  - [x] mTLS watchdog heartbeat on `TCP 9000` with active/standby automated failover
  - [x] Dual-tier reasoning: LLM analyzer with hard 10s timeout + sub-1.2ms deterministic fallback
  - [x] Open Policy Agent (OPA) embedded boundary integration
  - [x] Append-only SQLite WAL incident store with retry backoff
  - [x] Dynamic Adaptive Immune System (30-minute lockdown on repeated attack vectors)
  - [x] Hardware Circuit-Breaker challenge-response verification for destructive actions

- [x] **Next.js 14 Control Plane (`zervox-ui`)**:
  - [x] **Feature 1: Forensic Freeze Frame** (Cause → Freeze → Cure in <10s with Merkle hashing)
  - [x] **Feature 2: Glass Box Root Cause Trail** (Interactive reasoning graph + Fallback reroute)
  - [x] **Feature 3: Policy Firewall Replay** (Staged attack diff theater + Rego rule inspector)
  - [x] **Feature 4: Split-Brain Sentinel** (Interactive HA topology + Sever Heartbeat simulation)
  - [x] **Feature 5: Air-Gap Attestation Beacon** (Persistent header ticker + Egress breach banner)
  - [x] Light & Dark mode toggle with CSS custom property tokens and anti-FOUC script
  - [x] Internal Next.js server proxies (`/api/telemetry` & `/api/action`) eliminating browser CORS/network errors
  - [x] Fast standalone container build (builds in ~5s)

---

## 📋 Pending Tasks & Action Items

### 1. Live Kubernetes Cluster Integration (Track B)
- [x] **Connect to local k3s / minikube**:
  - Currently runs in `dry-run/simulated` mode if no kubeconfig is mounted.
  - Test setting `KUBECONFIG=~/.kube/config` and verifying real pod restart via `kube-rs` on a live cluster.
  - Deploy a simple `victim-api` deployment in namespace `default` with resource memory limit `64Mi` so it actually OOMKills during demo.

### 2. Forensic Freeze Ephemeral Container Script (`zervox-core`)
- [x] **Enhance `status::get_incident_forensics`**:
  - Wire a real `kubectl debug` ephemeral container or crictl `/proc` snapshot dump script if running directly on a Linux host with containerd socket mounted (`/run/containerd/containerd.sock`).
  - Add real Merkle root calculation over `/proc/$PID/cmdline`, `/proc/$PID/net/tcp`, and `/proc/$PID/environ`.

### 3. Physical Hardware Circuit-Breaker (Optional Live Physical Demo)
- [x] **ESP32-C3 / RISC-V Microcontroller**:
  - The software emulation (`ARMED_RISCV_ESP32C3`) is 100% functional.
  - If bringing a physical ESP32-C3 board to the hackathon booth:
    - Flash the challenge-response firmware in `hardware/firmware/`.
    - Plug via USB and pass `/dev/ttyUSB0` into `docker-compose.yml` or run `zervox-core` on bare metal.
    - Wire a physical physical toggle switch to GPIO 4 for the ultimate judge live demo!

### 4. 3-Minute Demo Runbook Script (`scripts/demo-judges.sh`)
- [x] Create an automated bash script that executes the exact 5-step judge presentation:
  1. `STEP 1`: Inject RBAC attack (`delete_namespace`) → Show Policy Firewall Replay modal blocking the action.
  2. `STEP 2`: Inject `PodCrashLooping` alert → Show Forensic Freeze Frame capturing volatile memory before restarting pod.
  3. `STEP 3`: Show Glass Box reasoning trail in UI and flip to Deterministic Fallback.
  4. `STEP 4`: Kill Primary container (`docker compose stop zervox-primary`) → Watch Backup promote to Active Leader on stage.
  5. `STEP 5`: Point out Air-Gap Attestation Beacon proving zero data exfiltration.

### 5. Pitch Deck & Presentation Materials
- [x] Prepare 5-slide deck:
  - Slide 1: Problem (Standard auto-healing obliterates forensic evidence & lacks safety bounds).
  - Slide 2: Solution (Zervox: Out-of-band SRE control plane with 5 zero-trust innovations).
  - Slide 3: Architecture Diagram (Primary/Backup mTLS, OPA Gate, SQLite WAL, Hardware Breaker).
  - Slide 4: Live Demo (Cause → Freeze → Cure in <10s).
  - Slide 5: Real-World Impact (Kerala Police Cyberdome, SCADA, defense, air-gapped critical infrastructure).
- [x] Print QR code flyer linking to GitHub repo `https://github.com/ziuus/Zervox`.

---

## 🛠 Useful Development Commands

```bash
# Run tests
cargo test --manifest-path zervox-core/Cargo.toml

# Trigger chaos pod crash via curl
curl -X POST http://localhost:8080/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '{"alerts":[{"labels":{"alertname":"PodCrashLooping","severity":"critical","pod":"victim-api-live","namespace":"default"}}]}'

# Trigger simulated attack (OPA deny)
curl -X POST http://localhost:8080/api/simulate_attack \
  -H "Content-Type: application/json" \
  -d '{"attack_type":"delete_namespace","namespace":"default","target_name":"victim-api"}'

# Inspect live telemetry
curl -s http://localhost:3000/api/telemetry | jq .
```
