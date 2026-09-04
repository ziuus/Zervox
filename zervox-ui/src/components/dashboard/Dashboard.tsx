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

// Innovation accent palette (fixed, not theme-dependent)
const INNOVATIONS = [
  {
    id: 'I-01',
    title: 'Forensic Freeze Vault',
    label: 'EVIDENCE PROOF',
    tag: 'SHA-256 ACTIVE',
    desc: 'Pre-remediation volatile evidence preservation. Locks memory dumps & traces before pod restart into a tamper-evident SHA-256 SQLite vault.',
    accent: { text: '#a78bfa', bg: 'rgba(167,139,250,0.07)', border: 'rgba(167,139,250,0.28)', dot: '#a78bfa' },
  },
  {
    id: 'I-02',
    title: 'Hardware Circuit-Breaker',
    label: 'RISC-V GUARD',
    tag: 'UART DUAL-KEY',
    desc: 'Physical Dual-Key authentication using embedded RISC-V / ESP32-C3 coprocessor. High blast-radius operations require hardware handshake.',
    accent: { text: '#818cf8', bg: 'rgba(129,140,248,0.07)', border: 'rgba(129,140,248,0.28)', dot: '#818cf8' },
  },
  {
    id: 'I-03',
    title: 'Adaptive Immune System',
    label: 'AUTO-QUARANTINE',
    tag: '30-MIN ISOLATION',
    desc: 'Dynamic threat quarantine. Repeating attack vectors placed in 30-minute lockdown with pre-evaluation policy denial.',
    accent: { text: '#fb7185', bg: 'rgba(251,113,133,0.07)', border: 'rgba(251,113,133,0.28)', dot: '#fb7185' },
  },
  {
    id: 'I-04',
    title: 'Air-Gap Optical Egress',
    label: 'ZERO-NETWORK',
    tag: 'QR SIGNED',
    desc: 'Zero-network status extraction via high-density cryptographically signed QR codes for SCADA and military-grade air-gapped networks.',
    accent: { text: '#fbbf24', bg: 'rgba(251,191,36,0.07)', border: 'rgba(251,191,36,0.28)', dot: '#fbbf24' },
    cta: true,
  },
]

export function Dashboard() {
  const [isAirGapOpen, setIsAirGapOpen] = useState(false)
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

  const hasOpaBlock     = incidents.some(inc => !inc.policy_allowed)
  const hardwareStatus  = activeInstance.status?.hardware_breaker_status

  const triggerChaosScenario = async (
    scenario: 'pod_crash' | 'rbac_attack' | 'node_cordon' | 'immune_quarantine',
  ) => {
    setChaosLoading(scenario)
    setChaosFeedback(null)
    const primaryUrl = process.env.NEXT_PUBLIC_PRIMARY_URL ?? 'http://localhost:8080'

    try {
      if (scenario === 'pod_crash') {
        await fetch(`${primaryUrl}/api/v1/alerts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': 'zervox-secret-token' },
          body: JSON.stringify({
            version: '4', groupKey: '{}:{alertname="PodCrashLooping"}', status: 'firing',
            receiver: 'zervox-webhook',
            alerts: [{ status: 'firing', labels: { alertname: 'PodCrashLooping', severity: 'critical', pod: `victim-api-${Date.now().toString(36)}`, namespace: 'default' }, annotations: { summary: 'Pod victim-api is crashing (OOMKilled)' }, startsAt: new Date().toISOString() }],
          }),
        })
        setChaosFeedback({ title: '⚡ FORENSIC FREEZE ENGAGED', desc: 'Memory & pod spec snapshot captured into SHA-256 SQLite vault before container restart.', type: 'success' })
      } else if (scenario === 'rbac_attack') {
        await fetch(`${primaryUrl}/api/simulate_attack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': 'zervox-secret-token' },
          body: JSON.stringify({ attack_type: 'delete_namespace', namespace: 'default', target_name: 'victim-api' }),
        })
        setChaosFeedback({ title: '🛡️ OPA SECURITY GATE REJECTED', desc: 'Simulated namespace deletion attack blocked by unbypassable Rego security boundary.', type: 'blocked' })
      } else if (scenario === 'node_cordon') {
        await fetch(`${primaryUrl}/api/v1/alerts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': 'zervox-secret-token' },
          body: JSON.stringify({
            version: '4', groupKey: '{}:{alertname="NodeDiskPressure"}', status: 'firing',
            receiver: 'zervox-webhook',
            alerts: [{ status: 'firing', labels: { alertname: 'NodeDiskPressure', severity: 'critical', node: 'k3s-master-01' }, annotations: { summary: 'Node disk pressure' }, startsAt: new Date().toISOString() }],
          }),
        })
        setChaosFeedback({ title: '🔐 HARDWARE CIRCUIT-BREAKER VERIFIED', desc: 'Cordon action authorized via physical RISC-V ESP32-C3 microcontroller dual-key handshake.', type: 'info' })
      } else if (scenario === 'immune_quarantine') {
        for (let i = 0; i < 2; i++) {
          await fetch(`${primaryUrl}/api/simulate_attack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'zervox-secret-token' },
            body: JSON.stringify({ attack_type: 'delete_namespace', namespace: 'default', target_name: 'victim-api' }),
          })
        }
        setChaosFeedback({ title: '🦠 ADAPTIVE IMMUNE SYSTEM ACTIVATED', desc: 'Target placed in 30-minute quarantine lockdown due to repeated attack patterns.', type: 'blocked' })
      }
      setTimeout(() => refetch(), 500)
    } catch (err) {
      setChaosFeedback({ title: 'EXECUTION FAILED', desc: String(err), type: 'blocked' })
    } finally {
      setChaosLoading(null)
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>

      {/* Noise texture */}
      <div className="noise-layer" />

      {/* Background depth layer */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full blur-[130px]"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 -right-20 h-[500px] w-[500px] rounded-full blur-[140px]"
          style={{ background: 'radial-gradient(circle, rgba(147,51,234,0.04) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-32 left-10 h-[450px] w-[450px] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />
        <div className="bg-grid absolute inset-0" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col flex-1">
        <Header
          primaryOnline={primary.isOnline}
          backupOnline={backup.isOnline}
          lastUpdated={primary.lastUpdated ?? backup.lastUpdated}
          onRefresh={refetch}
          onOpenAirGap={() => setIsAirGapOpen(true)}
          hardwareStatus={hardwareStatus}
        />

        <main className="mx-auto w-full max-w-screen-2xl px-6 py-6 space-y-5 flex-1">

          {/* Initializing banner */}
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
                INITIALIZING ZERVOX TELEMETRY DOCK — CONNECTING TO LOCAL ENGINES…
              </span>
            </div>
          )}

          {/* ── SECTION 1: Innovation Command Deck ────────────────── */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
            <SectionLabel title="INNOVATION COMMAND DECK" subtitle="Kerala Police Cyberdome HAC'KP 2026 — 4 Core Innovations" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {INNOVATIONS.map((inn) => (
                <div
                  key={inn.id}
                  className="group rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5"
                  style={{
                    background: inn.accent.bg,
                    border: `1px solid ${inn.accent.border}`,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div
                    className="flex items-center justify-between pb-2 mb-2"
                    style={{ borderBottom: `1px solid ${inn.accent.border}` }}
                  >
                    <span
                      className="font-mono text-[9px] font-extrabold uppercase tracking-[0.2em]"
                      style={{ color: inn.accent.text }}
                    >
                      {inn.id}
                    </span>
                    <span
                      className="h-1.5 w-1.5 rounded-full animate-pulse"
                      style={{ background: inn.accent.dot, boxShadow: `0 0 6px ${inn.accent.dot}` }}
                    />
                  </div>
                  <h3
                    className="font-mono text-xs font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {inn.title}
                  </h3>
                  <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                    {inn.desc}
                  </p>
                  <div className="flex items-center justify-between">
                    {inn.cta ? (
                      <button
                        type="button"
                        onClick={() => setIsAirGapOpen(true)}
                        className="font-mono text-[9px] font-bold rounded-full px-2 py-0.5 cursor-pointer transition-all hover:scale-105"
                        style={{ color: inn.accent.text, background: inn.accent.bg, border: `1px solid ${inn.accent.border}` }}
                      >
                        LAUNCH OPTICAL QR
                      </button>
                    ) : (
                      <span
                        className="font-mono text-[9px] font-bold rounded-full px-2 py-0.5"
                        style={{ color: inn.accent.text, background: inn.accent.bg, border: `1px solid ${inn.accent.border}` }}
                      >
                        {inn.label}
                      </span>
                    )}
                    <span className="font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {inn.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── SECTION 2: Chaos Simulation Console ───────────────── */}
          <section
            className="rounded-2xl p-4 surface animate-fade-in-up"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-sm"
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
                    Live Chaos Simulation Console
                  </h4>
                  <p className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Trigger real-time attack scenarios to demonstrate autonomous out-of-band defense.
                  </p>
                </div>
              </div>

              {/* Chaos Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { scenario: 'pod_crash'         as const, label: 'POD CRASH (FREEZE)',    color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.35)', loading: 'FREEZING…'    },
                  { scenario: 'rbac_attack'        as const, label: 'RBAC ATTACK (OPA)',      color: '#fb7185', bg: 'rgba(251,113,133,0.10)', border: 'rgba(251,113,133,0.35)', loading: 'INJECTING…'  },
                  { scenario: 'node_cordon'        as const, label: 'NODE CORDON (RISC-V)',   color: '#818cf8', bg: 'rgba(129,140,248,0.10)', border: 'rgba(129,140,248,0.35)', loading: 'AUTHORIZING…' },
                  { scenario: 'immune_quarantine'  as const, label: 'ATTACK LOOP (IMMUNE)',   color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.35)',  loading: 'LOCKING…'    },
                ].map(({ scenario, label, color, bg, border, loading }) => (
                  <button
                    key={scenario}
                    type="button"
                    disabled={chaosLoading !== null}
                    onClick={() => triggerChaosScenario(scenario)}
                    className="rounded-xl px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 cursor-pointer hover:scale-[1.02]"
                    style={{ color, background: bg, border: `1px solid ${border}` }}
                  >
                    {chaosLoading === scenario ? loading : label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback Toast */}
            {chaosFeedback && (
              <div
                className="mt-3 flex items-start gap-3 rounded-xl p-3 font-mono animate-slide-down"
                style={{
                  border: chaosFeedback.type === 'blocked' ? '1px solid rgba(251,113,133,0.35)'
                        : chaosFeedback.type === 'info' ? '1px solid rgba(129,140,248,0.35)'
                        : '1px solid rgba(52,211,153,0.35)',
                  background: chaosFeedback.type === 'blocked' ? 'rgba(251,113,133,0.07)'
                             : chaosFeedback.type === 'info' ? 'rgba(129,140,248,0.07)'
                             : 'rgba(52,211,153,0.07)',
                }}
              >
                <span className="text-base">
                  {chaosFeedback.type === 'blocked' ? '🛡️' : chaosFeedback.type === 'info' ? '🔐' : '⚡'}
                </span>
                <div className="flex-1 text-xs" style={{ color: 'var(--text-primary)' }}>
                  <p className="font-bold tracking-wider text-[11px]">{chaosFeedback.title}</p>
                  <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{chaosFeedback.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChaosFeedback(null)}
                  className="text-xs transition-opacity hover:opacity-100 cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ✕
                </button>
              </div>
            )}
          </section>

          {/* ── SECTION 3: Instance Telemetry ─────────────────────── */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <SectionLabel title="INSTANCE TELEMETRY" subtitle="Heartbeat · TCP 9000 · mTLS HA Watchdog" />
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

          {/* ── SECTION 4: Metrics + Topology ─────────────────────── */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.20s' }}>
            <SectionLabel title="SYSTEM METRICS & TOPOLOGY" subtitle="Real-time cluster routing · Track A → Track B" />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 items-stretch">
              {/* Metric tiles */}
              <div className="xl:col-span-7 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[
                  { label: 'Active Node',    value: activeInstance.health?.role?.toUpperCase() ?? '—',           color: 'var(--accent)' },
                  { label: 'Cluster State',  value: activeInstance.health?.state?.toUpperCase() ?? '—',          color: activeInstance.health?.state === 'active' ? 'var(--status-green)' : 'var(--status-amber)' },
                  { label: 'Engine Mode',    value: engineMode === 'ai' ? 'LLM / AI' : engineMode === 'fallback' ? 'FALLBACK' : '—', color: engineMode === 'ai' ? 'var(--accent)' : 'var(--status-amber)' },
                  { label: 'HW Dual-Key',   value: hardwareStatus?.includes('ARMED') ? 'RISC-V ARMED' : 'STANDALONE', color: hardwareStatus?.includes('ARMED') ? '#a78bfa' : 'var(--text-secondary)' },
                  { label: 'Uptime',         value: uptimeSeconds != null ? formatUptime(uptimeSeconds) : '—',    color: 'var(--text-primary)' },
                  { label: 'Incidents',      value: totalIncidents.toLocaleString(),                              color: 'var(--accent)' },
                  { label: 'OPA Gate',       value: opaStatus === 'reachable' ? 'EXTERNAL' : 'EMBEDDED',          color: opaStatus === 'reachable' ? 'var(--status-green)' : 'var(--status-amber)' },
                  { label: 'K8s Status',     value: k8sStatus ? k8sStatus.toUpperCase() : 'STANDBY',             color: k8sStatus === 'connected' ? 'var(--status-green)' : 'var(--status-amber)' },
                ].map(({ label, value, color }) => (
                  <Card key={label} className="p-4 hover:-translate-y-0.5 transition-transform duration-200">
                    <CardLabel>{label}</CardLabel>
                    <p className="font-mono text-sm font-bold tracking-wider" style={{ color }}>
                      {value}
                    </p>
                  </Card>
                ))}
              </div>

              {/* Topology mini-map */}
              <div className="xl:col-span-5 flex flex-col">
                <TopologyMiniMap
                  primaryOnline={primary.isOnline}
                  backupOnline={backup.isOnline}
                  activeRole={activeInstance.health?.role ?? (primary.isOnline ? 'primary' : 'backup')}
                />
              </div>
            </div>
          </section>

          {/* ── SECTION 5: Incident Feed ──────────────────────────── */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel title="REMEDIATION TIMELINE" subtitle="Live SQLite WAL · Incident Feed · Evidence Chain" />
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

      {/* Air-Gap Modal */}
      <AirGapOpticalModal
        isOpen={isAirGapOpen}
        onClose={() => setIsAirGapOpen(false)}
        activeInstance={activeInstance}
        incidents={incidents}
      />
    </div>
  )
}

// ── Local helpers ──────────────────────────────────────────────────────────────

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
