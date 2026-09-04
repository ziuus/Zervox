# ⚡ Zervox: Kerala Police Cyberdome HAC'KP 2026 Pitch Deck
> **Award Category:** Best Innovation Award & Cybersecurity SRE Resilience

---

## 📽 Slide 1: The Critical Problem
### "Standard Auto-Healing Obliterates Forensic Evidence & Lacks Safety Bounds"
* **The Incident Response Dilemma**: When a Kubernetes pod or critical server crashes due to an exploit, standard orchestrators restart or delete the container instantly to restore uptime.
* **The Fatal Flaw**: All volatile memory, in-memory malware footprints, open raw sockets, and active network connections are permanently erased.
* **Unbounded AI Agents**: Emerging autonomous AI SRE agents often take destructive cluster-wide actions (e.g. cascading restarts, namespace deletion) without deterministic guardrails.

---

## 🛡 Slide 2: The Solution — Zervox
### "Autonomous Air-Gapped Cyber Resilience & SRE Control Plane"
* **Cause → Freeze → Cure in < 10 Seconds**: Captures volatile memory and open sockets into a tamper-evident Merkle hash ledger *before* taking any remediation action.
* **Dual-Tier Reasoning Engine**: High-intelligence LLM diagnostic engine bound by a strict 10-second timeout with an automatic, sub-1.2ms deterministic rule fallback.
* **Air-Gapped by Design**: Capable of 100% offline, isolated execution with cryptographic attestation proving zero internet egress.

---

## 🏛 Slide 3: Architecture Diagram
```
             ┌─────────────────────────────────────────────────────────┐
             │               Zervox Next.js 14 Dashboard               │
             │           (Telemetry · Visualizer · Topology)           │
             └───────────────────────────┬─────────────────────────────┘
                                         │
                   ┌─────────────────────┴──────────────────────┐
                   │                                            │
        ┌──────────▼────────────┐                    ┌──────────▼────────────┐
        │  ZERVOS CORE PRIMARY  │◄──mTLS Watchdog───►│  ZERVOX CORE BACKUP   │
        │   (Port 8080 / 9000)  │   (TCP Ping 2s)    │   (Port 8081 / 9001)  │
        └──────────┬────────────┘                    └───────────────────────┘
                   │
    ┌──────────────┼───────────────────────────┐
    │              │                           │
┌───▼────┐   ┌─────▼──────────────┐   ┌────────▼──────────────┐
│  OPA   │   │ Append-Only SQLite │   │   Physical Hardware   │
│ Engine │   │   WAL Incident     │   │ Circuit-Breaker Guard │
│ (Rego) │   │     Store          │   │  (ESP32-C3 / RISC-V)  │
└────────┘   └────────────────────┘   └───────────────────────┘
```

---

## ⚡ Slide 4: Live 5-Step Demo
1. **RBAC Attack Block**: Malicious attack injected → OPA Gate blocks namespace deletion with zero cluster blast radius.
2. **Forensic Freeze**: Pod crash alert → Ephemeral dump captures volatile memory and calculates SHA-256 Merkle root.
3. **Glass Box Trail**: Visual decision tree exposes diagnostic reasoning and falls back cleanly without stalling.
4. **HA Failover**: Primary process assassinated → Backup detects loss of heartbeats and promotes to active leader.
5. **Air-Gap Beacon**: Attestation engine signs system isolation state every 3 seconds.

---

## 🌍 Slide 5: Real-World Impact & Applications
* **Kerala Police Cyberdome / Forensics**: Preserves unassailable chain of custody for court admissibility.
* **Critical Defense & SCADA**: Guaranteed zero-outbound telemetry in high-security facilities.
* **Financial & Enterprise Core**: Self-healing infrastructure that guarantees safety compliance and zero downtime.

---

## 🔗 Project Links
- **GitHub Repository**: [https://github.com/ziuus/Zervox](https://github.com/ziuus/Zervox)
- **Air-Gap Verification Tool**: `scripts/capture-forensics.sh`
- **Interactive 3-Min Pitch Runner**: `scripts/demo-judges.sh`
