'use client'

import React from 'react'

interface TopologyMiniMapProps {
  primaryOnline: boolean
  backupOnline: boolean
  activeRole: 'primary' | 'backup' | string
}

export function TopologyMiniMap({ primaryOnline, backupOnline, activeRole }: TopologyMiniMapProps) {
  const isPrimaryActive = activeRole === 'primary' && primaryOnline
  const isBackupActive = (activeRole === 'backup' && backupOnline) || (!primaryOnline && backupOnline)
  const isPrimaryDead = !primaryOnline

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0b1329]/70 backdrop-blur-xl p-4.5 flex flex-col justify-between shadow-[0_4px_24px_-2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] h-full">
      {/* Mini-map Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)] animate-pulse" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
            Topology Route Visualizer
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-300">
          HA FAILOVER TUNNEL
        </span>
      </div>

      <div className="relative flex items-center justify-between py-2 px-2 flex-1">
        {/* Track A: Zervox Engine Nodes */}
        <div className="flex flex-col gap-3 z-10 w-[145px]">
          <div className="font-mono text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-[-4px]">
            TRACK A · ENGINES
          </div>

          {/* Primary Node */}
          <div
            className={`rounded-xl border px-3 py-2.5 transition-all duration-300 ${
              isPrimaryDead
                ? 'border-rose-500/50 bg-rose-950/20 shadow-[0_0_16px_rgba(244,63,94,0.15)]'
                : isPrimaryActive
                  ? 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_16px_rgba(16,185,129,0.15)]'
                  : 'border-white/[0.08] bg-slate-900/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-100">PRIMARY</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  isPrimaryDead ? 'bg-rose-500 animate-ping shadow-[0_0_6px_#f43f5e]' : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                }`}
              />
            </div>
            <p className="font-mono text-[9px] text-slate-400 mt-1">
              {isPrimaryDead ? 'OFFLINE / SEVERED' : isPrimaryActive ? 'ACTIVE LEADER' : 'STANDBY'}
            </p>
          </div>

          {/* Backup Node */}
          <div
            className={`rounded-xl border px-3 py-2.5 transition-all duration-300 ${
              isBackupActive
                ? 'border-amber-500/50 bg-amber-950/20 shadow-[0_0_16px_rgba(245,158,11,0.15)]'
                : backupOnline
                  ? 'border-white/[0.08] bg-slate-900/60'
                  : 'border-rose-500/30 bg-rose-950/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-100">BACKUP</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  isBackupActive
                    ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse'
                    : backupOnline
                      ? 'bg-emerald-500/70 shadow-[0_0_6px_#10b981]'
                      : 'bg-rose-500'
                }`}
              />
            </div>
            <p className="font-mono text-[9px] text-slate-400 mt-1">
              {isBackupActive ? 'FAILOVER PROMOTED' : backupOnline ? 'HOT STANDBY' : 'OFFLINE'}
            </p>
          </div>
        </div>

        {/* Dynamic SVG Connection Routing Track A -> Track B */}
        <div className="flex-1 h-32 relative mx-3">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 80">
            <defs>
              <linearGradient id="grad-active-primary" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
              <linearGradient id="grad-backup-reroute" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>

            {/* Path 1: Primary Node (Y=20) -> k3s Cluster (Y=40) */}
            {isPrimaryDead ? (
              <>
                <path
                  d="M 5,20 C 40,20 40,40 95,40"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  className="opacity-75 animate-pulse"
                />
                <circle cx="50" cy="30" r="8" fill="#f43f5e" fillOpacity="0.15" stroke="#f43f5e" strokeWidth="1.5" />
                <text x="50" y="33.5" textAnchor="middle" fill="#f43f5e" fontSize="9" fontFamily="monospace" fontWeight="bold">✕</text>
              </>
            ) : (
              <path
                d="M 5,20 C 40,20 40,40 95,40"
                fill="none"
                stroke={isPrimaryActive ? 'url(#grad-active-primary)' : 'rgba(255,255,255,0.1)'}
                strokeWidth={isPrimaryActive ? '2.5' : '1.5'}
                strokeDasharray={isPrimaryActive ? '6,3' : 'none'}
                className={isPrimaryActive ? 'animate-pulse' : ''}
              />
            )}

            {/* Path 2: Backup Node (Y=60) -> k3s Cluster (Y=40) */}
            <path
              d="M 5,60 C 40,60 40,40 95,40"
              fill="none"
              stroke={isBackupActive ? 'url(#grad-backup-reroute)' : 'rgba(255,255,255,0.1)'}
              strokeWidth={isBackupActive ? '3' : '1.5'}
              strokeDasharray={isBackupActive ? '6,3' : '4,4'}
              className={isBackupActive ? 'animate-pulse' : 'opacity-40'}
            />
          </svg>

          {/* Connection status tag */}
          <div className="absolute inset-x-0 bottom-[-8px] text-center">
            {isPrimaryDead ? (
              <span className="font-mono text-[9px] font-bold text-amber-300 bg-[#070d1e] px-2.5 py-0.5 rounded-full border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                ⚡ AUTO-FAILOVER VIA BACKUP
              </span>
            ) : (
              <span className="font-mono text-[9px] font-bold text-emerald-300 bg-[#070d1e] px-2.5 py-0.5 rounded-full border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                ● OUT-OF-BAND PRIMARY ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Track B: k3s Cluster Target */}
        <div className="flex flex-col gap-2 z-10 w-[145px]">
          <div className="font-mono text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-[-4px]">
            TRACK B · TARGET
          </div>
          <div className="rounded-xl border border-sky-400/40 bg-gradient-to-br from-sky-950/40 to-slate-900/40 p-3 shadow-[0_0_20px_rgba(56,189,248,0.15)]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-sky-200">k3s CLUSTER</span>
              <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
            </div>
            <p className="font-mono text-[9px] text-slate-400 mt-1">Autonomous Perimeter</p>
            <div className="mt-2 flex items-center justify-center gap-1 font-mono text-[9px] font-bold text-sky-300 bg-sky-500/15 border border-sky-400/20 rounded-md py-0.5">
              <span>PODS / DEPLOYMENTS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

