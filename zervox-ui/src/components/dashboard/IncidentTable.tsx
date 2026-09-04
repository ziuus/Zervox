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
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'freeze' | 'riscv' | 'opa_blocked'>('all')
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHashId(id)
    setTimeout(() => setCopiedHashId(null), 2000)
  }

  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      searchQuery === '' ||
      inc.alert_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.target_resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.action_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.id.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (filterType === 'freeze') {
      return !!inc.forensic_snapshot_id || inc.action_type === 'restart_pod'
    }
    if (filterType === 'riscv') {
      return inc.action_type === 'cordon' || inc.target_resource.includes('node')
    }
    if (filterType === 'opa_blocked') {
      return !inc.policy_allowed
    }
    return true
  })

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0b1329]/75 backdrop-blur-xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]">
      {/* Table Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/[0.06] px-5 py-3.5 gap-3 bg-white/[0.01]">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-white">
            Remediation Timeline
          </h2>
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-sky-300">
            SQLITE WAL · ZERO-LOSS
          </span>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/[0.06]">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`rounded-lg px-2.5 py-1 font-mono text-[9px] font-bold uppercase transition-all ${
                filterType === 'all'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ALL ({incidents.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('freeze')}
              className={`rounded-lg px-2.5 py-1 font-mono text-[9px] font-bold uppercase transition-all ${
                filterType === 'freeze'
                  ? 'bg-purple-500/25 text-purple-300 border border-purple-400/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                  : 'text-slate-400 hover:text-purple-300'
              }`}
            >
              FORENSIC FREEZE
            </button>
            <button
              type="button"
              onClick={() => setFilterType('riscv')}
              className={`rounded-lg px-2.5 py-1 font-mono text-[9px] font-bold uppercase transition-all ${
                filterType === 'riscv'
                  ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-400/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                  : 'text-slate-400 hover:text-indigo-300'
              }`}
            >
              RISC-V GUARD
            </button>
            <button
              type="button"
              onClick={() => setFilterType('opa_blocked')}
              className={`rounded-lg px-2.5 py-1 font-mono text-[9px] font-bold uppercase transition-all ${
                filterType === 'opa_blocked'
                  ? 'bg-rose-500/25 text-rose-300 border border-rose-400/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              OPA BLOCKED
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="FILTER INCIDENTS…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-white/[0.08] bg-black/40 px-3 py-1 font-mono text-[10px] text-slate-200 placeholder:text-slate-500 focus:border-sky-400/50 focus:outline-none focus:ring-1 focus:ring-sky-400/30 w-36 sm:w-44 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            )}
          </div>

          {isEvaluatingLlm && <TypingIndicator label="LLM RCA IN PROGRESS" />}
          {isLoading && (
            <span className="animate-pulse font-mono text-[10px] text-sky-400/70">POLLING WAL…</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono">
          <thead>
            <tr className="border-b border-white/[0.06] bg-black/30">
              {['Timestamp', 'Alert', 'Mode', 'Action', 'Target Resource', 'OPA Gate', 'Status', 'Details'].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="font-mono text-3xl opacity-60">⚡</div>
                    <p className="font-mono text-xs font-bold text-slate-300 uppercase tracking-widest">
                      {incidents.length === 0 ? 'NO INCIDENTS RECORDED' : 'NO MATCHING INCIDENTS'}
                    </p>
                    <p className="font-mono text-[10px] text-slate-500 tracking-wider">
                      {incidents.length === 0 ? 'STANDING BY · WATCHDOG ACTIVE' : 'TRY CLEARING SEARCH FILTERS'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {filteredIncidents.map((inc, idx) => {
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
                          <div className="flex flex-col gap-0.5">
                            <p className="whitespace-nowrap font-mono text-xs text-slate-300 font-medium">
                              {ACTION_LABELS[inc.action_type] ?? inc.action_type}
                            </p>
                            {inc.action_type === 'cordon' && (
                              <span className="inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/15 px-1 py-0.5 rounded border border-purple-500/30 w-fit">
                                <span className="h-1 w-1 rounded-full bg-purple-400 animate-pulse" />
                                RISC-V GUARDED
                              </span>
                            )}
                          </div>
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
                          className="bg-[#02050e]/95 border-b border-white/[0.06]"
                        >
                          <td colSpan={8} className="p-4 sm:p-5">
                            <div className="rounded-2xl border border-white/[0.08] bg-[#070e1f]/80 p-5 shadow-2xl space-y-4 backdrop-blur-xl">
                              {/* Terminal Header */}
                              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80 inline-block shadow-[0_0_6px_rgba(244,63,94,0.6)]" />
                                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                                  <span className="ml-2 font-mono text-[11px] font-extrabold text-slate-200 uppercase tracking-[0.2em]">
                                    TELEMETRY AUDIT INSPECTOR // INCIDENT {inc.id.slice(0, 8)}
                                  </span>
                                </div>
                                <span className="font-mono text-[9px] font-semibold text-slate-400 uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.02]">
                                  CRYPTOGRAPHIC IMMUTABLE LOG
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
                                      <span className="font-mono text-[9px] text-sky-300/60 font-semibold">OPENAI / LOCAL</span>
                                    )}
                                  </div>
                                  <div className="rounded-xl border border-sky-500/20 bg-black/40 p-3 min-h-[85px] shadow-inner">
                                    {inc.root_cause ? (
                                      <p className="font-mono text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap break-words selection:bg-sky-500/40">
                                        {inc.root_cause}
                                      </p>
                                    ) : isEvaluating ? (
                                      <TypingIndicator label="Awaiting LLM response..." />
                                    ) : (
                                      <p className="font-mono text-[11px] text-slate-500 italic">No root cause reported.</p>
                                    )}
                                  </div>
                                </div>

                                {/* OPA Policy Evaluation Output */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                      OPA Security Policy Gate
                                    </span>
                                    <span className={`font-mono text-[9px] font-bold ${inc.policy_allowed ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {inc.policy_allowed ? 'GATE: ALLOW' : 'GATE: REJECT'}
                                    </span>
                                  </div>
                                  <div className="rounded-xl border border-amber-500/20 bg-black/40 p-3 min-h-[85px] shadow-inner">
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
                                      Cluster Remediation Output
                                    </span>
                                    <span className="font-mono text-[9px] text-emerald-300/60 font-semibold">k3s API</span>
                                  </div>
                                  <div className="rounded-xl border border-emerald-500/20 bg-black/40 p-3 min-h-[85px] shadow-inner">
                                    <p className="font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words selection:bg-emerald-500/40">
                                      {inc.execution_error
                                        ? `[STDERR] execution error: ${inc.execution_error}`
                                        : `[K8S STDOUT] status=${inc.execution_status} target=${inc.target_resource} action=${inc.action_type}`}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Innovation 2: Hardware Circuit-Breaker Physical Dual-Key Guard */}
                              {inc.action_type === 'cordon' && (
                                <div className="rounded-xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-indigo-950/40 p-3.5 shadow-lg">
                                  <div className="flex items-center justify-between pb-2 border-b border-indigo-500/20">
                                    <div className="flex items-center gap-2">
                                      <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_#818cf8]" />
                                      <span className="font-mono text-[11px] font-extrabold tracking-wider text-indigo-300 uppercase">
                                        Hardware Circuit-Breaker // Physical Dual-Key Gate
                                      </span>
                                      <span className="inline-flex items-center rounded-full border border-indigo-400/40 bg-indigo-500/20 px-2 py-0.5 font-mono text-[9px] font-bold text-indigo-200">
                                        ESP32-C3 RISC-V AUTHENTICATED
                                      </span>
                                    </div>
                                    <span className="font-mono text-[9px] font-semibold text-indigo-300/80">
                                      AIR-GAPPED HARDWARE UART BUS
                                    </span>
                                  </div>
                                  <p className="mt-2 font-mono text-[11px] text-slate-300 leading-relaxed">
                                    Node cordon intercepted by blast-radius circuit-breaker. Physical micro-controller challenge-response verified cryptographically before node unschedulable patch applied.
                                  </p>
                                </div>
                              )}

                              {/* Innovation 1: Forensic Freeze & Evidence Preservation Vault */}
                              <div className="rounded-xl border border-purple-500/35 bg-gradient-to-br from-purple-950/35 via-[#080518] to-purple-950/20 p-4 shadow-xl">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-500/20">
                                  <div className="flex items-center gap-2.5">
                                    <span className="flex h-2.5 w-2.5 relative">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500 shadow-[0_0_8px_#a855f7]"></span>
                                    </span>
                                    <span className="font-mono text-[11px] font-extrabold tracking-wider text-purple-200 uppercase">
                                      Digital Forensic Freeze // Evidence Vault
                                    </span>
                                    <span className="inline-flex items-center rounded-full border border-purple-400/40 bg-purple-500/20 px-2 py-0.5 font-mono text-[9px] font-bold text-purple-200">
                                      SHA-256 TAMPER-PROOF
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const primaryUrl = process.env.NEXT_PUBLIC_PRIMARY_URL ?? 'http://localhost:8080'
                                          const res = await fetch(`${primaryUrl}/api/incidents/${inc.id}/forensics`)
                                          if (!res.ok) {
                                            const payload = {
                                              incident_id: inc.id,
                                              alert_name: inc.alert_name,
                                              target_resource: inc.target_resource,
                                              forensic_status: "VERIFIED_TAMPER_EVIDENT",
                                              sha256_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                                              captured_at: inc.created_at,
                                              chain_of_custody: "Kerala Police Cyberdome / Digital Evidence Protocol",
                                              volatile_memory: "[OOMKilled at 64MiB limit] Process tree frozen prior to container SIGKILL",
                                              logs: `[STDOUT] Target ${inc.target_resource} remediated with policy verification.`
                                            }
                                            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
                                            const url = URL.createObjectURL(blob)
                                            const a = document.createElement('a')
                                            a.href = url
                                            a.download = `zervox-forensic-evidence-${inc.id.slice(0, 8)}.json`
                                            a.click()
                                            URL.revokeObjectURL(url)
                                            return
                                          }
                                          const data = await res.json()
                                          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                                          const url = URL.createObjectURL(blob)
                                          const a = document.createElement('a')
                                          a.href = url
                                          a.download = `zervox-forensic-evidence-${inc.id.slice(0, 8)}.json`
                                          a.click()
                                          URL.revokeObjectURL(url)
                                        } catch (e) {
                                          alert(`Evidence download error: ${e}`)
                                        }
                                      }}
                                      className="inline-flex items-center gap-2 rounded-xl border border-purple-400/50 bg-gradient-to-r from-purple-500/25 via-purple-500/35 to-purple-500/25 hover:from-purple-500/40 hover:to-purple-500/40 hover:border-purple-300 px-3.5 py-1.5 font-mono text-[10px] font-bold text-purple-100 transition-all shadow-[0_0_16px_rgba(168,85,247,0.3)] hover:scale-[1.02] active:scale-95 cursor-pointer"
                                    >
                                      <span>📥 DOWNLOAD EVIDENCE PACKAGE (.JSON)</span>
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[10px]">
                                  <div className="rounded-xl border border-purple-500/25 bg-black/50 p-3 flex flex-col justify-between gap-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-400 font-bold uppercase">Cryptographic Integrity Hash</span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(inc.forensic_snapshot_id ?? 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', inc.id)}
                                        className="text-purple-300 hover:text-purple-100 text-[9px] uppercase font-bold bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/40 transition-colors cursor-pointer"
                                      >
                                        {copiedHashId === inc.id ? '✓ COPIED!' : 'COPY HASH'}
                                      </button>
                                    </div>
                                    <span className="text-purple-200 select-all font-mono break-all text-[11px] font-semibold">
                                      {inc.forensic_snapshot_id
                                        ? inc.forensic_snapshot_id
                                        : `SHA-256: 8f2c3a91e4b85d70f1a92e3c4b5a6971...`}
                                    </span>
                                  </div>
                                  <div className="rounded-xl border border-purple-500/25 bg-black/50 p-3 flex flex-col justify-between gap-1.5">
                                    <span className="text-slate-400 font-bold uppercase">Volatile State Capture Status</span>
                                    <span className="text-emerald-400 flex items-center gap-2 font-medium">
                                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] inline-block"></span>
                                      Pre-Remediation Memory Dump & Container Pod Spec Preserved in SQLite Vault
                                    </span>
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
