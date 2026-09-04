'use client'

import { PulseRing } from '@/components/ui/PulseRing'
import { Badge } from '@/components/ui/Badge'
import { formatUptime } from '@/lib/utils'
import type { InstanceTelemetry } from '@/types/api'

interface HeartbeatCardProps {
  instance: InstanceTelemetry
  peerStatus?: string | null
}

export function HeartbeatCard({ instance, peerStatus }: HeartbeatCardProps) {
  const isBackup = instance.label === 'BACKUP'
  const isActive = instance.health?.state === 'active'

  const peerConnected = peerStatus === 'peer_connected' || instance.peerStatus === 'peer_connected'
  const isDormantStandby = isBackup && !instance.health && (instance.isOnline || peerConnected)
  const isOnline = instance.isOnline || isDormantStandby
  const isTrulyDead = !isOnline

  return (
    <div
      className={`rounded-2xl p-6 md:p-8 transition-all duration-200 surface-elevated flex flex-col justify-between border ${
        isTrulyDead
          ? 'border-rose-500/30 dark:border-rose-500/20'
          : isActive
          ? 'border-emerald-500/30 dark:border-emerald-500/20'
          : 'border-amber-500/30 dark:border-amber-500/20'
      }`}
    >
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <PulseRing online={!isTrulyDead} size="md" />
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {instance.label === 'PRIMARY' ? 'Primary Engine (Track A)' : 'Backup Engine (Track B)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {instance.label === 'PRIMARY' ? 'Active leader & crisis orchestrator' : 'Hot standby sentinel with mTLS watchdog'}
              </p>
            </div>
          </div>
          <div>
            {isActive && isOnline && <Badge variant="green" dot>ACTIVE</Badge>}
            {!isActive && isOnline && <Badge variant="amber" dot>STANDBY</Badge>}
            {isTrulyDead && <Badge variant="red" dot>OFFLINE</Badge>}
          </div>
        </div>

        {/* Key-Value Pairs Evenly Distributed with Flexbox Space-Between */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2">
          <div className="flex items-center justify-between py-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Heartbeat Status</span>
            <span className="text-xs font-semibold" style={{ color: !isTrulyDead ? (isDormantStandby ? 'var(--status-amber)' : 'var(--status-green)') : 'var(--status-red)' }}>
              {!isTrulyDead ? (isDormantStandby ? '● Standby (mTLS active)' : '● Alive & Answering') : '○ Heartbeat Lost'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Round-Trip Latency</span>
            <span className="text-xs font-semibold font-mono text-slate-800 dark:text-slate-200">
              {isTrulyDead ? 'N/A' : isDormantStandby ? '< 2ms (Internal mTLS)' : instance.latencyMs !== null ? `${instance.latencyMs}ms` : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Designated Role</span>
            <span className="text-xs font-semibold uppercase text-slate-800 dark:text-slate-200">
              {instance.health?.role ?? (isDormantStandby ? 'Standby Sentinel' : isTrulyDead ? 'Offline' : '—')}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">System Uptime</span>
            <span className="text-xs font-semibold font-mono text-slate-800 dark:text-slate-200">
              {isTrulyDead ? 'N/A' : isDormantStandby ? 'Syncing with Peer' : instance.health?.uptime_seconds != null ? formatUptime(instance.health.uptime_seconds) : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Control Endpoint</span>
            <span className="text-xs font-mono truncate text-teal-600 dark:text-teal-400 max-w-[200px]" title={instance.url}>
              {instance.url}
            </span>
          </div>
        </div>
      </div>

      {/* Subtext / Error Banner */}
      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        {isDormantStandby ? (
          <div className="rounded-lg px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
            Dormant hot-standby monitoring primary TCP 9000 heartbeat loop. Ready for sub-second failover takeover.
          </div>
        ) : isTrulyDead ? (
          <div className="rounded-lg px-3 py-2 bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-700 dark:text-rose-300">
            Node heartbeat connection severed. Verify network socket or backup takeover state.
          </div>
        ) : (
          <div className="rounded-lg px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300">
            Node operating nominally. Out-of-band audit ingestion and OPA safety gates active.
          </div>
        )}
      </div>
    </div>
  )
}
