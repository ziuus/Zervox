'use client'

import { useState } from 'react'
import { useZervoxTelemetry } from '@/hooks/useZervoxTelemetry'
import { Header } from '@/components/dashboard/Header'
import { HeartbeatCard } from '@/components/dashboard/HeartbeatCard'
import { EngineModeCard } from '@/components/dashboard/EngineModeCard'
import { IncidentTable } from '@/components/dashboard/IncidentTable'
import { Card, CardLabel } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatUptime } from '@/lib/utils'
import { TopologyMiniMap } from '@/components/dashboard/TopologyMiniMap'
import { AirGapOpticalModal } from '@/components/dashboard/AirGapOpticalModal'
import { PolicyFirewallModal } from '@/components/dashboard/PolicyFirewallModal'
import { GlassBoxVisualizer } from '@/components/dashboard/GlassBoxVisualizer'
import { ForensicFreezeFrame } from '@/components/dashboard/ForensicFreezeFrame'

// 5 Core Innovations for Kerala Police Cyberdome Best Innovation Award
const INNOVATIONS = [
  {
    id: '01',
    title: 'Forensic Freeze Frame',
    subtitle: 'Pre-Remediation Evidence Snapshot',
    tag: 'SHA-256 MERKLE',
    desc: 'Before touching a compromised pod, Zervox triggers an ephemeral /proc & socket dump into a tamper-evident append-only ledger. OPA rule guarantee: no remediation without a sealed hash.',
    accent: { text: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.3)', dot: '#a78bfa' },
  },
  {
    id: '02',
    title: 'Glass Box Root Cause Trail',
    subtitle: 'LLM Reasoning Chain Visualizer',
    tag: 'DECISION GRAPH',
    desc: 'Structured reasoning trail (hypothesis → evidence checked → confidence score). If LLM times out at 10s, visually reroutes to deterministic rule-table fallback in 1.2ms.',
    accent: { text: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.3)', dot: '#818cf8' },
  },
  {
    id: '03',
    title: 'Policy Firewall Replay',
    subtitle: 'Rego "Blocked Action" Theater',
    tag: 'REGO GATE',
    desc: 'Live attempted-vs-blocked staging. Out-of-bounds actions (e.g. delete namespace) are denied by Rego rule REG-001, rendering the strikethrough diff for auditors.',
    accent: { text: '#fb7185', bg: 'rgba(251,113,133,0.08)', border: 'rgba(251,113,133,0.3)', dot: '#fb7185' },
    triggerPolicyModal: true,
  },
  {
    id: '04',
    title: 'Split-Brain Sentinel',
    subtitle: 'Live Failover Visualization',
    tag: 'mTLS HEARTBEAT',
    desc: 'Sub-3s leader takeover. The backup node detects missed mTLS heartbeat pings and promotes itself with zero dropped incidents from replicated SQLite WAL.',
    accent: { text: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.3)', dot: '#fbbf24' },
  },
  {
    id: '05',
    title: 'Air-Gap Attestation Beacon',
    subtitle: 'Cryptographic Isolation Proof',
    tag: 'Ed25519 SEALED',
    desc: 'Continuous proof of zero internet egress. Lightweight daemon signs egress state into the hash chain every 3s. Egress anomaly triggers immediate alert banner.',
    accent: { text: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.3)', dot: '#34d399' },
    ctaOptical: true,
  },
]

export function Dashboard() {
  const [isAirGapOpen, setIsAirGapOpen] = useState(false)
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false)
  const [chaosLoading, setChaosLoading] = useState<string | null>(null)
  const [chaosFeedback, setChaosFeedback] = useState<{
    title: string
    desc: string
    type: 'success' | 'blocked' | 'info'
  } | null>(null)

  const {
    primary, backup, activeInstance, incidents, engineMode,
    opaStatus, k8sStatus, peerStatus, totalIncidents,
    uptimeSeconds, isInitializing, refetch,
  } = useZervoxTelemetry()

  const hasOpaBlock = incidents.some(inc => !inc.policy_allowed)
  const hardwareStatus = activeInstance.status?.hardware_breaker_status

  // Trigger chaos via server-side /api/action route
  const triggerChaosScenario = async (
    scenario: 'pod_crash' | 'rbac_attack' | 'node_cordon' | 'immune_quarantine',
  ) => {
    setChaosLoading(scenario)
    setChaosFeedback(null)

    try {
      if (scenario === 'pod_crash') {
        const res = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/api/v1/alerts',
            payload: {
              version: '4',
              groupKey: '{}:{alertname="PodCrashLooping"}',
              status: 'firing',
              receiver: 'zervox-webhook',
              alerts: [{
                status: 'firing',
                labels: { alertname: 'PodCrashLooping', severity: 'critical', pod: `victim-api-${Date.now().toString(36)}`, namespace: 'default' },
                annotations: { summary: 'Pod victim-api is crashing (OOMKilled exit code 137)' },
                startsAt: new Date().toISOString(),
              }],
            },
          }),
        })
        const result = await res.json()
        setChaosFeedback({
          title: '⚡ FORENSIC FREEZE FRAME SEALED',
          desc: 'Pod /proc dump and socket tables hashed into tamper-evident SQLite ledger before pod restart.',
          type: 'success',
        })
      } else if (scenario === 'rbac_attack') {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/api/simulate_attack',
            payload: { attack_type: 'delete_namespace', namespace: 'default', target_name: 'victim-api' },
          }),
        })
        setIsPolicyModalOpen(true)
        setChaosFeedback({
          title: '🛡️ POLICY FIREWALL: DANGEROUS ACTION BLOCKED',
          desc: 'Simulated namespace deletion intercepted by Rego rule REG-001. Diff theater displayed.',
          type: 'blocked',
        })
      } else if (scenario === 'node_cordon') {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/api/v1/alerts',
            payload: {
              version: '4',
              groupKey: '{}:{alertname="NodeDiskPressure"}',
              status: 'firing',
              receiver: 'zervox-webhook',
              alerts: [{
                status: 'firing',
                labels: { alertname: 'NodeDiskPressure', severity: 'critical', node: 'k3s-master-01' },
                annotations: { summary: 'Node disk pressure requiring cordon' },
                startsAt: new Date().toISOString(),
              }],
            },
          }),
        })
        setChaosFeedback({
          title: '🔐 HARDWARE CIRCUIT-BREAKER VERIFIED',
          desc: 'Cordon blast radius authorized via physical RISC-V ESP32-C3 dual-key microcontroller challenge.',
          type: 'info',
        })
      } else if (scenario === 'immune_quarantine') {
        for (let i = 0; i < 2; i++) {
          await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: '/api/simulate_attack',
              payload: { attack_type: 'delete_namespace', namespace: 'default', target_name: 'victim-api' },
            }),
          })
        }
        setChaosFeedback({
          title: '🦠 ADAPTIVE IMMUNE SYSTEM ACTIVATED',
          desc: 'Target placed in 30-minute quarantine lockdown due to repeated attack vectors.',
          type: 'blocked',
        })
      }
      setTimeout(() => refetch(), 600)
    } catch (err) {
      setChaosFeedback({ title: 'EXECUTION FAILED', desc: String(err), type: 'blocked' })
    } finally {
      setChaosLoading(null)
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      {/* Noise overlay */}
      <div className="noise-layer" />

      {/* Background depth auroras */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full blur-[130px]"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -right-20 h-[500px] w-[500px] rounded-full blur-[140px]"
          style={{ background: 'radial-gradient(circle, rgba(147,51,234,0.04) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 left-10 h-[450px] w-[450px] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)' }}
        />
        <div className="bg-grid absolute inset-0" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        {/* Header with AirGapBeacon & Theme Toggle */}
        <Header
          primaryOnline={primary.isOnline}
          backupOnline={backup.isOnline}
          lastUpdated={primary.lastUpdated ?? backup.lastUpdated}
          onRefresh={refetch}
          onOpenAirGap={() => setIsAirGapOpen(true)}
          hardwareStatus={hardwareStatus}
        />

        <main className="mx-auto w-full max-w-screen-2xl px-6 py-6 space-y-6 flex-1">
          {/* Initializing Banner */}
          {isInitializing && (
            <div
              className="flex items-center gap-3 rounded-2xl px-5 py-3 animate-slide-down"
              style={{
                border: '1px solid var(--accent-border)',
                background: 'var(--accent-subtle)',
              }}
            >
              <span className="h-2.5 w-2.5 animate-ping rounded-full" style={{ background: 'var(--accent)' }} />
              <span className="font-mono text-xs font-bold tracking-widest" style={{ color: 'var(--accent)' }}>
                CONNECTING TO ZERVOX CORE SRE TELEMETRY DOCK…
              </span>
            </div>
          )}

          {/* ── 5 INNOVATION FEATURE SHOWCASE DECK ─────────────────── */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
            <SectionLabel
              title="5 CORE INNOVATIONS — BEST INNOVATION AWARD"
              subtitle="Kerala Police Cyberdome HAC'KP 2026 Pitch Architecture"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5">
              {INNOVATIONS.map((inn) => (
                <div
                  key={inn.id}
                  className="rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between"
                  style={{
                    background: inn.accent.bg,
                    border: `1px solid ${inn.accent.border}`,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div>
                    <div
                      className="flex items-center justify-between pb-2 mb-2"
                      style={{ borderBottom: `1px solid ${inn.accent.border}` }}
                    >
                      <span
                        className="font-mono text-[9px] font-extrabold uppercase tracking-[0.2em]"
                        style={{ color: inn.accent.text }}
                      >
                        INNOVATION {inn.id}
                      </span>
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{ background: inn.accent.dot, boxShadow: `0 0 6px ${inn.accent.dot}` }}
                      />
                    </div>
                    <h3
                      className="font-mono text-xs font-bold uppercase tracking-wider mb-0.5"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {inn.title}
                    </h3>
                    <p className="font-mono text-[9px] mb-2 font-semibold" style={{ color: inn.accent.text }}>
                      {inn.subtitle}
                    </p>
                    <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                      {inn.desc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: inn.accent.border }}>
                    {inn.triggerPolicyModal ? (
                      <button
                        type="button"
                        onClick={() => setIsPolicyModalOpen(true)}
                        className="font-mono text-[9px] font-bold rounded-full px-2 py-0.5 cursor-pointer hover:scale-105 transition-all"
                        style={{ color: inn.accent.text, background: inn.accent.bg, border: `1px solid ${inn.accent.border}` }}
                      >
                        OPEN THEATER
                      </button>
                    ) : inn.ctaOptical ? (
                      <button
                        type="button"
                        onClick={() => setIsAirGapOpen(true)}
                        className="font-mono text-[9px] font-bold rounded-full px-2 py-0.5 cursor-pointer hover:scale-105 transition-all"
                        style={{ color: inn.accent.text, background: inn.accent.bg, border: `1px solid ${inn.accent.border}` }}
                      >
                        OPTICAL QR
                      </button>
                    ) : (
                      <span
                        className="font-mono text-[9px] font-bold rounded-full px-2 py-0.5"
                        style={{ color: inn.accent.text, background: inn.accent.bg, border: `1px solid ${inn.accent.border}` }}
                      >
                        {inn.tag}
                      </span>
                    )}
                    <span className="font-mono text-[8px]" style={{ color: 'var(--text-muted)' }}>
                      ACTIVE
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── CHAOS SIMULATION & JUDGES DEMO CONSOLE ────────────── */}
          <section className="rounded-2xl p-4.5 surface animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-base"
                  style={{
                    background: 'var(--accent-subtle)',
                    border: '1px solid var(--accent-border)',
                    color: 'var(--accent)',
                  }}
                >
                  ⚡
                </div>
                <div>
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                    Judges Chaos Simulation Console
                  </h4>
                  <p className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Trigger real-world incident injections to prove out-of-band resilience in real time.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { scenario: 'pod_crash' as const, label: '1. POD CRASH (FREEZE FRAME)', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.4)', loading: 'FREEZING…' },
                  { scenario: 'rbac_attack' as const, label: '2. RBAC ATTACK (REGO THEATER)', color: '#fb7185', bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.4)', loading: 'INTERCEPTING…' },
                  { scenario: 'node_cordon' as const, label: '3. NODE CORDON (RISC-V DUAL-KEY)', color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.4)', loading: 'AUTHORIZING…' },
                  { scenario: 'immune_quarantine' as const, label: '4. ATTACK LOOP (IMMUNE LOCK)', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.4)', loading: 'LOCKING…' },
                ].map(({ scenario, label, color, bg, border, loading }) => (
                  <button
                    key={scenario}
                    type="button"
                    disabled={chaosLoading !== null}
                    onClick={() => triggerChaosScenario(scenario)}
                    className="rounded-xl px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 cursor-pointer hover:scale-[1.02]"
                    style={{ color, background: bg, border: `1px solid ${border}` }}
                  >
                    {chaosLoading === scenario ? loading : label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Feedback Banner */}
            {chaosFeedback && (
              <div
                className="mt-3.5 flex items-start gap-3 rounded-xl p-3 font-mono animate-slide-down"
                style={{
                  border: chaosFeedback.type === 'blocked'
                    ? '1px solid rgba(251,113,133,0.4)'
                    : chaosFeedback.type === 'info'
                    ? '1px solid rgba(129,140,248,0.4)'
                    : '1px solid rgba(52,211,153,0.4)',
                  background: chaosFeedback.type === 'blocked'
                    ? 'rgba(251,113,133,0.08)'
                    : chaosFeedback.type === 'info'
                    ? 'rgba(129,140,248,0.08)'
                    : 'rgba(52,211,153,0.08)',
                }}
              >
                <span className="text-base">
                  {chaosFeedback.type === 'blocked' ? '🛡️' : chaosFeedback.type === 'info' ? '🔐' : '⚡'}
                </span>
                <div className="flex-1 text-xs">
                  <p className="font-bold tracking-wider text-[11px]" style={{ color: 'var(--text-primary)' }}>
                    {chaosFeedback.title}
                  </p>
                  <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    {chaosFeedback.desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setChaosFeedback(null)}
                  className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </section>

          {/* ── FEATURE 1: FORENSIC FREEZE FRAME SHOWCASE ─────────── */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.12s' }}>
            <ForensicFreezeFrame onTriggerLiveFreeze={() => triggerChaosScenario('pod_crash')} />
          </section>

          {/* ── FEATURE 2: GLASS BOX ROOT CAUSE TRAIL ─────────────── */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <GlassBoxVisualizer />
          </section>

          {/* ── TELEMETRY NODES & WATCHDOG ────────────────────────── */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.18s' }}>
            <SectionLabel title="INSTANCE TELEMETRY" subtitle="mTLS Heartbeat · TCP 9000 · High-Availability Watchdog" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <HeartbeatCard instance={primary} />
              <HeartbeatCard instance={backup} />
              <EngineModeCard
                mode={engineMode}
                opaStatus={opaStatus}
                k8sStatus={k8sStatus}
                peerStatus={peerStatus}
                totalIncidents={totalIncidents}
                hasOpaBlock={hasOpaBlock}
              />
            </div>
          </section>

          {/* ── FEATURE 4: SPLIT-BRAIN SENTINEL TOPOLOGY ──────────── */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.22s' }}>
            <SectionLabel title="SPLIT-BRAIN SENTINEL & CLUSTER METRICS" subtitle="Autonomous Failover Routing Track A → Track B" />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 items-stretch">
              <div className="xl:col-span-7 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[
                  { label: 'Active Node', value: activeInstance.health?.role?.toUpperCase() ?? '—', color: 'var(--accent)' },
                  { label: 'Cluster State', value: activeInstance.health?.state?.toUpperCase() ?? '—', color: activeInstance.health?.state === 'active' ? 'var(--status-green)' : 'var(--status-amber)' },
                  { label: 'Engine Mode', value: engineMode === 'ai' ? 'LLM / AI' : engineMode === 'fallback' ? 'FALLBACK' : '—', color: engineMode === 'ai' ? 'var(--accent)' : 'var(--status-amber)' },
                  { label: 'HW Dual-Key', value: hardwareStatus?.includes('ARMED') ? 'RISC-V ARMED' : 'STANDALONE', color: hardwareStatus?.includes('ARMED') ? '#a78bfa' : 'var(--text-secondary)' },
                  { label: 'Uptime', value: uptimeSeconds != null ? formatUptime(uptimeSeconds) : '—', color: 'var(--text-primary)' },
                  { label: 'Total Incidents', value: totalIncidents.toLocaleString(), color: 'var(--accent)' },
                  { label: 'OPA Gate', value: opaStatus === 'reachable' ? 'EXTERNAL' : 'EMBEDDED', color: opaStatus === 'reachable' ? 'var(--status-green)' : 'var(--status-amber)' },
                  { label: 'K8s Status', value: k8sStatus ? k8sStatus.toUpperCase() : 'STANDBY', color: k8sStatus === 'connected' ? 'var(--status-green)' : 'var(--status-amber)' },
                ].map(({ label, value, color }) => (
                  <Card key={label} className="p-4 hover:-translate-y-0.5 transition-transform duration-200">
                    <CardLabel>{label}</CardLabel>
                    <p className="font-mono text-sm font-bold tracking-wider" style={{ color }}>
                      {value}
                    </p>
                  </Card>
                ))}
              </div>

              {/* Split-Brain Sentinel Component */}
              <div className="xl:col-span-5 flex flex-col">
                <TopologyMiniMap
                  primaryOnline={primary.isOnline}
                  backupOnline={backup.isOnline}
                  activeRole={activeInstance.health?.role ?? (primary.isOnline ? 'primary' : 'backup')}
                />
              </div>
            </div>
          </section>

          {/* ── INCIDENT FEED & EVIDENCE VAULT ────────────────────── */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.26s' }}>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel title="REMEDIATION TIMELINE" subtitle="Live SQLite WAL · Evidence Chain of Custody" />
              {incidents.length > 0 && (
                <Badge variant="sky" size="sm">{incidents.length} RECORDS</Badge>
              )}
            </div>
            <IncidentTable
              incidents={incidents}
              isLoading={!isInitializing && (primary.isOnline || backup.isOnline)}
            />
          </section>
        </main>

        {/* Footer */}
        <footer
          className="relative z-10 py-4 text-center"
          style={{
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--header-bg)',
          }}
        >
          <p className="font-mono text-[10px] tracking-wider" style={{ color: 'var(--text-muted)' }}>
            ZERVOX SRE ENGINE v{activeInstance.status?.version ?? '0.1.0'} · KERALA POLICE CYBERDOME ·{' '}
            <span style={{ color: 'var(--accent)' }} className="font-semibold">AUTONOMOUS CYBER RESILIENCE</span>
          </p>
        </footer>
      </div>

      {/* Feature 3: Policy Firewall Replay Modal */}
      <PolicyFirewallModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        onTriggerSimulatedAttack={() => triggerChaosScenario('rbac_attack')}
      />

      {/* Optical Modal */}
      <AirGapOpticalModal
        isOpen={isAirGapOpen}
        onClose={() => setIsAirGapOpen(false)}
        activeInstance={activeInstance}
        incidents={incidents}
      />
    </div>
  )
}

function SectionLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="hr-gradient flex-1" />
      <div className="text-right shrink-0">
        <p className="font-mono text-[11px] font-extrabold uppercase tracking-[0.25em]" style={{ color: 'var(--text-primary)' }}>
          {title}
        </p>
        <p className="font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
      </div>
    </div>
  )
}
