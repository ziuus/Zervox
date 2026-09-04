'use client'

import { Card, CardLabel } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getEngineModeLabel } from '@/lib/utils'
import type { EngineMode } from '@/types/api'

export interface EngineModeCardProps {
  mode: EngineMode | null
  opaStatus: string | null
  k8sStatus: string | null
  peerStatus: string | null
  totalIncidents: number
  hasOpaBlock?: boolean
}

export function EngineModeCard({
  mode,
  opaStatus,
  k8sStatus,
  peerStatus,
  totalIncidents,
  hasOpaBlock = false,
}: EngineModeCardProps) {
  const isAI      = mode === 'ai'
  const isFallback = mode === 'fallback'
  const opaOnline  = opaStatus === 'reachable'
  const k8sConn    = k8sStatus === 'connected'
  const peerConn   = peerStatus === 'peer_connected'

  const accentBorder = hasOpaBlock
    ? 'var(--status-red-bdr)'
    : isFallback
    ? 'var(--status-amber-bdr)'
    : isAI
    ? 'var(--accent-border)'
    : 'var(--border-subtle)'

  const accentShadow = hasOpaBlock
    ? '0 0 24px var(--status-red-bg)'
    : isFallback
    ? '0 0 24px var(--status-amber-bg)'
    : isAI
    ? '0 0 24px var(--glow-sky)'
    : 'none'

  return (
    <div
      className="rounded-2xl p-5 surface transition-all duration-300"
      style={{ borderColor: accentBorder, boxShadow: accentShadow }}
    >
      {/* Engine Mode Banner */}
      <div className="mb-5 flex items-center justify-between">
        <CardLabel className="mb-0">Engine Mode</CardLabel>
        {mode ? (
          <Badge variant={isAI ? 'sky' : 'amber'} size="md" dot>
            {getEngineModeLabel(mode)}
          </Badge>
        ) : (
          <Badge variant="slate" size="md">UNKNOWN</Badge>
        )}
      </div>

      {/* Mode description */}
      <div
        className="mb-5 rounded-xl px-4 py-3"
        style={{
          border: `1px solid ${isAI ? 'var(--accent-border)' : isFallback ? 'var(--status-amber-bdr)' : 'var(--border-subtle)'}`,
          background: isAI ? 'var(--accent-subtle)' : isFallback ? 'var(--status-amber-bg)' : 'var(--bg-sunken)',
        }}
      >
        <p className="font-mono text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {isAI
            ? 'LLM-driven root cause analysis active. Decisions routed via external model with automatic fallback on timeout.'
            : isFallback
            ? 'Local deterministic rules active. Air-gapped mode — no external LLM dependency. Sub-100ms decision latency.'
            : 'Engine status initializing…'}
        </p>
      </div>

      {/* Divider */}
      <div className="mb-4 hr-gradient" />

      {/* Sub-system grid */}
      <div className="grid grid-cols-2 gap-4">
        {[
          {
            label: 'OPA Security Gate',
            dot: opaOnline ? 'var(--status-green)' : 'var(--status-amber)',
            valueColor: opaOnline ? 'var(--status-green)' : 'var(--status-amber)',
            value: opaOnline ? 'EXTERNAL' : 'EMBEDDED',
            sub: opaStatus ?? '—',
          },
          {
            label: 'Kubernetes Executor',
            dot: k8sConn ? 'var(--status-green)' : 'var(--status-amber)',
            valueColor: k8sConn ? 'var(--status-green)' : 'var(--status-amber)',
            value: k8sConn ? 'LIVE' : 'DRY RUN',
            sub: k8sStatus ?? '—',
          },
          {
            label: 'HA Peer Link',
            dot: peerConn ? 'var(--status-green)' : 'var(--status-red)',
            valueColor: peerConn ? 'var(--status-green)' : 'var(--status-red)',
            value: peerStatus?.replace('_', ' ').toUpperCase() ?? '—',
            sub: null,
          },
        ].map(({ label, dot, valueColor, value, sub }) => (
          <div key={label}>
            <CardLabel>{label}</CardLabel>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
              <span className="font-mono text-xs font-semibold" style={{ color: valueColor }}>
                {value}
              </span>
            </div>
            {sub && (
              <p className="mt-0.5 font-mono text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                {sub}
              </p>
            )}
          </div>
        ))}
        <div>
          <CardLabel>Total Incidents</CardLabel>
          <p className="font-mono text-lg font-bold" style={{ color: 'var(--accent)' }}>
            {totalIncidents.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
