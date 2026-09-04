'use client'

import Link from 'next/link'
import { useTelemetry } from '@/context/TelemetryContext'
import { HeartbeatCard } from '@/components/dashboard/HeartbeatCard'
import { EngineModeCard } from '@/components/dashboard/EngineModeCard'
import { TopologyMiniMap } from '@/components/dashboard/TopologyMiniMap'
import { Card, CardLabel } from '@/components/ui/Card'
import { formatUptime } from '@/lib/utils'

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            System Overview & Cluster Telemetry
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Real-time multi-node health, mutual TLS heartbeat tunnel (TCP 9000), and cluster failover sentinel.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/chaos"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800/60 hover:bg-teal-100/60 dark:hover:bg-teal-900/40 transition-all cursor-pointer shadow-sm"
          >
            <span>⚡</span>
            <span>Chaos Sandbox</span>
          </Link>
          <Link
            href="/incidents"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all cursor-pointer shadow-sm"
          >
            <span>🚨</span>
            <span>Incidents ({incidents.length})</span>
          </Link>
        </div>
      </div>

      {/* ── ROW 1: PRIMARY, BACKUP & ENGINE SENTINELS ──────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Active Nodes & Dual-Engine Watchdog
          </h2>
          <span className="text-[11px] text-slate-600 dark:text-slate-400">
            Zero-single-point-of-failure topology
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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

      {/* ── ROW 2: FULL-WIDTH TOPOLOGY MINI-MAP ───────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            High-Availability Network Graph
          </h2>
          <span className="text-[11px] text-slate-600 dark:text-slate-400">
            Autonomous failover routing (Track A → Track B)
          </span>
        </div>

        {/* Full-Width Prominent Container */}
        <div className="w-full">
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
      </section>

      {/* ── ROW 3: CLEAN KPI METRICS MATRIX ────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Cluster Telemetry Key Performance Indicators
          </h2>
          <span className="text-[11px] text-slate-600 dark:text-slate-400">
            8 live health checkpoints
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: 'Active Commander',
              value: activeInstance.health?.role?.toUpperCase() ?? '—',
              sub: 'Designated leader',
              color: 'var(--accent)',
            },
            {
              label: 'Cluster State',
              value: activeInstance.health?.state?.toUpperCase() ?? '—',
              sub: 'Operational status',
              color:
                activeInstance.health?.state === 'active'
                  ? 'var(--status-green)'
                  : 'var(--status-amber)',
            },
            {
              label: 'Reasoning Mode',
              value:
                engineMode === 'ai'
                  ? 'LLM / AI'
                  : engineMode === 'fallback'
                  ? 'FALLBACK'
                  : '—',
              sub: engineMode === 'ai' ? 'Cloud model' : 'Deterministic rules',
              color: engineMode === 'ai' ? 'var(--accent)' : 'var(--status-amber)',
            },
            {
              label: 'Hardware Interlock',
              value: hardwareStatus?.includes('ARMED')
                ? 'RISC-V ARMED'
                : 'STANDALONE',
              sub: 'Microcontroller breaker',
              color: hardwareStatus?.includes('ARMED')
                ? '#7e22ce'
                : 'var(--text-secondary)',
            },
            {
              label: 'Leader Uptime',
              value:
                uptimeSeconds != null ? formatUptime(uptimeSeconds) : '—',
              sub: 'Continuous runtime',
              color: 'var(--text-primary)',
            },
            {
              label: 'Total Incidents',
              value: totalIncidents.toLocaleString(),
              sub: 'Persisted in WAL',
              color: 'var(--accent)',
            },
            {
              label: 'OPA Safety Gate',
              value:
                opaStatus === 'reachable' ? 'ENFORCING' : 'STANDBY',
              sub: 'Zero-trust policies',
              color:
                opaStatus === 'reachable'
                  ? 'var(--status-green)'
                  : 'var(--status-amber)',
            },
            {
              label: 'K8s Cluster',
              value: k8sStatus ? k8sStatus.toUpperCase() : 'STANDBY',
              sub: 'Remediation executor',
              color:
                k8sStatus === 'connected'
                  ? 'var(--status-green)'
                  : 'var(--status-amber)',
            },
          ].map(({ label, value, sub, color }) => (
            <Card
              key={label}
              className="p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150"
            >
              <div>
                <CardLabel>{label}</CardLabel>
                <p
                  className="font-mono text-base font-bold tracking-tight mt-1"
                  style={{ color }}
                >
                  {value}
                </p>
              </div>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-2 block">
                {sub}
              </span>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
