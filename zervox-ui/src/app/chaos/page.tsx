'use client'

import Link from 'next/link'
import { useTelemetry } from '@/context/TelemetryContext'
import { Card, CardLabel } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

function SectionLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="hr-gradient flex-1" />
      <div className="text-right shrink-0">
        <p className="font-mono text-xs font-extrabold uppercase tracking-[0.25em]" style={{ color: 'var(--text-primary)' }}>
          {title}
        </p>
        <p className="font-mono text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
      </div>
    </div>
  )
}

export default function ChaosSandboxPage() {
  const {
    chaosLoading,
    chaosFeedback,
    setChaosFeedback,
    triggerChaosScenario,
    activeInstance,
    engineMode,
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
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.10)',
      border: 'rgba(167,139,250,0.35)',
      loadingText: 'FREEZING POD STATE…',
      desc: 'Simulates a container memory leak & OOM crash (exit code 137). Zervox captures a pre-remediation snapshot of /proc and open socket descriptors, binds the SHA-256 Merkle root, and restarts the workload safely.',
      judgeVerification: 'Check /forensics or /incidents to verify the dynamic Merkle hash is cryptographically sealed before pod restart.',
    },
    {
      id: 'rbac_attack' as const,
      number: '02',
      title: 'Malicious RBAC Attack & Policy Block',
      badge: 'OPA / REGO FIREWALL',
      badgeColor: 'red' as const,
      color: '#fb7185',
      bg: 'rgba(251,113,133,0.10)',
      border: 'rgba(251,113,133,0.35)',
      loadingText: 'INTERCEPTING THREAT…',
      desc: 'Simulates an adversary attempting an unauthorized namespace wipe (kubectl delete namespace default). The unbypassable OPA Rego gate intercepts the action, zero-trust rules trigger, and execution status is locked to BLOCKED_BY_POLICY.',
      judgeVerification: 'OPA Diff Theater launches instantly; verify zero cluster blast radius and BLOCKED status in the timeline.',
    },
    {
      id: 'node_cordon' as const,
      number: '03',
      title: 'Node Pressure & RISC-V Dual-Key Challenge',
      badge: 'HARDWARE CIRCUIT BREAKER',
      badgeColor: 'indigo' as const,
      color: '#818cf8',
      bg: 'rgba(129,140,248,0.10)',
      border: 'rgba(129,140,248,0.35)',
      loadingText: 'AUTHORIZING DUAL-KEY…',
      desc: 'Simulates high blast-radius cluster actions (cordoning a master node). Autonomous execution is gated behind a hardware-enforced cryptographic challenge via physical RISC-V ESP32-C3 microcontroller dual-key GPIO interlock.',
      judgeVerification: 'Verify hardware status reflects ARMED and blast radius guardrails prevent unauthorized cluster-wide eviction.',
    },
    {
      id: 'immune_quarantine' as const,
      number: '04',
      title: 'Repeated Attack Loop & Adaptive Immune Lock',
      badge: 'ADAPTIVE IMMUNITY',
      badgeColor: 'amber' as const,
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.10)',
      border: 'rgba(251,191,36,0.35)',
      loadingText: 'ENFORCING QUARANTINE…',
      desc: 'Simulates rapid brute-force attack vectors targeting the cluster. After repeated OPA violations, Zervox\'s adaptive immune engine enforces a 30-minute quarantine lockdown, blacklisting malicious ingress vectors.',
      judgeVerification: 'Verify the adaptive quarantine locks out the rogue identity across consecutive attack attempts.',
    },
  ]

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl text-base" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)' }}>
              ⚡
            </span>
            <h1 className="font-mono text-lg font-black uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              Judges Chaos Simulation Console
            </h1>
          </div>
          <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Trigger real-world crisis injections to observe autonomous out-of-band resilience, policy blocking, and failover in real time.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
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
          className="flex items-start gap-3.5 rounded-2xl p-4 font-mono animate-slide-down"
          style={{
            border:
              chaosFeedback.type === 'blocked'
                ? '1px solid rgba(251,113,133,0.5)'
                : chaosFeedback.type === 'info'
                ? '1px solid rgba(129,140,248,0.5)'
                : '1px solid rgba(52,211,153,0.5)',
            background:
              chaosFeedback.type === 'blocked'
                ? 'rgba(251,113,133,0.12)'
                : chaosFeedback.type === 'info'
                ? 'rgba(129,140,248,0.12)'
                : 'rgba(52,211,153,0.12)',
          }}
        >
          <span className="text-xl">
            {chaosFeedback.type === 'blocked' ? '🛡️' : chaosFeedback.type === 'info' ? '🔐' : '⚡'}
          </span>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="font-bold tracking-wider text-xs uppercase" style={{ color: 'var(--text-primary)' }}>
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
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {chaosFeedback.desc}
            </p>
            <div className="mt-3 flex items-center gap-3 text-[11px] font-bold">
              <Link href="/incidents" className="underline hover:opacity-80" style={{ color: 'var(--accent)' }}>
                View Recorded Incident in SQLite WAL →
              </Link>
              <Link href="/forensics" className="underline hover:opacity-80" style={{ color: 'var(--accent)' }}>
                Inspect Forensic Snapshot →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 1: 4 CHAOS INJECTION CARDS ─────────────────── */}
      <section>
        <SectionLabel
          title="SIMULATION BENCH"
          subtitle="One-Click Crisis Injections · Out-of-Band Resilience Validation"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scenarios.map((s) => (
            <Card
              key={s.id}
              className="p-6 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 shadow-md"
              style={{
                borderColor: s.border,
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    SCENARIO {s.number}
                  </span>
                  <Badge variant={s.badgeColor} dot>
                    {s.badge}
                  </Badge>
                </div>

                <h3 className="font-mono text-base font-bold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                  {s.title}
                </h3>

                <p className="font-mono text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {s.desc}
                </p>

                <div className="mt-4 p-3 rounded-xl" style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)' }}>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    👀 What Judges Should Observe:
                  </p>
                  <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-primary)' }}>
                    {s.judgeVerification}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="font-mono text-[10px] tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  ENDPOINT: /api/action
                </span>
                <button
                  type="button"
                  disabled={chaosLoading !== null}
                  onClick={() => triggerChaosScenario(s.id)}
                  className="rounded-xl px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 cursor-pointer hover:scale-105 shadow-sm"
                  style={{
                    color: s.color,
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                  }}
                >
                  {chaosLoading === s.id ? s.loadingText : `TRIGGER ${s.id.toUpperCase()}`}
                </button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── SECTION 2: FAILOVER SIMULATION CALLOUT ─────────────── */}
      <section className="rounded-2xl p-6 surface" style={{ border: '1px solid var(--border-medium)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔀</span>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                Primary Host Death & Failover Simulation
              </h3>
            </div>
            <p className="font-mono text-xs mt-1 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
              Looking to test what happens when the primary Zervox responder itself crashes? Test Track A severing directly on the interactive Split-Brain Sentinel map.
            </p>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer self-start md:self-auto"
            style={{
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              color: 'var(--text-primary)',
            }}
          >
            <span>🌐</span>
            <span>Open Split-Brain Sentinel →</span>
          </Link>
        </div>
      </section>
    </div>
  )
}
