'use client'

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
  const k8sConn = k8sStatus === 'connected'
  const peerConn = peerStatus === 'peer_connected'

  return (
    <div
      className={`rounded-2xl p-6 md:p-8 transition-all duration-200 surface-elevated flex flex-col justify-between border ${
        hasOpaBlock
          ? 'border-rose-300 dark:border-rose-800'
          : isFallback
          ? 'border-teal-300 dark:border-teal-800'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Autonomous Engine Mode
            </h3>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
              Dual-reasoning pipeline state & safety gate
            </p>
          </div>
          <div>
            {mode ? (
              <Badge variant={isAI ? 'sky' : 'green'} size="md" dot>
                {getEngineModeLabel(mode)}
              </Badge>
            ) : (
              <Badge variant="slate" size="md">UNKNOWN</Badge>
            )}
          </div>
        </div>

        {/* Mode Description Callout */}
        <div
          className="my-4 rounded-xl p-3.5 text-xs leading-relaxed font-medium bg-slate-100 dark:bg-slate-900/70 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200"
        >
          {isAI
            ? 'LLM-driven root cause analysis active. Cloud reasoning pipeline handles complex anomalies with 10s circuit-breaker.'
            : isFallback
            ? 'Local deterministic rules active. Air-gapped mode with sub-second execution and zero external cloud dependency.'
            : 'Engine status initializing…'}
        </div>

        {/* Sub-system Grid */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="rounded-xl p-3 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-200 block mb-1">OPA Security Gate</span>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${opaOnline ? 'bg-emerald-600' : 'bg-amber-600'}`} />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {opaOnline ? 'Enforcing' : 'Standby'}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 block mt-0.5">
              {opaStatus ?? '—'}
            </span>
          </div>

          <div className="rounded-xl p-3 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-200 block mb-1">Cluster Executor</span>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${k8sConn ? 'bg-emerald-600' : 'bg-amber-600'}`} />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {k8sConn ? 'Live K8s' : 'Dry-Run'}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 block mt-0.5">
              {k8sStatus ?? '—'}
            </span>
          </div>

          <div className="rounded-xl p-3 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-200 block mb-1">HA Peer Watchdog</span>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${peerConn ? 'bg-emerald-600' : 'bg-amber-600'}`} />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {peerConn ? 'Connected' : 'Listening'}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 block mt-0.5">
              TCP 9000 Loop
            </span>
          </div>

          <div className="rounded-xl p-3 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-200 block mb-1">Total Incidents</span>
            <span className="text-sm font-bold font-mono text-teal-900 dark:text-teal-300 block">
              {totalIncidents.toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 block mt-0.5">
              SQLite WAL Logged
            </span>
          </div>
        </div>
      </div>

      {/* Footer Subtext */}
      <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Kerala Police Cyberdome Safety Floor: No autonomous action touches live nodes without passing Rego policy validation.
        </p>
      </div>
    </div>
  )
}
