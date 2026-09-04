'use client'

import { useZervoxTelemetry } from '@/hooks/useZervoxTelemetry'
import { Header } from '@/components/dashboard/Header'
import { HeartbeatCard } from '@/components/dashboard/HeartbeatCard'
import { EngineModeCard } from '@/components/dashboard/EngineModeCard'
import { IncidentTable } from '@/components/dashboard/IncidentTable'
import { Card, CardLabel } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatUptime } from '@/lib/utils'

import { TopologyMiniMap } from '@/components/dashboard/TopologyMiniMap'

export function Dashboard() {
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

  return (
    <div className="min-h-screen bg-[#020409] bg-grid-pattern text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-sky-500/30">
      {/* Ambient top glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-sky-950/10 to-transparent" />

      <div>
        <Header
          primaryOnline={primary.isOnline}
          backupOnline={backup.isOnline}
          lastUpdated={primary.lastUpdated ?? backup.lastUpdated}
          onRefresh={refetch}
        />

        <main className="mx-auto max-w-screen-2xl px-6 py-5">
          {/* Initializing overlay */}
          {isInitializing && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 px-5 py-2.5">
              <span className="h-2 w-2 animate-ping rounded-full bg-sky-400" />
              <span className="font-mono text-xs text-sky-400">INITIALIZING TELEMETRY — CONNECTING TO INSTANCES…</span>
            </div>
          )}

          {/* ── Section 1: Telemetry Overview ── */}
          <section className="mb-5">
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

          {/* ── Section 2: Metrics Strip + Topology Mini-Map ── */}
          <section className="mb-5">
            <SectionLabel index="02" title="SYSTEM TOPOLOGY & METRICS" subtitle="Track A (Zervox) to Track B (k3s Cluster) Routing" />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 items-stretch">
              {/* Metrics strip - 7 cols on 1080p */}
              <div className="xl:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
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
          <section className="mb-4">
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
      <footer className="border-t border-[#1e3a5f] py-3 text-center bg-[#020409]">
        <p className="font-mono text-[10px] text-slate-600">
          ZERVOX SRE ENGINE v{activeInstance.status?.version ?? '—'} · AUTONOMOUS AIR-GAPPED CYBER RESILIENCE ·{' '}
          <span className="text-sky-800">POLL INTERVAL 3s</span>
        </p>
      </footer>
    </div>
  )
}

// ── Local helper components ──────────────────────────────────────────────────

function SectionLabel({ index, title, subtitle }: { index: string; title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="font-mono text-[10px] font-bold text-sky-400/40">{index}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-[#1e3a5f] to-transparent" />
      <div className="text-right">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-slate-300">{title}</p>
        <p className="font-mono text-[9px] text-slate-600">{subtitle}</p>
      </div>
    </div>
  )
}

function MetricTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  const accentMap: Record<string, string> = {
    sky:   'text-sky-400',
    green: 'text-emerald-400',
    amber: 'text-amber-400',
    slate: 'text-slate-300',
  }
  return (
    <Card>
      <CardLabel>{label}</CardLabel>
      <p className={`font-mono text-sm font-bold ${accentMap[accent] ?? 'text-slate-300'}`}>{value}</p>
    </Card>
  )
}
