'use client'

import { PulseRing } from '@/components/ui/PulseRing'
import { Badge } from '@/components/ui/Badge'
import { Card, CardLabel } from '@/components/ui/Card'
import { formatUptime } from '@/lib/utils'
import type { InstanceTelemetry } from '@/types/api'

interface HeartbeatCardProps {
  instance: InstanceTelemetry
  peerStatus?: string | null
}

export function HeartbeatCard({ instance, peerStatus }: HeartbeatCardProps) {
  const isBackup = instance.label === 'BACKUP'
  const isActive = instance.health?.state === 'active'

  // Derive whether backup is in connected dormant standby mode
  const peerConnected = peerStatus === 'peer_connected' || instance.peerStatus === 'peer_connected'
  const isDormantStandby = isBackup && !instance.health && (instance.isOnline || peerConnected)
  const isOnline = instance.isOnline || isDormantStandby
  const isTrulyDead = !isOnline

  // Derive accent border/glow for this card
  const stateStyle = isTrulyDead
    ? { borderColor: 'var(--status-red-bdr)',   shadow: '0 0 24px var(--status-red-bg)' }
    : isActive
    ? { borderColor: 'var(--status-green-bdr)', shadow: '0 0 24px var(--status-green-bg)' }
    : { borderColor: 'var(--status-amber-bdr)', shadow: '0 0 24px var(--status-amber-bg)' }

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-300 surface"
      style={{
        borderColor: stateStyle.borderColor,
        boxShadow: stateStyle.shadow,
      }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <PulseRing online={!isTrulyDead} size="md" />
          <span className="font-mono text-xs font-bold tracking-widest" style={{ color: 'var(--text-primary)' }}>
            {instance.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && isOnline && <Badge variant="sky" dot>ACTIVE</Badge>}
          {!isActive && isOnline && isDormantStandby && <Badge variant="amber" dot>STANDBY</Badge>}
          {!isActive && isOnline && !isDormantStandby && <Badge variant="amber" dot>STANDBY</Badge>}
          {isTrulyDead && <Badge variant="red" dot>OFFLINE</Badge>}
        </div>
      </div>

      {/* Divider */}
      <div className="mb-4 hr-gradient" />

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <CardLabel>Heartbeat TCP</CardLabel>
          <p className="font-mono text-sm font-semibold" style={{ color: !isTrulyDead ? (isDormantStandby ? 'var(--status-amber)' : 'var(--status-green)') : 'var(--status-red)' }}>
            {!isTrulyDead ? (isDormantStandby ? '● STANDBY (mTLS)' : '● ALIVE') : '○ DEAD'}
          </p>
        </div>
        <div>
          <CardLabel>Latency</CardLabel>
          <p className="font-mono text-sm font-semibold" style={{ color: !isTrulyDead ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {isTrulyDead ? 'N/A' : isDormantStandby ? '< 2ms (mTLS)' : instance.latencyMs !== null ? `${instance.latencyMs}ms` : '—'}
          </p>
        </div>
        <div>
          <CardLabel>Role</CardLabel>
          <p className="font-mono text-sm font-semibold uppercase" style={{ color: 'var(--text-primary)' }}>
            {instance.health?.role ?? (isDormantStandby ? 'STANDBY' : isTrulyDead ? 'OFFLINE' : '—')}
          </p>
        </div>
        <div>
          <CardLabel>Uptime</CardLabel>
          <p className="font-mono text-sm font-semibold" style={{ color: !isTrulyDead && instance.health?.uptime_seconds != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {isTrulyDead ? 'N/A' : isDormantStandby ? 'STANDBY (PEER)' : instance.health?.uptime_seconds != null ? formatUptime(instance.health.uptime_seconds) : '—'}
          </p>
        </div>
        <div className="col-span-2 my-2 py-1">
          <CardLabel>Endpoint</CardLabel>
          <p className="truncate font-mono text-xs py-1" style={{ color: 'var(--accent)' }}>{instance.url}</p>
        </div>
      </div>

      {/* Subtext display: Conditionally hide or replace 'mTLS monitor active' when dead */}
      {isDormantStandby ? (
        <div
          className="mt-3 rounded-xl px-3 py-2"
          style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)' }}
        >
          <p className="truncate font-mono text-[10px] text-amber-300">
            Dormant standby (mTLS monitor active)
          </p>
        </div>
      ) : instance.error ? (
        <div
          className="mt-3 rounded-xl px-3 py-2"
          style={{ border: '1px solid var(--status-red-bdr)', background: 'var(--status-red-bg)' }}
        >
          <p className="truncate font-mono text-[10px]" style={{ color: 'var(--status-red)' }}>
            {isTrulyDead && instance.error.includes('mTLS monitor active')
              ? 'Heartbeat severed / node unreachable'
              : instance.error}
          </p>
        </div>
      ) : null}

      {/* Last polled */}
      {instance.lastUpdated && (
        <p className="mt-3 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
          LAST POLLED {instance.lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}
