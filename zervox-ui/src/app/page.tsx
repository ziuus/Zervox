'use client'

import Link from 'next/link'
import { useTelemetry } from '@/context/TelemetryContext'
import { HeartbeatCard } from '@/components/dashboard/HeartbeatCard'
import { EngineModeCard } from '@/components/dashboard/EngineModeCard'
import { TopologyMiniMap } from '@/components/dashboard/TopologyMiniMap'
import { Card, CardLabel } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatUptime } from '@/lib/utils'

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

export default function OverviewPage() {
  const {
    primary,
    backup,
    activeInstance,
    engineMode,
    opaStatus,
    k8sStatus,
    peerStatus,
    totalIncidents,
    uptimeSeconds,
    incidents,
  } = useTelemetry()

  const hasOpaBlock = incidents.some((inc) => !inc.policy_allowed)
  const hardwareStatus = activeInstance.status?.hardware_breaker_status

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl text-base" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)' }}>
              🌐
            </span>
            <h1 className="font-mono text-lg font-black uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              Command Center // Telemetry & HA Topology
            </h1>
          </div>
          <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Real-time multi-node health, mTLS heartbeat tunnel (TCP 9000), and cluster failover sentinel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/chaos"
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer"
            style={{
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              color: 'var(--text-primary)',
            }}
          >
            <span>⚡</span>
            <span>Chaos Sandbox</span>
          </Link>
          <Link
            href="/incidents"
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer"
            style={{
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-secondary)',
            }}
          >
            <span>🚨</span>
            <span>View {incidents.length} Incidents</span>
          </Link>
        </div>
      </div>

      {/* ── SECTION 1: INSTANCE TELEMETRY NODES ─────────────────── */}
      <section>
        <SectionLabel
          title="INSTANCE TELEMETRY"
          subtitle="mTLS Heartbeat · TCP 9000 · High-Availability Watchdog"
        />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <HeartbeatCard instance={primary} peerStatus={peerStatus} />
          <HeartbeatCard instance={backup} peerStatus={peerStatus} />
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

      {/* ── SECTION 2: SPLIT-BRAIN SENTINEL & CLUSTER METRICS ──── */}
      <section>
        <SectionLabel
          title="SPLIT-BRAIN SENTINEL & CLUSTER METRICS"
          subtitle="Autonomous Failover Routing Track A → Track B"
        />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 items-stretch">
          {/* KPI Metrics Matrix */}
          <div className="xl:col-span-7 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {[
              {
                label: 'Active Node',
                value: activeInstance.health?.role?.toUpperCase() ?? '—',
                color: 'var(--accent)',
              },
              {
                label: 'Cluster State',
                value: activeInstance.health?.state?.toUpperCase() ?? '—',
                color:
                  activeInstance.health?.state === 'active'
                    ? 'var(--status-green)'
                    : 'var(--status-amber)',
              },
              {
                label: 'Engine Mode',
                value:
                  engineMode === 'ai'
                    ? 'LLM / AI'
                    : engineMode === 'fallback'
                    ? 'FALLBACK'
                    : '—',
                color: engineMode === 'ai' ? 'var(--accent)' : 'var(--status-amber)',
              },
              {
                label: 'HW Dual-Key',
                value: hardwareStatus?.includes('ARMED')
                  ? 'RISC-V ARMED'
                  : 'STANDALONE',
                color: hardwareStatus?.includes('ARMED')
                  ? '#a78bfa'
                  : 'var(--text-secondary)',
              },
              {
                label: 'Uptime',
                value:
                  uptimeSeconds != null ? formatUptime(uptimeSeconds) : '—',
                color: 'var(--text-primary)',
              },
              {
                label: 'Total Incidents',
                value: totalIncidents.toLocaleString(),
                color: 'var(--accent)',
              },
              {
                label: 'OPA Gate',
                value:
                  opaStatus === 'reachable' ? 'EXTERNAL' : 'EMBEDDED',
                color:
                  opaStatus === 'reachable'
                    ? 'var(--status-green)'
                    : 'var(--status-amber)',
              },
              {
                label: 'K8s Status',
                value: k8sStatus ? k8sStatus.toUpperCase() : 'STANDBY',
                color:
                  k8sStatus === 'connected'
                    ? 'var(--status-green)'
                    : 'var(--status-amber)',
              },
            ].map(({ label, value, color }) => (
              <Card
                key={label}
                className="p-4.5 hover:-translate-y-0.5 transition-transform duration-200"
              >
                <CardLabel>{label}</CardLabel>
                <p
                  className="font-mono text-sm font-bold tracking-wider"
                  style={{ color }}
                >
                  {value}
                </p>
              </Card>
            ))}
          </div>

          {/* Split-Brain Sentinel Interactive Map */}
          <div className="xl:col-span-5 flex flex-col">
            <TopologyMiniMap
              primaryOnline={primary.isOnline}
              backupOnline={backup.isOnline}
              activeRole={
                activeInstance.health?.role ??
                (primary.isOnline ? 'primary' : 'backup')
              }
              peerStatus={peerStatus}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
