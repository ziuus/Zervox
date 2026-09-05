# Zervox ⚡ — System Status & Production Deployment Checklist

> **Kerala Police Cyberdome — HAC'KP 2026 Hackathon**  
> **Target Award:** Best Innovation Award & Cybersecurity SRE Resilience

---

## ⚡ Quick Sync Instructions for Teammates

If your local branch is behind or diverged, run the following commands to pull the exact latest state from `main`:

```bash
# 1. Fetch & hard reset to latest main
git fetch origin main
git reset --hard origin/main
git clean -fd

# 2. Build Next.js standalone UI bundle
cd zervox-ui && npm install && npm run build && cd ..

# 3. Spin up full Docker stack
docker compose down -v
docker compose up --build -d

# 4. Verify system health
curl -s http://localhost:8080/healthz
curl -s http://localhost:3000/api/telemetry
```

---

## ✅ Live & Working Core Systems (100% Operational)

- [x] **Rust Core Engine (`zervox-core`)**:
  - [x] Full HTTP/REST API (`/healthz`, `/api/status`, `/api/v1/alerts`, `/api/simulate_attack`, `/api/incidents/:id/forensics`, `/api/immune/status`)
  - [x] 41/41 Unit, Fuzz, and Integration tests passing (`cargo test --manifest-path zervox-core/Cargo.toml`)
  - [x] mTLS Watchdog & Heartbeat protocol (`TCP 9000`) with automatic primary/backup failover
  - [x] Open Policy Agent (OPA) integration evaluating Rego rules (`/policies/authz.rego`)
  - [x] Append-only SQLite WAL incident database with Merkle evidence hashes
  - [x] Adaptive Immune System (30-minute default-deny quarantine on repeated attacks)
  - [x] Cyber Threat Correlation Engine with sliding window incident scoring
  - [x] Closed-loop post-action verification and automated escalation matrix

- [x] **Next.js 14 Control Plane (`zervox-ui`)**:
  - [x] Multi-page App Router architecture (`/`, `/incidents`, `/forensics`, `/chaos`)
  - [x] **Feature 1: Forensic Freeze Frame** (Merkle evidence hashing & OPA seal guarantee)
  - [x] **Feature 2: Glass Box Root Cause Trail** (AI reasoning graph + 1.2ms deterministic fallback)
  - [x] **Feature 3: Policy Firewall Replay** (Staged attack diff theater & Rego `REG-001` inspector)
  - [x] **Feature 4: Split-Brain Sentinel** (Interactive mTLS topology & live heartbeat sever trigger)
  - [x] **Feature 5: Air-Gap Attestation Beacon** (Live Ed25519 signature ticker & egress breach detection)
  - [x] Dark/Light mode toggle with CSS variable design system
  - [x] Server-side Next.js telemetry & action proxies (`/api/telemetry`, `/api/action`) eliminating browser CORS errors

---

## 🛠 Production Mode vs. Local Simulation Matrix

| Feature | Local Demo Mode (Default) | Production Deployment Mode | How to Enable Production Mode |
|:---|:---:|:---:|:---|
| **K8s Executor** | Simulated / Dry-Run | Live `kube-rs` API Execution | Mount `KUBECONFIG` into container & set `DRY_RUN=false` in `docker-compose.yml` |
| **LLM Root Cause** | 10s Timeout → Deterministic Fallback (1.2ms) | Live Cloud / Local LLM | Set `OPENAI_API_KEY=sk-...` or local `LLM_URL` in `.env` |
| **Hardware Breaker** | Emulated RISC-V ESP32-C3 | Physical USB ESP32-C3 Board | Connect ESP32 via USB and add `devices: - "/dev/ttyUSB0:/dev/ttyUSB0"` to `docker-compose.yml` |
| **Forensic Memory Dump** | Tamper-Evident Spec/Log Hash | Live `crictl` Containerd Dump | Mount `/run/containerd/containerd.sock` into `zervox-core` container |

---

## 📋 Hackathon Presentation Checklist

- [ ] **Run Live Demo Script (`scripts/demo-runbook.sh`)**:
  - `Step 1`: Trigger `delete_namespace` attack → Show Policy Firewall Replay modal.
  - `Step 2`: Trigger `PodCrashLooping` alert → Show Forensic Freeze Frame capturing volatile state before pod restart.
  - `Step 3`: Open Glass Box visualizer → Toggle AI reasoning chain & Deterministic Fallback.
  - `Step 4`: Stop primary container (`docker compose stop zervox-primary`) → Watch backup promote to Active Leader on stage.
  - `Step 5`: Show Air-Gap Attestation Beacon header ticker & Optical QR Matrix.

- [ ] **5-Slide Judge Pitch Deck**:
  - Slide 1: The Problem (Auto-healing destroys forensic evidence & lacks safety bounds).
  - Slide 2: The Solution (Zervox: Out-of-band SRE control plane with 5 zero-trust innovations).
  - Slide 3: System Architecture (mTLS Heartbeat, OPA Rego Gate, SQLite WAL, RISC-V Breaker).
  - Slide 4: Live Demo (Cause → Freeze → Cure in <10s).
  - Slide 5: Real-World Impact (Kerala Police Cyberdome, SCADA, defense, air-gapped critical infrastructure).
