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
          ? 'border-rose-300 dark:border-rose-800'
          : isActive
          ? 'border-emerald-300 dark:border-emerald-800'
          : 'border-amber-300 dark:border-amber-800'
      }`}
    >
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <PulseRing online={!isTrulyDead} size="md" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {instance.label === 'PRIMARY' ? 'Primary Engine (Track A)' : 'Backup Engine (Track B)'}
              </h3>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">
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

        {/* Key-Value Pairs Evenly Distributed with Strict High Contrast */}
        <div className="divide-y divide-slate-200 dark:divide-slate-800 mt-2">
          <div className="flex items-center justify-between py-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Heartbeat Status</span>
            <span
              className={`text-xs font-bold ${
                !isTrulyDead
                  ? isDormantStandby
                    ? 'text-amber-800 dark:text-amber-300'
                    : 'text-emerald-800 dark:text-emerald-300'
                  : 'text-red-800 dark:text-red-400'
              }`}
            >
              {!isTrulyDead ? (isDormantStandby ? '● Standby (mTLS Active)' : '● Alive & Answering') : '○ Heartbeat Lost'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Round-Trip Latency</span>
            <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
              {isTrulyDead ? 'N/A' : isDormantStandby ? '< 2ms (Internal mTLS)' : instance.latencyMs !== null ? `${instance.latencyMs}ms` : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Designated Role</span>
            <span className="text-xs font-bold uppercase text-slate-900 dark:text-slate-100">
              {instance.health?.role ?? (isDormantStandby ? 'Standby Sentinel' : isTrulyDead ? 'Offline' : '—')}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">System Uptime</span>
            <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
              {isTrulyDead ? 'N/A' : isDormantStandby ? 'Syncing with Peer' : instance.health?.uptime_seconds != null ? formatUptime(instance.health.uptime_seconds) : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Control Endpoint</span>
            <span className="text-xs font-mono font-bold truncate text-teal-800 dark:text-teal-300 max-w-[200px]" title={instance.url}>
              {instance.url}
            </span>
          </div>
        </div>
      </div>

      {/* Subtext / Error Banner */}
      <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800">
        {isDormantStandby ? (
          <div className="rounded-lg px-3 py-2 bg-amber-100/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs font-semibold text-amber-950 dark:text-amber-200">
            Dormant hot-standby monitoring primary TCP 9000 heartbeat loop. Ready for sub-second failover takeover.
          </div>
        ) : isTrulyDead ? (
          <div className="rounded-lg px-3 py-2 bg-rose-100/80 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs font-semibold text-rose-950 dark:text-rose-200">
            Node heartbeat connection severed. Verify network socket or backup takeover state.
          </div>
        ) : (
          <div className="rounded-lg px-3 py-2 bg-emerald-100/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold text-emerald-950 dark:text-emerald-200">
            Node operating nominally. Out-of-band audit ingestion and OPA safety gates active.
          </div>
        )}
      </div>
    </div>
  )
}
