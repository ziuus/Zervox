'use client'

import { useState } from 'react'

interface SplitBrainSentinelProps {
  primaryOnline: boolean
  backupOnline: boolean
  activeRole: 'primary' | 'backup' | string
  peerStatus?: string | null
}

export function TopologyMiniMap({ primaryOnline, backupOnline, activeRole, peerStatus }: SplitBrainSentinelProps) {
  const [simulatedSever, setSimulatedSever] = useState(false)
  const [isElecting, setIsElecting] = useState(false)

  // Derive active states factoring in simulation and mTLS peer connectivity
  const effectivePrimaryOnline = simulatedSever ? false : primaryOnline
  const isPeerConnected = peerStatus === 'peer_connected'
  const isBackupReachable = backupOnline || isPeerConnected
  const effectiveBackupActive = simulatedSever
    ? !isElecting
    : ((activeRole === 'backup' && isBackupReachable) || (!primaryOnline && isBackupReachable))
  const effectivePrimaryActive = !simulatedSever && activeRole === 'primary' && primaryOnline

  const triggerSeverSimulation = () => {
    setSimulatedSever(true)
    setIsElecting(true)
    setTimeout(() => {
      setIsElecting(false)
    }, 2400)
  }

  const restoreHeartbeat = () => {
    setSimulatedSever(false)
    setIsElecting(false)
  }

  return (
    <div
      className={`rounded-2xl p-6 md:p-8 surface-elevated border transition-all duration-300 relative overflow-hidden ${
        simulatedSever
          ? 'border-amber-500/40'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                simulatedSever ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Split-Brain Sentinel & Network Topology
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Active routing between dual out-of-band engines and Kubernetes perimeter
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!simulatedSever ? (
            <button
              type="button"
              onClick={triggerSeverSimulation}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-600/30 text-amber-900 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm"
              title="Demonstrate mTLS heartbeat sever and automated leader takeover"
            >
              ⚡ Sever Heartbeat (Test Failover)
            </button>
          ) : (
            <button
              type="button"
              onClick={restoreHeartbeat}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-600/30 text-emerald-900 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-sm"
            >
              ✓ Restore Primary Heartbeat
            </button>
          )}
        </div>
      </div>

      {/* Center Visualization Flow */}
      <div className="relative flex flex-col md:flex-row items-center justify-between py-4 px-2 gap-6">
        {/* Left Column: Dual Engines */}
        <div className="flex flex-col gap-4 z-10 w-full md:w-64">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Out-of-Band Sentinels
          </span>

          {/* Primary Node Box */}
          <div
            className={`rounded-xl border p-4 transition-all duration-200 ${
              !effectivePrimaryOnline
                ? 'border-rose-500/50 bg-rose-500/5 dark:bg-rose-950/20'
                : effectivePrimaryActive
                ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-950/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Primary Engine (8080)</span>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  !effectivePrimaryOnline ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                }`}
              />
            </div>
            <p
              className={`text-xs mt-1 font-semibold ${
                !effectivePrimaryOnline
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-emerald-800 dark:text-emerald-400'
              }`}
            >
              {!effectivePrimaryOnline ? 'Heartbeat Severed' : 'Active Commander'}
            </p>
            <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 block mt-1">
              TCP 9000 Heartbeat Broadcast
            </span>
          </div>

          {/* Backup Node Box */}
          <div
            className={`rounded-xl border p-4 transition-all duration-200 ${
              effectiveBackupActive
                ? 'border-amber-500/60 bg-amber-500/5 dark:bg-amber-950/30'
                : !isBackupReachable && !simulatedSever
                ? 'border-rose-500/50 bg-rose-500/5 dark:bg-rose-950/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Backup Engine (8081)</span>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  effectiveBackupActive
                    ? 'bg-amber-500'
                    : !isBackupReachable && !simulatedSever
                    ? 'bg-rose-500 animate-pulse'
                    : 'bg-slate-400'
                }`}
              />
            </div>
            <p
              className={`text-xs mt-1 font-semibold ${
                effectiveBackupActive
                  ? 'text-amber-800 dark:text-amber-400'
                  : !isBackupReachable && !simulatedSever
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {isElecting
                ? 'Electing Leader (2.4s)…'
                : effectiveBackupActive
                ? '★ Promoted Active Commander'
                : isBackupReachable
                ? 'Dormant Standby (mTLS Active)'
                : 'Unreachable'}
            </p>
            <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 block mt-1">
              TCP 9001 Polling Listener
            </span>
          </div>
        </div>

        {/* Center SVG Routing Lines */}
        <div className="flex-1 w-full h-32 relative hidden md:block mx-4">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 80">
            {/* Primary Path */}
            {!effectivePrimaryOnline ? (
              <>
                <path
                  d="M 5,20 C 45,20 45,40 95,40"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  className="opacity-70"
                />
                <circle cx="50" cy="30" r="6" fill="var(--bg-elevated)" stroke="#ef4444" strokeWidth="1.5" />
                <text x="50" y="33" textAnchor="middle" fill="#ef4444" fontSize="7" fontWeight="bold">✕</text>
              </>
            ) : (
              <path
                d="M 5,20 C 45,20 45,40 95,40"
                fill="none"
                stroke="var(--status-green)"
                strokeWidth="2.5"
                strokeDasharray="6,4"
                className="opacity-90"
              />
            )}

            {/* Backup Path */}
            <path
              d="M 5,60 C 45,60 45,40 95,40"
              fill="none"
              stroke={effectiveBackupActive ? '#d97706' : 'var(--border-subtle)'}
              strokeWidth={effectiveBackupActive ? '2.5' : '1.5'}
              strokeDasharray={effectiveBackupActive ? '6,4' : '4,4'}
              className={effectiveBackupActive ? 'opacity-90' : 'opacity-40'}
            />
          </svg>

          {/* Center mTLS Status Pill */}
          <div className="absolute inset-x-0 bottom-[-10px] flex justify-center z-20 pointer-events-none">
            {isElecting ? (
              <span className="whitespace-nowrap w-fit text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-slate-900 px-3 py-1 rounded-full border border-amber-500/50 shadow-sm">
                ⏳ Electing Backup Leader (2.4s)…
              </span>
            ) : simulatedSever ? (
              <span className="whitespace-nowrap w-fit text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-slate-900 px-3 py-1 rounded-full border border-amber-500/50 shadow-sm">
                ⚡ Backup Seized Active Leadership · 0 Data Loss
              </span>
            ) : !isBackupReachable || !effectivePrimaryOnline ? (
              <span className="whitespace-nowrap w-fit text-xs font-semibold text-rose-900 dark:text-rose-200 bg-rose-50 dark:bg-slate-900 px-3 py-1 rounded-full border border-rose-500/50 shadow-sm">
                ✕ mTLS Heartbeat Tunnel Severed
              </span>
            ) : (
              <span className="whitespace-nowrap w-fit text-xs font-semibold text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-slate-900 px-3 py-1 rounded-full border border-emerald-500/50 shadow-sm">
                ● mTLS Heartbeat Tunnel Healthy (TCP 9000)
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Protected Cluster */}
        <div className="flex flex-col gap-4 z-10 w-full md:w-64">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Protected Target
          </span>

          <div className="rounded-xl border border-teal-500/30 dark:border-teal-500/20 bg-teal-50/20 dark:bg-teal-950/10 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">k3s Cluster Perimeter</span>
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Autonomous crisis mitigation boundary
            </p>
            <div className="rounded-lg p-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 text-[11px] font-mono text-slate-700 dark:text-slate-300">
              default / kube-system
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
