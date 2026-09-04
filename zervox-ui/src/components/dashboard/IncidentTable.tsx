'use client'

import { useState, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/Badge'
import { getStatusColors, getModeColors, formatTimestamp, truncate } from '@/lib/utils'
import type { IncidentRecord } from '@/types/api'

interface IncidentTableProps {
  incidents: IncidentRecord[]
  isLoading: boolean
  isEvaluatingLlm?: boolean
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

function TypingIndicator({ label = 'Awaiting LLM Root Cause Analysis (10s timeout)' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs text-sky-400">
      <span className="font-semibold tracking-wide">{label}</span>
      <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded bg-sky-500/10 border border-sky-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-typing-dot-1" />
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-typing-dot-2" />
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-typing-dot-3" />
      </span>
    </div>
  )
}

export function IncidentTable({ incidents, isLoading, isEvaluatingLlm }: IncidentTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <div className="rounded-xl border border-[#1e3a5f] bg-[#0b1628] overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center justify-between border-b border-[#1e3a5f] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-slate-200">
            Remediation Timeline
          </h2>
          <span className="rounded border border-[#1e3a5f] bg-[#060d1a] px-2 py-0.5 font-mono text-[10px] text-slate-500">
            LIVE · WAL
          </span>
        </div>
        <div className="flex items-center gap-4">
          {isEvaluatingLlm && (
            <TypingIndicator label="LLM RCA IN PROGRESS" />
          )}
          {isLoading && (
            <span className="animate-pulse font-mono text-[10px] text-sky-400/60">POLLING WAL…</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#060d1a]">
              {['Timestamp', 'Alert', 'Mode', 'Action', 'Target Resource', 'OPA Gate', 'Status', 'Details'].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e3a5f]/40">
            {incidents.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="font-mono text-2xl">⚡</div>
                    <p className="font-mono text-sm text-slate-400">NO INCIDENTS RECORDED</p>
                    <p className="font-mono text-xs text-slate-600">STANDING BY · WATCHDOG ACTIVE</p>
                  </div>
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {incidents.map((inc, idx) => {
                  const { date, time } = formatTimestamp(inc.created_at)
                  const isExpanded = expandedId === inc.id
                  const isEvaluating = inc.execution_status === 'evaluating_policy' || inc.execution_status === 'pending'

                  return (
                    <Fragment key={inc.id}>
                      {/* Main Animated Row */}
                      <motion.tr
                        layout
                        initial={{ opacity: 0, y: -20, backgroundColor: 'rgba(56, 189, 248, 0.15)' }}
                        animate={{ opacity: 1, y: 0, backgroundColor: idx % 2 === 0 ? 'rgba(0,0,0,0)' : 'rgba(6, 13, 26, 0.4)' }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        onClick={() => toggleExpand(inc.id)}
                        className={`cursor-pointer transition-colors hover:bg-sky-400/[0.05] ${
                          isExpanded ? 'bg-sky-950/20' : ''
                        }`}
                      >
                        {/* Timestamp */}
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <p className="font-mono text-xs text-slate-300 font-semibold">{time}</p>
                          <p className="font-mono text-[10px] text-slate-500">{date}</p>
                        </td>

                        {/* Alert Name */}
                        <td className="px-4 py-2.5">
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
                        <td className="px-4 py-2.5">
                          <ModeBadge mode={inc.mode} />
                        </td>

                        {/* Action */}
                        <td className="px-4 py-2.5">
                          <p className="whitespace-nowrap font-mono text-xs text-slate-300 font-medium">
                            {ACTION_LABELS[inc.action_type] ?? inc.action_type}
                          </p>
                        </td>

                        {/* Target Resource */}
                        <td className="px-4 py-2.5">
                          <p className="max-w-[180px] truncate font-mono text-xs text-sky-400/90 font-medium" title={inc.target_resource}>
                            {truncate(inc.target_resource, 32)}
                          </p>
                        </td>

                        {/* OPA Gate */}
                        <td className="px-4 py-2.5">
                          {inc.policy_allowed ? (
                            <Badge variant="green" dot>ALLOWED</Badge>
                          ) : (
                            <div>
                              <Badge variant="red" dot>BLOCKED</Badge>
                              {inc.policy_violations && (
                                <p
                                  className="mt-0.5 max-w-[170px] truncate font-mono text-[9px] text-red-400/80"
                                  title={inc.policy_violations}
                                >
                                  {truncate(inc.policy_violations, 30)}
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Execution Status */}
                        <td className="px-4 py-2.5">
                          {isEvaluating ? (
                            <div className="flex items-center gap-1.5">
                              <StatusBadge status={inc.execution_status} />
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                            </div>
                          ) : (
                            <StatusBadge status={inc.execution_status} />
                          )}
                          {inc.execution_error && (
                            <p
                              className="mt-0.5 max-w-[150px] truncate font-mono text-[9px] text-orange-400/80"
                              title={inc.execution_error}
                            >
                              {truncate(inc.execution_error, 24)}
                            </p>
                          )}
                        </td>

                        {/* Expansion toggle */}
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            className="font-mono text-[11px] text-slate-400 hover:text-sky-400 transition-colors"
                          >
                            {isExpanded ? '▲ HIDE' : '▼ LOGS'}
                          </button>
                        </td>
                      </motion.tr>

                      {/* Expandable Terminal Console Panel */}
                      {isExpanded && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-[#030712] border-b border-[#1e3a5f]"
                        >
                          <td colSpan={8} className="p-4">
                            <div className="rounded-lg border border-[#1e3a5f] bg-[#050b14] p-4 shadow-inner space-y-4">
                              <div className="flex items-center justify-between border-b border-[#1e3a5f]/80 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/80 inline-block" />
                                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80 inline-block" />
                                  <span className="h-2.5 w-2.5 rounded-full bg-green-500/80 inline-block" />
                                  <span className="ml-2 font-mono text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                    TELEMETRY TERMINAL INSPECTOR // INCIDENT {inc.id.slice(0, 8)}
                                  </span>
                                </div>
                                <span className="font-mono text-[10px] text-slate-500">
                                  STRICT MONOSPACE · WAL ENTRY
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Raw LLM RCA / Root Cause */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-sky-400">
                                      LLM Root Cause Analysis
                                    </span>
                                    {inc.mode === 'ai' && (
                                      <span className="font-mono text-[9px] text-sky-300/60">OPENAI / LOCAL</span>
                                    )}
                                  </div>
                                  <div className="rounded border border-sky-500/20 bg-[#02050b] p-2.5 min-h-[76px]">
                                    {inc.root_cause ? (
                                      <p className="font-mono text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap break-words selection:bg-sky-500/40">
                                        {inc.root_cause}
                                      </p>
                                    ) : isEvaluating ? (
                                      <TypingIndicator label="Awaiting LLM response..." />
                                    ) : (
                                      <p className="font-mono text-[11px] text-slate-600 italic">No root cause reported.</p>
                                    )}
                                  </div>
                                </div>

                                {/* OPA Policy Evaluation Output */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                      OPA Security Policy Output
                                    </span>
                                    <span className={`font-mono text-[9px] font-bold ${inc.policy_allowed ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {inc.policy_allowed ? 'GATE: ALLOW' : 'GATE: REJECT'}
                                    </span>
                                  </div>
                                  <div className="rounded border border-amber-500/20 bg-[#02050b] p-2.5 min-h-[76px]">
                                    <p className="font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words selection:bg-amber-500/40">
                                      {inc.policy_violations
                                        ? `[OPA POLICY VIOLATION] ${inc.policy_violations}`
                                        : inc.policy_allowed
                                          ? `[OPA GATE VERIFIED] Action '${inc.action_type}' permitted on target '${inc.target_resource}'.`
                                          : '[OPA] Evaluating security boundary...'}
                                    </p>
                                  </div>
                                </div>

                                {/* Raw K8s Execution Output / Logs */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                      Kubernetes Executor Log
                                    </span>
                                    <span className="font-mono text-[9px] text-emerald-300/60">k3s API</span>
                                  </div>
                                  <div className="rounded border border-emerald-500/20 bg-[#02050b] p-2.5 min-h-[76px]">
                                    <p className="font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words selection:bg-emerald-500/40">
                                      {inc.execution_error
                                        ? `[STDERR] execution error: ${inc.execution_error}`
                                        : `[K8S STDOUT] status=${inc.execution_status} target=${inc.target_resource} action=${inc.action_type}`}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </Fragment>
                  )
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
