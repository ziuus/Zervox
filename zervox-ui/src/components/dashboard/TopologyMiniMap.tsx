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
      className="rounded-2xl p-4.5 surface-elevated border flex flex-col justify-between h-full font-mono relative overflow-hidden transition-all duration-300"
      style={{
        borderColor: simulatedSever ? 'rgba(245,158,11,0.5)' : 'var(--border-medium)',
      }}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b pb-2.5 mb-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full animate-pulse"
            style={{
              background: simulatedSever ? '#fbbf24' : 'var(--status-green)',
              boxShadow: simulatedSever ? '0 0 8px #fbbf24' : '0 0 8px var(--status-green)',
            }}
          />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em]" style={{ color: 'var(--text-primary)' }}>
            Split-Brain Sentinel // HA Topology
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!simulatedSever ? (
            <button
              type="button"
              onClick={triggerSeverSimulation}
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-all cursor-pointer"
              title="Demonstrate mTLS heartbeat sever and automated leader takeover"
            >
              ⚡ SEVER HEARTBEAT (CHAOS)
            </button>
          ) : (
            <button
              type="button"
              onClick={restoreHeartbeat}
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all cursor-pointer"
            >
              RESTORE PRIMARY
            </button>
          )}
        </div>
      </div>

      {/* Center Visualization */}
      <div className="relative flex items-center justify-between py-2 px-1 flex-1">
        {/* Track A: Engines */}
        <div className="flex flex-col gap-2.5 z-10 w-[150px]">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-300" style={{ color: 'var(--text-secondary)' }}>
            TRACK A · ENGINES
          </div>

          {/* Primary Node */}
          <div
            className={`rounded-xl border p-2.5 transition-all duration-300 ${
              !effectivePrimaryOnline
                ? 'border-red-500/60 bg-red-950/20 shadow-[0_0_16px_rgba(239,68,68,0.2)]'
                : effectivePrimaryActive
                ? 'border-emerald-500/50 bg-emerald-950/20'
                : 'border-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-100" style={{ color: 'var(--text-primary)' }}>PRIMARY</span>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  !effectivePrimaryOnline ? 'bg-red-500 animate-ping' : 'bg-emerald-400'
                }`}
              />
            </div>
            <p className="text-[10px] sm:text-[11px] mt-0.5 font-bold" style={{ color: !effectivePrimaryOnline ? '#f87171' : 'var(--status-green)' }}>
              {!effectivePrimaryOnline ? 'OFFLINE / SEVERED' : 'ACTIVE LEADER'}
            </p>
          </div>

          {/* Backup Node */}
          <div
            className={`rounded-xl border p-2.5 transition-all duration-300 ${
              effectiveBackupActive
                ? 'border-amber-400 bg-amber-950/30 shadow-[0_0_20px_rgba(251,191,36,0.3)] ring-1 ring-amber-400'
                : !isBackupReachable && !simulatedSever
                ? 'border-red-500/60 bg-red-950/20 shadow-[0_0_16px_rgba(239,68,68,0.2)]'
                : 'border-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-100" style={{ color: 'var(--text-primary)' }}>BACKUP</span>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  effectiveBackupActive
                    ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]'
                    : !isBackupReachable && !simulatedSever
                    ? 'bg-red-500 animate-ping'
                    : 'bg-slate-500'
                }`}
              />
            </div>
            <p className="text-[10px] sm:text-[11px] mt-0.5 font-bold" style={{ color: effectiveBackupActive ? '#fbbf24' : !isBackupReachable && !simulatedSever ? '#f87171' : 'var(--text-secondary)' }}>
              {isElecting
                ? 'ELECTING LEADER…'
                : effectiveBackupActive
                ? '★ ACTIVE PROMOTED LEADER'
                : isBackupReachable
                ? 'DORMANT STANDBY (mTLS)'
                : 'OFFLINE / SEVERED'}
            </p>
          </div>
        </div>

        {/* Center Dynamic SVG Routing */}
        <div className="flex-1 h-28 relative mx-3">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 80">
            {/* Primary Path */}
            {!effectivePrimaryOnline ? (
              <>
                <path
                  d="M 5,20 C 40,20 40,40 95,40"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  className="opacity-80 animate-pulse"
                />
                <circle cx="50" cy="30" r="7" fill="#450a0a" stroke="#ef4444" strokeWidth="1.5" />
                <text x="50" y="33" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="bold">✕</text>
              </>
            ) : (
              <path
                d="M 5,20 C 40,20 40,40 95,40"
                fill="none"
                stroke="var(--status-green)"
                strokeWidth="2.5"
                strokeDasharray="5,3"
                className="animate-pulse"
              />
            )}

            {/* Backup Path */}
            <path
              d="M 5,60 C 40,60 40,40 95,40"
              fill="none"
              stroke={effectiveBackupActive ? '#fbbf24' : 'var(--border-subtle)'}
              strokeWidth={effectiveBackupActive ? '3' : '1.5'}
              strokeDasharray={effectiveBackupActive ? '6,3' : '4,4'}
              className={effectiveBackupActive ? 'animate-pulse' : 'opacity-30'}
            />
          </svg>

          {/* Status Overlay Pill */}
          <div className="absolute inset-x-0 bottom-[-8px] flex justify-center z-20 pointer-events-none">
            {isElecting ? (
              <span className="whitespace-nowrap w-fit text-[10px] sm:text-[11px] font-extrabold text-amber-300 bg-amber-950/95 px-2.5 py-1 rounded-full border border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)] animate-pulse">
                ⏳ ELECTING BACKUP LEADER (2.4s)…
              </span>
            ) : simulatedSever ? (
              <span className="whitespace-nowrap w-fit text-[10px] sm:text-[11px] font-extrabold text-amber-300 bg-slate-950/95 px-2.5 py-1 rounded-full border border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]">
                ⚡ BACKUP SEIZED ACTIVE CONTROL · 0 DATA LOSS
              </span>
            ) : !isBackupReachable || !effectivePrimaryOnline ? (
              <span className="whitespace-nowrap w-fit text-[10px] sm:text-[11px] font-extrabold text-red-300 bg-slate-950/95 px-2.5 py-1 rounded-full border border-red-500/60 shadow-[0_0_14px_rgba(239,68,68,0.35)] tracking-wide">
                ✕ mTLS HEARTBEAT TUNNEL SEVERED
              </span>
            ) : (
              <span className="whitespace-nowrap w-fit text-[10px] sm:text-[11px] font-extrabold text-emerald-300 bg-slate-950/95 px-2.5 py-1 rounded-full border border-emerald-400/60 shadow-[0_0_14px_rgba(52,211,153,0.35)] tracking-wide">
                ● mTLS HEARTBEAT TUNNEL HEALTHY (TCP 9000)
              </span>
            )}
          </div>
        </div>

        {/* Track B: k3s Cluster */}
        <div className="flex flex-col gap-2 z-10 w-[150px]">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-300" style={{ color: 'var(--text-secondary)' }}>
            TRACK B · TARGET
          </div>
          <div className="rounded-xl border p-2.5 surface space-y-1.5" style={{ borderColor: 'var(--accent-border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-100" style={{ color: 'var(--text-primary)' }}>k3s CLUSTER</span>
              <span className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
            </div>
            <p className="text-[10px] font-medium text-slate-300" style={{ color: 'var(--text-secondary)' }}>Autonomous Perimeter</p>
            <div
              className="text-center rounded py-0.5 text-[9px] font-extrabold tracking-wider uppercase"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
            >
              PODS / DEPLOYMENTS
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
