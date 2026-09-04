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

  const stateBorderClass = !isOnline
    ? 'border-rose-500/40 bg-gradient-to-b from-rose-950/25 via-transparent to-transparent shadow-[0_0_25px_rgba(244,63,94,0.12)]'
    : isActive
      ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-950/25 via-transparent to-transparent shadow-[0_0_25px_rgba(16,185,129,0.12)]'
      : 'border-amber-500/30 bg-gradient-to-b from-amber-950/20 via-transparent to-transparent shadow-[0_0_25px_rgba(245,158,11,0.08)]'

  return (
    <Card
      glow={isOnline && isActive}
      className={stateBorderClass}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <PulseRing online={isOnline} size="md" />
          <span className="font-mono text-xs font-bold tracking-widest text-slate-300">
            {instance.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && isOnline && (
            <Badge variant="sky" dot>ACTIVE</Badge>
          )}
          {!isActive && isOnline && (
            <Badge variant="amber" dot>STANDBY</Badge>
          )}
          {!isOnline && (
            <Badge variant="red" dot>OFFLINE</Badge>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mb-4 h-px bg-[#1e3a5f]" />

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <CardLabel>Heartbeat TCP</CardLabel>
          <p className={`font-mono text-sm font-semibold ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
            {isOnline ? '● ALIVE' : '○ DEAD'}
          </p>
        </div>
        <div>
          <CardLabel>Latency</CardLabel>
          <p className="font-mono text-sm font-semibold text-slate-200">
            {instance.latencyMs !== null ? `${instance.latencyMs}ms` : '—'}
          </p>
        </div>
        <div>
          <CardLabel>Role</CardLabel>
          <p className="font-mono text-sm font-semibold text-slate-200 uppercase">
            {instance.health?.role ?? '—'}
          </p>
        </div>
        <div>
          <CardLabel>Uptime</CardLabel>
          <p className="font-mono text-sm font-semibold text-slate-200">
            {instance.health?.uptime_seconds != null
              ? formatUptime(instance.health.uptime_seconds)
              : '—'}
          </p>
        </div>
        <div className="col-span-2">
          <CardLabel>Endpoint</CardLabel>
          <p className="truncate font-mono text-xs text-sky-400/70">{instance.url}</p>
        </div>
      </div>

      {/* Error state */}
      {instance.error && (
        <div className="mt-3 rounded-md border border-red-400/20 bg-red-400/5 px-3 py-2">
          <p className="truncate font-mono text-[10px] text-red-400">{instance.error}</p>
        </div>
      )}

      {/* Last updated */}
      {instance.lastUpdated && (
        <p className="mt-3 font-mono text-[10px] text-slate-600">
          LAST POLLED {instance.lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </Card>
  )
}
