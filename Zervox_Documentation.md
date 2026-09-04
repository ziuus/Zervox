# Zervox
### Autonomous Air-Gapped Cyber Resilience Engine
**Industry 4.0 — Automation For Good | Track: IT Security & Cyber Resilience**

---

## 1. The One-Line Pitch

> **Zervox is the last responder that doesn't need the internet, the AI, or you to be awake.**

When a crisis knocks out the systems that are supposed to protect your infrastructure, Zervox keeps working anyway. It runs outside the main system, works on its own, and can still detect problems, contain them, and fix them — even when the network is down, the AI is unreachable, and no engineer is around to help.

---

## 2. The Problem

Today's IT systems rely on a lot of automation — monitoring tools, AI-powered assistants, dashboards, auto-recovery scripts. Most of these tools have one big weakness: **they depend on the exact system they're supposed to protect.**

This causes two common failures:

- **The Host Paradox** — Your protection tool lives *inside* the same cluster it's protecting. So if a hacker wipes out access permissions (RBAC) or locks out admins, the protection tool goes down along with everything else.
- **The External Dependency Trap** — Many tools need an internet connection to call an AI (like an LLM API) to "think" and decide what to do. If the internet goes down — say, during a grid failure or telecom outage — that AI brain disappears right when it's needed most.

Most tools are built assuming a normal day. Zervox is built assuming the worst day.

---

## 3. The Core Idea

The hackathon question is:

> *"When a crisis strikes, who or what will you save — or, at the end, save you?"*

Our answer: **we protect the infrastructure that everything else depends on.**

Hospitals, emergency services, telecom networks, and power grids all run on top of computing infrastructure. If that infrastructure quietly breaks during a crisis, everything built on top of it breaks too. Zervox sits underneath all of that — as the thing that keeps working even when everything above it stops.

But this raises a fair follow-up question: **if Zervox is the thing saving everyone else, what saves Zervox?** Section 8 answers exactly that.

---

## 4. What Zervox Actually Does

In simple terms, Zervox is a tool (written in Rust, a fast and lightweight programming language) that watches over your Kubernetes system and fixes problems automatically. Here's the flow:

1. It reads alerts from monitoring tools (Prometheus/Grafana) and logs from the cluster in real time.
2. It tries to understand what's going wrong by asking an AI (LLM) to analyze the situation — *when the AI is reachable.*
3. If the AI can't be reached, it switches to a **simple built-in rule system** that doesn't need any internet or AI to work.
4. Before it takes any action — AI-suggested or rule-based — it checks the action against a strict safety rulebook (OPA, explained below) that blocks anything dangerous.
5. If the action is safe, it either does it automatically, or asks a human to approve it first, depending on settings.

It's meant to run **separately** from the main cluster — on its own small server or backup machine — so that if the main cluster is fully compromised, Zervox is untouched and can still act.

---

## 5. What Makes This Innovative

| Idea | Why It's Useful |
|---|---|
| **Switches from "smart AI" to "simple rules" automatically** | Most tools just stop working or hang when the AI API times out. Zervox notices this and switches to a small set of safe, pre-decided actions instead — so it never just goes silent. |
| **Safety rules sit below the AI, not next to it** | The OPA safety system isn't a suggestion — it's a hard wall. Even if the AI gives a bad or dangerous suggestion (due to a bug, hallucination, or an attacker tricking it), the safety wall blocks it before it reaches the real system. |
| **Runs outside the system it protects** | Zervox doesn't live inside the cluster it's watching. So even a full hack of the main system doesn't affect Zervox. |
| **Keeps working even under heavy load** | It uses SQLite (a lightweight local database) in a special mode called WAL, which lets it keep saving data reliably even when the system is under stress, without needing an external database that could also fail. |
| **Can require human approval, with one setting** | A simple on/off setting decides whether Zervox acts fully on its own, or waits for a human to say "yes" first. Same tool, two modes. |
| **Protects itself, not just other systems** | A backup system (explained in Section 8) means Zervox doesn't just fix other tools' outages — it can survive its own crash too. |

---

## 6. How It Works — Step by Step

```
Alert comes in from Prometheus/Grafana  ──►  Zervox receives it (securely, with login check)
                                        │
                                        ▼
                    Zervox looks at logs, metrics, and system history together
                                        │
                        ┌───────────────┴───────────────┐
                        ▼                                 ▼
                Can it reach the AI?                AI is unreachable
              (tries to understand              (after retrying and waiting,
               the root cause)                    it gives up and switches modes)
                        │                                 │
                        ▼                                 ▼
              AI suggests a fix                 Local Fallback Mode:
                                              picks a fix from a small list of
                                             pre-approved, low-risk actions only
                        └───────────────┬─────────────────┘
                                        ▼
                    Safety Check (OPA) — is this action allowed?
                                        │
                        ┌───────────────┴───────────────┐
                        ▼                                 ▼
                🛑 BLOCKED                        ✅ ALLOWED
        (deleting a namespace,                (restart a pod, scale up/down
         editing permissions,                   within the existing limit,
         opening a shell, etc.)                  reroute traffic, isolate a node)
                                        │
                                        ▼
                        Action is carried out (or sent for approval)
                                        │
                                        ▼
                    The whole incident is saved to local storage (SQLite)
```

---

## 7. Real Crisis Examples

**Example A — An Attacker Gets In**
Someone steals login credentials and starts deleting parts of the system and messing with permissions to lock everyone else out. Zervox notices this almost instantly by watching the logs, its safety wall blocks the dangerous actions, and it automatically revokes the attacker's access and isolates the affected part of the system — often before a human even gets an alert on their phone.

**Example B — The Internet Goes Down**
A power grid failure or telecom outage cuts off internet access. The system is throwing errors, but Zervox can't reach the AI to ask for help. It already has logic that keeps retrying the connection for a bit — instead of retrying forever and doing nothing, it switches into **Local Fallback Mode** (see Section 8), matches the error to something it already knows how to fix, and takes action — like restarting a pod or adjusting scale — without needing the internet at all.

**Example C — Zervox Itself Goes Down**
The machine running Zervox crashes, loses power, or gets attacked directly. A second, backup copy of Zervox notices it's gone silent and takes over the job — so the response to the crisis doesn't stop just because the responder itself got knocked out.

---

## 8. How Zervox Survives the Crisis Itself

This is the part that directly answers the hackathon's question: **what saves Zervox, when Zervox is the thing saving everyone else?**

### 8.1 Local Fallback Mode (works without AI or internet)

Zervox already tries the AI multiple times with waiting periods in between (this is called "retry with backoff") before giving up on a request. Instead of just giving up and doing nothing, this waiting-and-retrying is now the trigger for a backup plan:

- Once Zervox confirms the AI really can't be reached, it switches into **"local-only mode."**
- In this mode, it can only pick from a small, carefully chosen list of **safe, low-risk fixes** — like restarting a service, or scaling up/down within the limit it's already allowed (the same 10-replica cap mentioned later).
- These specific actions were chosen because they're easy to undo and unlikely to cause new damage — this mode is not for taking bigger risks, it's a smaller, safer toolkit for when the smarter option isn't available.
- The safety wall (OPA) still checks every action here too — this mode skips the AI, not the safety rules.

**Why this matters:** the moment the internet goes down is exactly when most tools go silent — and exactly when Zervox is needed the most. This turns "can't reach the AI" from a dead end into a simple mode switch.

### 8.2 Zervox Protects Itself Too

If there's only one copy of Zervox running, then Zervox itself becomes a single point of failure — the exact problem it's supposed to solve for everyone else. To fix that:

- Zervox runs with at least two copies (instances) — a primary and a backup.
- The primary regularly sends a signal ("I'm alive") — this is called a heartbeat.
- If the backup stops hearing that signal — because of a crash, power loss, or an attack — it takes over automatically and becomes the new primary, without waiting for a human to notice and restart anything.
- Since both copies share the same local storage system (SQLite, described below), the backup doesn't start from scratch — it picks up right where the primary left off.

**Why this matters:** this is what turns Zervox from "a tool that fixes other systems' problems" into "a tool that also survives its own problems" — which is the most direct answer to the hackathon's core question.

---

## 9. Safety Rules (Security Guardrails)

Zervox doesn't fully trust its own AI brain — every action it wants to take, whether suggested by the AI or picked from the local fallback list, has to pass through a strict rulebook (OPA/Rego) first.

**Things Zervox is never allowed to do, no matter what:**
- 🚫 Delete a namespace (a section of the system), under any condition
- 🚫 Open a shell / terminal inside a container
- 🚫 Change access permissions (RBAC, roles, service accounts)
- 🚫 Directly read secret/private data
- 📏 Scale anything beyond 10 replicas at once (this same limit applies to the local fallback mode too)

Every request coming into Zervox also needs a valid login token — requests without one are automatically rejected.

---

## 10. Technical Stack (What It's Built With)

| Part | Technology | Why It Was Chosen |
|---|---|---|
| Core engine | Rust (works on different processor types) | Uses very little memory and CPU — can run on small backup hardware |
| Storage | SQLite (a lightweight local database, in "WAL" mode) | Doesn't need an external database that could fail too; keeps working reliably under stress; lets the backup instance pick up where the primary left off |
| Safety rules | OPA + Rego (a policy language) | Clear, checkable rules that can't be skipped or talked around |
| Reasoning | AI (LLM) API, with Local Fallback Mode as backup | Smart analysis when possible, a simpler safe backup plan when not |
| Reliability | Watchdog / leader-election between two copies | Makes sure Zervox itself doesn't have a single point of failure |
| Cluster access | kube-rs (a Kubernetes toolkit for Rust) | Talks to Kubernetes safely, with automatic retries built in |
| Deployment | Docker + ready-to-run files | Easy to install with one command, on a server or in a container |

---

## 11. Why This Fits "Automation for Good"

Most automation is built to make a normal day faster and easier. Zervox is built for the day when nothing else is working. It doesn't assume the cloud will be up, the network will be up, or a human will be awake to help — and it doesn't even fully trust itself, which is why it's built to hand off to a backup copy of itself, and fall back to a simpler, more reliable version of itself, whenever the smarter option disappears.

---

## 12. What's Not Built Yet (Being Honest About the Roadmap)

- **Full mesh survival** — right now the plan is a simple two-copy backup system. Later, this could grow into many small Zervox copies spread across a network, so the "in-charge" role can move between many machines, not just one backup pair.
- **Physical server restarts** — using tools like IPMI/Redfish to physically restart a frozen server, for cases where even the software layer stops responding completely.

---

## 13. Closing Line

> Most tools protect your infrastructure when things are working fine.
> **Zervox protects your infrastructure when nothing else is — including itself.**
