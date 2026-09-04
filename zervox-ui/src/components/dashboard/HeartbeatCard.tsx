'use client'

import { PulseRing } from '@/components/ui/PulseRing'
import { Badge } from '@/components/ui/Badge'
import { Card, CardLabel } from '@/components/ui/Card'
import { formatUptime } from '@/lib/utils'
import type { InstanceTelemetry } from '@/types/api'

interface HeartbeatCardProps {
  instance: InstanceTelemetry
}

export function HeartbeatCard({ instance }: HeartbeatCardProps) {
  const isActive = instance.health?.state === 'active'
  const isOnline = instance.isOnline

  // Derive accent border/glow for this card
  const stateStyle = !isOnline
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
          <PulseRing online={isOnline} size="md" />
          <span className="font-mono text-xs font-bold tracking-widest" style={{ color: 'var(--text-primary)' }}>
            {instance.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && isOnline && <Badge variant="sky" dot>ACTIVE</Badge>}
          {!isActive && isOnline && <Badge variant="amber" dot>STANDBY</Badge>}
          {!isOnline && <Badge variant="red" dot>OFFLINE</Badge>}
        </div>
      </div>

      {/* Divider */}
      <div className="mb-4 hr-gradient" />

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <CardLabel>Heartbeat TCP</CardLabel>
          <p className="font-mono text-sm font-semibold" style={{ color: isOnline ? 'var(--status-green)' : 'var(--status-red)' }}>
            {isOnline ? '● ALIVE' : '○ DEAD'}
          </p>
        </div>
        <div>
          <CardLabel>Latency</CardLabel>
          <p className="font-mono text-sm font-semibold" style={{ color: isOnline && instance.latencyMs !== null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {!isOnline ? 'N/A' : instance.latencyMs !== null ? `${instance.latencyMs}ms` : '—'}
          </p>
        </div>
        <div>
          <CardLabel>Role</CardLabel>
          <p className="font-mono text-sm font-semibold uppercase" style={{ color: 'var(--text-primary)' }}>
            {instance.health?.role ?? (!isOnline ? 'OFFLINE' : '—')}
          </p>
        </div>
        <div>
          <CardLabel>Uptime</CardLabel>
          <p className="font-mono text-sm font-semibold" style={{ color: isOnline && instance.health?.uptime_seconds != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {!isOnline ? 'N/A' : instance.health?.uptime_seconds != null ? formatUptime(instance.health.uptime_seconds) : '—'}
          </p>
        </div>
        <div className="col-span-2 my-2 py-1">
          <CardLabel>Endpoint</CardLabel>
          <p className="truncate font-mono text-xs py-1" style={{ color: 'var(--accent)' }}>{instance.url}</p>
        </div>
      </div>

      {/* Error state */}
      {instance.error && (
        <div
          className="mt-3 rounded-xl px-3 py-2"
          style={{ border: '1px solid var(--status-red-bdr)', background: 'var(--status-red-bg)' }}
        >
          <p className="truncate font-mono text-[10px]" style={{ color: 'var(--status-red)' }}>
            {instance.error}
          </p>
        </div>
      )}

      {/* Last polled */}
      {instance.lastUpdated && (
        <p className="mt-3 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
          LAST POLLED {instance.lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}
