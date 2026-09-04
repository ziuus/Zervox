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
    <div className="rounded-xl border border-[#1e3a5f] bg-[#0b1628] p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-[#1e3a5f]/60 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">
            Topology Mini-Map
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded border border-[#1e3a5f] bg-[#060d1a] text-slate-400">
          HA Failover Route
        </span>
      </div>

      <div className="relative flex items-center justify-between py-2 px-3">
        {/* Track A: Zervox Engine Nodes */}
        <div className="flex flex-col gap-3 z-10 w-[140px]">
          <div className="font-mono text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-[-4px]">
            TRACK A · ENGINE
          </div>

          {/* Primary Node */}
          <div
            className={`rounded-lg border px-3 py-2 transition-all duration-500 ${
              isPrimaryDead
                ? 'border-red-500/60 bg-red-500/10 shadow-[0_0_10px_rgba(255,0,0,0.3)]'
                : isPrimaryActive
                  ? 'border-emerald-400/60 bg-emerald-400/10 shadow-[0_0_12px_rgba(0,255,0,0.25)]'
                  : 'border-slate-700 bg-slate-900/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-200">PRIMARY</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  isPrimaryDead ? 'bg-red-500 animate-ping' : 'bg-emerald-400 shadow-[0_0_6px_#00ff00]'
                }`}
              />
            </div>
            <p className="font-mono text-[9px] text-slate-400 mt-0.5">
              {isPrimaryDead ? 'OFFLINE / SEVERED' : isPrimaryActive ? 'ACTIVE LEADER' : 'ONLINE'}
            </p>
          </div>

          {/* Backup Node */}
          <div
            className={`rounded-lg border px-3 py-2 transition-all duration-500 ${
              isBackupActive
                ? 'border-amber-400/70 bg-amber-400/10 shadow-[0_0_12px_rgba(255,183,0,0.35)]'
                : backupOnline
                  ? 'border-slate-700 bg-slate-900/60'
                  : 'border-red-500/40 bg-red-500/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-200">BACKUP</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  isBackupActive
                    ? 'bg-amber-400 shadow-[0_0_6px_#ffb700] animate-pulse'
                    : backupOnline
                      ? 'bg-emerald-500/50'
                      : 'bg-red-500'
                }`}
              />
            </div>
            <p className="font-mono text-[9px] text-slate-400 mt-0.5">
              {isBackupActive ? 'FAILOVER PROMOTED' : backupOnline ? 'HOT STANDBY' : 'OFFLINE'}
            </p>
          </div>
        </div>

        {/* Dynamic SVG Connection Routing Track A -> Track B */}
        <div className="flex-1 h-28 relative mx-2">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 80">
            <defs>
              <linearGradient id="grad-active-primary" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00ff00" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
              <linearGradient id="grad-backup-reroute" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffb700" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>

            {/* Path 1: Primary Node (Y=20) -> k3s Cluster (Y=40) */}
            {isPrimaryDead ? (
              <>
                {/* Severed red broken link */}
                <path
                  d="M 5,20 C 40,20 40,40 95,40"
                  fill="none"
                  stroke="#ff0000"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  className="opacity-70 animate-pulse"
                />
                {/* Break indicator cross */}
                <circle cx="50" cy="30" r="7" fill="#ff0000" fillOpacity="0.2" stroke="#ff0000" strokeWidth="1.5" />
                <text x="50" y="33" textAnchor="middle" fill="#ff0000" fontSize="9" fontFamily="monospace" fontWeight="bold">✕</text>
              </>
            ) : (
              <>
                <path
                  d="M 5,20 C 40,20 40,40 95,40"
                  fill="none"
                  stroke={isPrimaryActive ? 'url(#grad-active-primary)' : '#1e3a5f'}
                  strokeWidth={isPrimaryActive ? '2.5' : '1.5'}
                  strokeDasharray={isPrimaryActive ? '6,3' : 'none'}
                  className={isPrimaryActive ? 'animate-pulse' : ''}
                />
              </>
            )}

            {/* Path 2: Backup Node (Y=60) -> k3s Cluster (Y=40) */}
            <path
              d="M 5,60 C 40,60 40,40 95,40"
              fill="none"
              stroke={isBackupActive ? 'url(#grad-backup-reroute)' : '#1e3a5f'}
              strokeWidth={isBackupActive ? '3' : '1.5'}
              strokeDasharray={isBackupActive ? '6,3' : '4,4'}
              className={isBackupActive ? 'animate-pulse' : 'opacity-40'}
            />
          </svg>

          {/* Connection status tag */}
          <div className="absolute inset-x-0 bottom-[-6px] text-center">
            {isPrimaryDead ? (
              <span className="font-mono text-[9px] font-bold text-amber-400 bg-[#060d1a] px-2 py-0.5 rounded border border-amber-400/40 shadow-[0_0_8px_rgba(255,183,0,0.3)]">
                ⚡ ROUTING VIA BACKUP
              </span>
            ) : (
              <span className="font-mono text-[9px] font-bold text-emerald-400 bg-[#060d1a] px-2 py-0.5 rounded border border-emerald-400/40">
                ● PRIMARY LINK ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Track B: k3s Cluster Target */}
        <div className="flex flex-col gap-2 z-10 w-[140px]">
          <div className="font-mono text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-[-4px]">
            TRACK B · TARGET
          </div>
          <div className="rounded-lg border border-sky-500/40 bg-sky-950/20 p-3 shadow-[0_0_15px_rgba(56,189,248,0.15)]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-sky-300">k3s CLUSTER</span>
              <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]" />
            </div>
            <p className="font-mono text-[9px] text-slate-400 mt-1">Autonomous Control</p>
            <div className="mt-2 flex items-center gap-1 font-mono text-[9px] text-sky-400/90 bg-sky-500/10 rounded px-1.5 py-0.5">
              <span>PODS / DEPLOYMENTS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
