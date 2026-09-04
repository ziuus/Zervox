'use client'

import Link from 'next/link'
import { useTelemetry } from '@/context/TelemetryContext'
import { Card, CardLabel } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export default function ChaosSandboxPage() {
  const {
    chaosLoading,
    chaosFeedback,
    setChaosFeedback,
    triggerChaosScenario,
    opaStatus,
    k8sStatus,
    totalIncidents,
  } = useTelemetry()

  const scenarios = [
    {
      id: 'pod_crash' as const,
      number: '01',
      title: 'Workload Pod Crash & Forensic Freeze',
      badge: 'FORENSIC FREEZE',
      badgeColor: 'purple' as const,
      desc: 'Simulates a container memory leak & OOM crash (exit code 137). Zervox captures a pre-remediation snapshot of /proc and open socket descriptors, binds the SHA-256 Merkle root, and restarts the workload safely.',
      judgeVerification: 'Check /forensics or /incidents to verify the dynamic Merkle hash is cryptographically sealed before pod restart.',
    },
    {
      id: 'rbac_attack' as const,
      number: '02',
      title: 'Malicious RBAC Attack & Policy Block',
      badge: 'OPA / REGO FIREWALL',
      badgeColor: 'rose' as const,
      desc: 'Simulates an adversary attempting an unauthorized namespace wipe (kubectl delete namespace default). The unbypassable OPA Rego gate intercepts the action, zero-trust rules trigger, and execution status is locked to BLOCKED_BY_POLICY.',
      judgeVerification: 'OPA Diff Theater launches instantly; verify zero cluster blast radius and BLOCKED status in the timeline.',
    },
    {
      id: 'node_cordon' as const,
      number: '03',
      title: 'Node Pressure & RISC-V Dual-Key Challenge',
      badge: 'HARDWARE CIRCUIT BREAKER',
      badgeColor: 'indigo' as const,
      desc: 'Simulates high blast-radius cluster actions (cordoning a master node). Autonomous execution is gated behind a hardware-enforced cryptographic challenge via physical RISC-V ESP32-C3 microcontroller dual-key GPIO interlock.',
      judgeVerification: 'Verify hardware status reflects ARMED and blast radius guardrails prevent unauthorized cluster-wide eviction.',
    },
    {
      id: 'immune_quarantine' as const,
      number: '04',
      title: 'Repeated Attack Loop & Adaptive Immune Lock',
      badge: 'ADAPTIVE IMMUNITY',
      badgeColor: 'amber' as const,
      desc: 'Simulates rapid brute-force attack vectors targeting the cluster. After repeated OPA violations, Zervox\'s adaptive immune engine enforces a 30-minute quarantine lockdown, blacklisting malicious ingress vectors.',
      judgeVerification: 'Verify the adaptive quarantine locks out the rogue identity across consecutive attack attempts.',
    },
  ]

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Judges Chaos Simulation Console
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Trigger real-world crisis injections to observe autonomous out-of-band resilience, policy blocking, and failover in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={opaStatus === 'reachable' ? 'green' : 'amber'} dot>
            OPA {opaStatus ? opaStatus.toUpperCase() : 'STANDBY'}
          </Badge>
          <Badge variant={k8sStatus === 'connected' ? 'green' : 'amber'} dot>
            K8S {k8sStatus ? k8sStatus.toUpperCase() : 'STANDBY'}
          </Badge>
          <Badge variant="sky">
            {totalIncidents} INCIDENTS LOGGED
          </Badge>
        </div>
      </div>

      {/* ── Live Feedback Notification Banner ──────────────────── */}
      {chaosFeedback && (
        <div
          className={`flex items-start gap-4 rounded-xl p-4 border transition-all ${
            chaosFeedback.type === 'blocked'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
              : chaosFeedback.type === 'info'
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-900 dark:text-indigo-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <span className="text-xl">
            {chaosFeedback.type === 'blocked' ? '🛡️' : chaosFeedback.type === 'info' ? '🔐' : '⚡'}
          </span>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-xs tracking-wide">
                {chaosFeedback.title}
              </p>
              <button
                type="button"
                onClick={() => setChaosFeedback(null)}
                className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs opacity-90 leading-relaxed">
              {chaosFeedback.desc}
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs font-semibold">
              <Link href="/incidents" className="underline hover:opacity-80">
                View Recorded Incident in SQLite WAL →
              </Link>
              <Link href="/forensics" className="underline hover:opacity-80">
                Inspect Forensic Snapshot →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 1: 4 CHAOS INJECTION CARDS ─────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Fault Injection Bench
          </h2>
          <span className="text-[11px] text-slate-600 dark:text-slate-400">
            One-click crisis simulations
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scenarios.map((s) => (
            <Card
              key={s.id}
              className="p-6 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Scenario {s.number}
                  </span>
                  <Badge variant={s.badgeColor} dot>
                    {s.badge}
                  </Badge>
                </div>

                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {s.title}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed">
                  {s.desc}
                </p>

                <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                    What Judges Should Observe:
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                    {s.judgeVerification}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  POST /api/action
                </span>
                <button
                  type="button"
                  disabled={chaosLoading !== null}
                  onClick={() => triggerChaosScenario(s.id)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50 cursor-pointer bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 shadow-sm"
                >
                  {chaosLoading === s.id ? 'Injecting Fault…' : `Trigger Scenario ${s.number}`}
                </button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── SECTION 2: FAILOVER SIMULATION CALLOUT ─────────────── */}
      <section className="rounded-2xl p-6 surface-elevated border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🔀</span>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Primary Host Failure & Failover Simulation
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Test what happens when the active Zervox orchestrator itself crashes. Sever the heartbeat loop on the interactive network topology map to watch the dormant backup promote to leader with zero data loss.
            </p>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800/60 hover:bg-teal-100/60 dark:hover:bg-teal-900/40 transition-all cursor-pointer self-start md:self-auto shadow-sm"
          >
            <span>🌐</span>
            <span>Open Sentinel Map →</span>
          </Link>
        </div>
      </section>
    </div>
  )
}
