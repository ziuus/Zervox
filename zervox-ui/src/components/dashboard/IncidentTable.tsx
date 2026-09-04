'use client'

import { Badge } from '@/components/ui/Badge'
import { getStatusColors, getModeColors, formatTimestamp, truncate } from '@/lib/utils'
import type { IncidentRecord } from '@/types/api'

interface IncidentTableProps {
  incidents: IncidentRecord[]
  isLoading: boolean
}

const ACTION_LABELS: Record<string, string> = {
  restart_pod: 'Restart Pod',
  scale: 'Scale Deployment',
  cordon: 'Cordon Node',
  no_action: 'No Action',
  dangerous_action: '⚠ Dangerous Action',
}

function StatusBadge({ status }: { status: string }) {
  const colors = getStatusColors(status as never)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${colors.text} ${colors.bg} ${colors.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function ModeBadge({ mode }: { mode: string }) {
  const colors = getModeColors(mode)
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${colors.text} ${colors.bg} ${colors.border}`}
    >
      {mode}
    </span>
  )
}

export function IncidentTable({ incidents, isLoading }: IncidentTableProps) {
  return (
    <div className="rounded-xl border border-[#1e3a5f] bg-[#0b1628] overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center justify-between border-b border-[#1e3a5f] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-slate-200">
            Remediation Timeline
          </h2>
          <span className="rounded border border-[#1e3a5f] bg-[#060d1a] px-2 py-0.5 font-mono text-[10px] text-slate-500">
            LIVE · WAL
          </span>
        </div>
        {isLoading && (
          <span className="animate-pulse font-mono text-[10px] text-sky-400/60">POLLING…</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#060d1a]">
              {['Timestamp', 'Alert', 'Mode', 'Action', 'Target Resource', 'OPA Gate', 'Status'].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {incidents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="font-mono text-2xl">⚡</div>
                    <p className="font-mono text-sm text-slate-500">NO INCIDENTS RECORDED</p>
                    <p className="font-mono text-xs text-slate-700">STANDING BY · WATCHDOG ACTIVE</p>
                  </div>
                </td>
              </tr>
            ) : (
              incidents.map((inc, idx) => {
                const { date, time } = formatTimestamp(inc.created_at)
                return (
                  <tr
                    key={inc.id}
                    className={`border-b border-[#1e3a5f]/50 transition-colors hover:bg-sky-400/[0.03] ${
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-[#060d1a]/40'
                    }`}
                  >
                    {/* Timestamp */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-mono text-xs text-slate-300">{time}</p>
                      <p className="font-mono text-[10px] text-slate-600">{date}</p>
                    </td>

                    {/* Alert Name */}
                    <td className="px-4 py-3">
                      <div className="max-w-[160px]">
                        <p className="truncate font-mono text-xs font-semibold text-slate-200" title={inc.alert_name}>
                          {inc.alert_name}
                        </p>
                        <Badge
                          variant={inc.severity === 'critical' ? 'red' : inc.severity === 'warning' ? 'amber' : 'slate'}
                          size="sm"
                        >
                          {inc.severity}
                        </Badge>
                      </div>
                    </td>

                    {/* Mode */}
                    <td className="px-4 py-3">
                      <ModeBadge mode={inc.mode} />
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap font-mono text-xs text-slate-300">
                        {ACTION_LABELS[inc.action_type] ?? inc.action_type}
                      </p>
                    </td>

                    {/* Target Resource */}
                    <td className="px-4 py-3">
                      <p className="max-w-[180px] truncate font-mono text-xs text-sky-400/80" title={inc.target_resource}>
                        {truncate(inc.target_resource, 36)}
                      </p>
                    </td>

                    {/* OPA Gate */}
                    <td className="px-4 py-3">
                      {inc.policy_allowed ? (
                        <Badge variant="green" dot>ALLOWED</Badge>
                      ) : (
                        <div>
                          <Badge variant="red" dot>BLOCKED</Badge>
                          {inc.policy_violations && (
                            <p
                              className="mt-1 max-w-[180px] truncate font-mono text-[9px] text-red-400/70"
                              title={inc.policy_violations}
                            >
                              {truncate(inc.policy_violations, 40)}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Execution Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={inc.execution_status} />
                      {inc.execution_error && (
                        <p
                          className="mt-1 max-w-[160px] truncate font-mono text-[9px] text-orange-400/60"
                          title={inc.execution_error}
                        >
                          {truncate(inc.execution_error, 30)}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
