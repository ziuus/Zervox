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
  const isAI = mode === 'ai'
  const isFallback = mode === 'fallback'

  const opaOnline = opaStatus === 'reachable'
  const k8sConnected = k8sStatus === 'connected'
  const peerConnected = peerStatus === 'peer_connected'

  const stateBorderClass = hasOpaBlock
    ? 'border-rose-500/40 bg-gradient-to-b from-rose-950/25 via-transparent to-transparent shadow-[0_0_25px_rgba(244,63,94,0.12)]'
    : isFallback
      ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/20 via-transparent to-transparent shadow-[0_0_25px_rgba(245,158,11,0.12)]'
      : isAI
        ? 'border-sky-500/40 bg-gradient-to-b from-sky-950/25 via-transparent to-transparent shadow-[0_0_25px_rgba(56,189,248,0.12)]'
        : 'border-white/[0.08]'

  return (
    <Card glow className={stateBorderClass}>
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
      <div className={`mb-5 rounded-lg border px-4 py-3 ${
        isAI
          ? 'border-sky-400/20 bg-sky-400/5'
          : isFallback
            ? 'border-amber-400/20 bg-amber-400/5'
            : 'border-slate-500/20 bg-slate-500/5'
      }`}>
        <p className="font-mono text-xs leading-relaxed text-slate-400">
          {isAI
            ? 'LLM-driven root cause analysis active. Decisions routed via external model with automatic fallback on timeout.'
            : isFallback
              ? 'Local deterministic rules active. Air-gapped mode — no external LLM dependency. Sub-100ms decision latency.'
              : 'Engine status initializing…'}
        </p>
      </div>

      {/* Divider */}
      <div className="mb-4 h-px bg-[#1e3a5f]" />

      {/* Sub-system grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <CardLabel>OPA Security Gate</CardLabel>
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${opaOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`font-mono text-xs font-semibold ${opaOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
              {opaOnline ? 'EXTERNAL' : 'EMBEDDED'}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-slate-600 truncate">{opaStatus ?? '—'}</p>
        </div>
        <div>
          <CardLabel>Kubernetes Executor</CardLabel>
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${k8sConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`font-mono text-xs font-semibold ${k8sConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
              {k8sConnected ? 'LIVE' : 'DRY RUN'}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-slate-600 truncate">{k8sStatus ?? '—'}</p>
        </div>
        <div>
          <CardLabel>HA Peer Link</CardLabel>
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${peerConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className={`font-mono text-xs font-semibold ${peerConnected ? 'text-emerald-400' : 'text-red-400'}`}>
              {peerStatus?.replace('_', ' ').toUpperCase() ?? '—'}
            </span>
          </div>
        </div>
        <div>
          <CardLabel>Total Incidents</CardLabel>
          <p className="font-mono text-lg font-bold text-sky-400">{totalIncidents.toLocaleString()}</p>
        </div>
      </div>
    </Card>
  )
}
