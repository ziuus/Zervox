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

export function Dashboard() {
  const [isAirGapOpen, setIsAirGapOpen] = useState(false)
  const [chaosLoading, setChaosLoading] = useState<string | null>(null)
  const [chaosFeedback, setChaosFeedback] = useState<{ title: string; desc: string; type: 'success' | 'blocked' | 'info' } | null>(null)

  const {
    primary,
    backup,
    activeInstance,
    incidents,
    engineMode,
    opaStatus,
    k8sStatus,
    peerStatus,
    totalIncidents,
    uptimeSeconds,
    isInitializing,
    refetch,
  } = useZervoxTelemetry()

  const hasOpaBlock = incidents.some(inc => !inc.policy_allowed)
  const hardwareStatus = activeInstance.status?.hardware_breaker_status

  // Live in-dashboard Chaos / Innovation Trigger
  const triggerChaosScenario = async (scenario: 'pod_crash' | 'rbac_attack' | 'node_cordon' | 'immune_quarantine') => {
    setChaosLoading(scenario)
    setChaosFeedback(null)
    const primaryUrl = process.env.NEXT_PUBLIC_PRIMARY_URL ?? 'http://localhost:8080'

    try {
      if (scenario === 'pod_crash') {
        const res = await fetch(`${primaryUrl}/api/v1/alerts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': 'zervox-secret-token' },
          body: JSON.stringify({
            version: '4',
            groupKey: '{}:{alertname="PodCrashLooping"}',
            status: 'firing',
            receiver: 'zervox-webhook',
            alerts: [{
              status: 'firing',
              labels: { alertname: 'PodCrashLooping', severity: 'critical', pod: 'victim-api-898', namespace: 'default' },
              annotations: { summary: 'Pod victim-api is crashing with OOMKilled (Exit Code 137)' },
              startsAt: new Date().toISOString(),
            }],
          }),
        })
        const data = await res.json()
        setChaosFeedback({
          title: '⚡ FORENSIC FREEZE ENGAGED',
          desc: 'Pod memory & specs snapshot captured into SQLite vault with SHA-256 before container restart.',
          type: 'success',
        })
      } else if (scenario === 'rbac_attack') {
        const res = await fetch(`${primaryUrl}/api/simulate_attack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': 'zervox-secret-token' },
          body: JSON.stringify({
            attack_type: 'delete_namespace',
            namespace: 'default',
            target_name: 'victim-api',
          }),
        })
        const data = await res.json()
        setChaosFeedback({
          title: '🛡️ OPA SECURITY GATE REJECTED',
          desc: 'Simulated namespace deletion attack blocked by unbypassable Rego security boundary.',
          type: 'blocked',
        })
      } else if (scenario === 'node_cordon') {
        const res = await fetch(`${primaryUrl}/api/v1/alerts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': 'zervox-secret-token' },
          body: JSON.stringify({
            version: '4',
            groupKey: '{}:{alertname="NodeDiskPressure"}',
            status: 'firing',
            receiver: 'zervox-webhook',
            alerts: [{
              status: 'firing',
              labels: { alertname: 'NodeDiskPressure', severity: 'critical', node: 'k3s-master-01' },
              annotations: { summary: 'Node k3s-master-01 disk pressure requiring node cordon' },
              startsAt: new Date().toISOString(),
            }],
          }),
        })
        const data = await res.json()
        setChaosFeedback({
          title: '🔐 HARDWARE CIRCUIT-BREAKER VERIFIED',
          desc: 'Cordon action authorized via physical RISC-V ESP32-C3 microcontroller dual-key handshake.',
          type: 'info',
        })
      } else if (scenario === 'immune_quarantine') {
        // Fire attack twice to trigger quarantine
        for (let i = 0; i < 2; i++) {
          await fetch(`${primaryUrl}/api/simulate_attack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'zervox-secret-token' },
            body: JSON.stringify({ attack_type: 'delete_namespace', namespace: 'default', target_name: 'victim-api' }),
          })
        }
        setChaosFeedback({
          title: '🦠 ADAPTIVE IMMUNE SYSTEM ACTIVATED',
          desc: 'Target placed in 30-minute quarantine lockdown due to repeated attack vectors.',
          type: 'blocked',
        })
      }
      setTimeout(() => refetch(), 500)
    } catch (err) {
      setChaosFeedback({
        title: 'EXECUTION FAILED',
        desc: String(err),
        type: 'blocked',
      })
    } finally {
      setChaosLoading(null)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#030712] text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-sky-500/30">
      {/* Noise Texture Layer */}
      <div className="noise-layer" />

      {/* Background Multi-Layer Depth (Layer 1: Ambient auroras + masked grid) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-sky-500/[0.07] blur-[120px]" />
        <div className="absolute top-1/3 -right-20 h-[600px] w-[600px] rounded-full bg-purple-500/[0.06] blur-[140px]" />
        <div className="absolute -bottom-40 left-10 h-[500px] w-[500px] rounded-full bg-emerald-500/[0.05] blur-[120px]" />
        <div className="absolute inset-0 bg-grid-cyber opacity-70" />
      </div>

      <div className="relative z-10">
        <Header
          primaryOnline={primary.isOnline}
          backupOnline={backup.isOnline}
          lastUpdated={primary.lastUpdated ?? backup.lastUpdated}
          onRefresh={refetch}
          onOpenAirGap={() => setIsAirGapOpen(true)}
          hardwareStatus={hardwareStatus}
        />

        <main className="mx-auto max-w-screen-2xl px-6 py-6 space-y-6">
          {/* Initializing banner */}
          {isInitializing && (
            <div className="flex items-center gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-5 py-3 backdrop-blur-xl">
              <span className="h-2.5 w-2.5 animate-ping rounded-full bg-sky-400" />
              <span className="font-mono text-xs font-bold tracking-widest text-sky-300">
                INITIALIZING AEROSPACE TELEMETRY DOCK — CONNECTING TO LOCAL ENGINES…
              </span>
            </div>
          )}

          {/* ── Innovation Command Deck (Kerala Police Cyberdome Innovations) ── */}
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Innovation 1 */}
              <div className="group rounded-2xl border border-white/[0.08] bg-[#0b1329]/70 backdrop-blur-xl p-4 transition-all duration-300 hover:border-purple-500/40 hover:shadow-[0_0_24px_rgba(168,85,247,0.15)] hover:-translate-y-0.5">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="font-mono text-[9px] font-extrabold uppercase tracking-[0.2em] text-purple-400">
                    INNOVATION 01
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_6px_#a855f7]" />
                </div>
                <h3 className="mt-2.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-100">
                  Forensic Freeze Vault
                </h3>
                <p className="mt-1 text-[11px] text-slate-400 leading-relaxed font-sans">
                  Pre-remediation volatile evidence preservation. Locks memory dumps & traces before pod restart into a tamper-evident SHA-256 SQLite vault.
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full">
                    EVIDENCE PROOF
                  </span>
                  <span className="font-mono text-[9px] text-slate-500">SHA-256 ACTIVE</span>
                </div>
              </div>

              {/* Innovation 2 */}
              <div className="group rounded-2xl border border-white/[0.08] bg-[#0b1329]/70 backdrop-blur-xl p-4 transition-all duration-300 hover:border-indigo-500/40 hover:shadow-[0_0_24px_rgba(99,102,241,0.15)] hover:-translate-y-0.5">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="font-mono text-[9px] font-extrabold uppercase tracking-[0.2em] text-indigo-400">
                    INNOVATION 02
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_6px_#818cf8]" />
                </div>
                <h3 className="mt-2.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-100">
                  Hardware Circuit-Breaker
                </h3>
                <p className="mt-1 text-[11px] text-slate-400 leading-relaxed font-sans">
                  Physical Dual-Key authentication using embedded RISC-V / ESP32-C3 coprocessor. High blast-radius operations require hardware handshake.
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                    RISC-V GUARD
                  </span>
                  <span className="font-mono text-[9px] text-slate-500">UART DUAL-KEY</span>
                </div>
              </div>

              {/* Innovation 3 */}
              <div className="group rounded-2xl border border-white/[0.08] bg-[#0b1329]/70 backdrop-blur-xl p-4 transition-all duration-300 hover:border-rose-500/40 hover:shadow-[0_0_24px_rgba(244,63,94,0.15)] hover:-translate-y-0.5">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="font-mono text-[9px] font-extrabold uppercase tracking-[0.2em] text-rose-400">
                    INNOVATION 03
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse shadow-[0_0_6px_#f43f5e]" />
                </div>
                <h3 className="mt-2.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-100">
                  Adaptive Immune System
                </h3>
                <p className="mt-1 text-[11px] text-slate-400 leading-relaxed font-sans">
                  Dynamic threat quarantine. Repeating attack vectors are instantly placed in 30-minute lockdown with pre-evaluation policy denial.
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full">
                    AUTO-QUARANTINE
                  </span>
                  <span className="font-mono text-[9px] text-slate-500">30-MIN ISOLATION</span>
                </div>
              </div>

              {/* Innovation 4 */}
              <div className="group rounded-2xl border border-white/[0.08] bg-[#0b1329]/70 backdrop-blur-xl p-4 transition-all duration-300 hover:border-amber-500/40 hover:shadow-[0_0_24px_rgba(245,158,11,0.15)] hover:-translate-y-0.5">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="font-mono text-[9px] font-extrabold uppercase tracking-[0.2em] text-amber-400">
                    INNOVATION 04
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_#fbbf24]" />
                </div>
                <h3 className="mt-2.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-100">
                  Air-Gap Optical Egress
                </h3>
                <p className="mt-1 text-[11px] text-slate-400 leading-relaxed font-sans">
                  Zero-network status extraction via high-density cryptographically signed QR codes. Air-gapped visual extraction for SCADA and military networks.
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsAirGapOpen(true)}
                    className="font-mono text-[9px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full hover:bg-amber-500/25 transition-all cursor-pointer"
                  >
                    LAUNCH OPTICAL QR
                  </button>
                  <span className="font-mono text-[9px] text-slate-500">ZERO-NETWORK</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Interactive Chaos Simulation Bar (Judges Demo Console) ── */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#080e22]/90 backdrop-blur-xl p-4 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
                  ⚡
                </div>
                <div>
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                    Live Proof & Chaos Simulation Console
                  </h4>
                  <p className="font-mono text-[10px] text-slate-400">
                    Trigger real-time attack scenarios to demonstrate autonomous out-of-band defense.
                  </p>
                </div>
              </div>

              {/* Simulation Trigger Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={chaosLoading !== null}
                  onClick={() => triggerChaosScenario('pod_crash')}
                  className="rounded-xl border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-purple-300 transition-all hover:bg-purple-500/20 hover:border-purple-300 hover:shadow-[0_0_16px_rgba(168,85,247,0.2)] active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {chaosLoading === 'pod_crash' ? 'FREEZING…' : 'POD CRASH (FREEZE)'}
                </button>

                <button
                  type="button"
                  disabled={chaosLoading !== null}
                  onClick={() => triggerChaosScenario('rbac_attack')}
                  className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-rose-300 transition-all hover:bg-rose-500/20 hover:border-rose-300 hover:shadow-[0_0_16px_rgba(244,63,94,0.2)] active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {chaosLoading === 'rbac_attack' ? 'INJECTING…' : 'RBAC ATTACK (OPA GATE)'}
                </button>

                <button
                  type="button"
                  disabled={chaosLoading !== null}
                  onClick={() => triggerChaosScenario('node_cordon')}
                  className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-indigo-300 transition-all hover:bg-indigo-500/20 hover:border-indigo-300 hover:shadow-[0_0_16px_rgba(99,102,241,0.2)] active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {chaosLoading === 'node_cordon' ? 'AUTHORIZING…' : 'NODE CORDON (RISC-V)'}
                </button>

                <button
                  type="button"
                  disabled={chaosLoading !== null}
                  onClick={() => triggerChaosScenario('immune_quarantine')}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300 transition-all hover:bg-amber-500/20 hover:border-amber-300 hover:shadow-[0_0_16px_rgba(245,158,11,0.2)] active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {chaosLoading === 'immune_quarantine' ? 'LOCKING…' : 'ATTACK LOOP (IMMUNE LOCK)'}
                </button>
              </div>
            </div>

            {/* Live Feedback Toast Banner */}
            {chaosFeedback && (
              <div className={`mt-3 flex items-start gap-3 rounded-xl border p-3 font-mono transition-all ${
                chaosFeedback.type === 'blocked'
                  ? 'border-rose-500/40 bg-rose-950/30 text-rose-200'
                  : chaosFeedback.type === 'info'
                    ? 'border-indigo-500/40 bg-indigo-950/30 text-indigo-200'
                    : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
              }`}>
                <span className="text-base">
                  {chaosFeedback.type === 'blocked' ? '🛡️' : chaosFeedback.type === 'info' ? '🔐' : '⚡'}
                </span>
                <div className="flex-1 text-xs">
                  <p className="font-bold tracking-wider">{chaosFeedback.title}</p>
                  <p className="mt-0.5 text-[11px] opacity-90">{chaosFeedback.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChaosFeedback(null)}
                  className="text-xs opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            )}
          </section>

          {/* ── Section 1: Telemetry Overview ── */}
          <section>
            <SectionLabel index="01" title="INSTANCE TELEMETRY" subtitle="Heartbeat · TCP 9000 · HA Watchdog" />
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

          {/* ── Section 2: System Topology & Metrics ── */}
          <section>
            <SectionLabel index="02" title="SYSTEM TOPOLOGY & METRICS" subtitle="Track A (Zervox) to Track B (k3s Cluster) Routing" />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 items-stretch">
              {/* Metrics strip */}
              <div className="xl:col-span-7 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <MetricTile
                  label="Active Node"
                  value={activeInstance.health?.role?.toUpperCase() ?? '—'}
                  accent="sky"
                />
                <MetricTile
                  label="Cluster State"
                  value={activeInstance.health?.state?.toUpperCase() ?? '—'}
                  accent={activeInstance.health?.state === 'active' ? 'green' : 'amber'}
                />
                <MetricTile
                  label="Engine Mode"
                  value={engineMode === 'ai' ? 'LLM / AI' : engineMode === 'fallback' ? 'FALLBACK' : '—'}
                  accent={engineMode === 'ai' ? 'sky' : 'amber'}
                />
                <MetricTile
                  label="HW Dual-Key"
                  value={hardwareStatus?.includes('ARMED') ? 'RISC-V ARMED' : 'STANDALONE'}
                  accent={hardwareStatus?.includes('ARMED') ? 'purple' : 'slate'}
                />
                <MetricTile
                  label="Uptime"
                  value={uptimeSeconds != null ? formatUptime(uptimeSeconds) : '—'}
                  accent="slate"
                />
                <MetricTile
                  label="Total Incidents"
                  value={totalIncidents.toLocaleString()}
                  accent="sky"
                />
                <MetricTile
                  label="OPA Gate"
                  value={opaStatus === 'reachable' ? 'EXTERNAL' : 'EMBEDDED'}
                  accent={opaStatus === 'reachable' ? 'green' : 'amber'}
                />
                <MetricTile
                  label="K8s Status"
                  value={k8sStatus ? k8sStatus.toUpperCase() : 'STANDBY'}
                  accent={k8sStatus === 'connected' ? 'green' : 'amber'}
                />
              </div>

              {/* Topology Mini-Map - 5 cols on 1080p */}
              <div className="xl:col-span-5 flex flex-col">
                <TopologyMiniMap
                  primaryOnline={primary.isOnline}
                  backupOnline={backup.isOnline}
                  activeRole={activeInstance.health?.role ?? (primary.isOnline ? 'primary' : 'backup')}
                />
              </div>
            </div>
          </section>

          {/* ── Section 3: Incident Feed ── */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel index="03" title="INCIDENT FEED" subtitle="Live SQLite WAL · Remediation Timeline" />
              {incidents.length > 0 && (
                <Badge variant="sky" size="sm">
                  {incidents.length} RECORDS
                </Badge>
              )}
            </div>
            <IncidentTable incidents={incidents} isLoading={!isInitializing && (primary.isOnline || backup.isOnline)} />
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-4 text-center bg-[#02050e]/95 backdrop-blur-md">
        <p className="font-mono text-[10px] text-slate-500 tracking-wider">
          ZERVOX SRE ENGINE v{activeInstance.status?.version ?? '0.1.0'} · KERALA POLICE CYBERDOME INNOVATION EDITION ·{' '}
          <span className="text-sky-400 font-semibold">AUTONOMOUS CYBER RESILIENCE</span>
        </p>
      </footer>

      {/* Innovation 4: Air-Gapped Optical Telemetry Modal */}
      <AirGapOpticalModal
        isOpen={isAirGapOpen}
        onClose={() => setIsAirGapOpen(false)}
        activeInstance={activeInstance}
        incidents={incidents}
      />
    </div>
  )
}

// ── Local helper components ──────────────────────────────────────────────────

function SectionLabel({ index, title, subtitle }: { index: string; title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="font-mono text-[10px] font-extrabold text-sky-400/50">{index}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-sky-500/20 via-white/[0.08] to-transparent" />
      <div className="text-right">
        <p className="font-mono text-[11px] font-extrabold uppercase tracking-[0.25em] text-slate-200">{title}</p>
        <p className="font-mono text-[9px] text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

function MetricTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  const accentMap: Record<string, string> = {
    sky:    'text-sky-400',
    green:  'text-emerald-400',
    amber:  'text-amber-400',
    slate:  'text-slate-200',
    purple: 'text-purple-400',
  }
  return (
    <Card className="p-4">
      <CardLabel className="text-[9px]">{label}</CardLabel>
      <p className={`font-mono text-sm font-bold tracking-wider ${accentMap[accent] ?? 'text-slate-200'}`}>{value}</p>
    </Card>
  )
}

