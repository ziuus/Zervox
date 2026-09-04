'use client'

import { PulseRing } from '@/components/ui/PulseRing'

interface HeaderProps {
  primaryOnline: boolean
  backupOnline: boolean
  lastUpdated: Date | null
  onRefresh: () => void
  onOpenAirGap?: () => void
}

export function Header({ primaryOnline, backupOnline, lastUpdated, onRefresh, onOpenAirGap }: HeaderProps) {
  const anyOnline = primaryOnline || backupOnline

  return (
    <header className="sticky top-0 z-50 border-b border-[#1e3a5f] bg-[#020409]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-3">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            {/* Logo mark */}
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/40 bg-sky-500/10">
              <span className="text-base">⚡</span>
              {anyOnline && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              )}
            </div>
            <div>
              <p className="font-mono text-sm font-bold tracking-[0.2em] text-slate-100">ZERVOX</p>
              <p className="font-mono text-[9px] tracking-widest text-slate-600">SRE CONTROL PLANE</p>
            </div>
          </div>

          {/* Separator */}
          <div className="h-6 w-px bg-[#1e3a5f]" />

          {/* Instance health indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <PulseRing online={primaryOnline} size="sm" />
              <span className="font-mono text-[10px] font-semibold tracking-widest text-slate-500">PRIMARY</span>
            </div>
            <div className="flex items-center gap-1.5">
              <PulseRing online={backupOnline} size="sm" />
              <span className="font-mono text-[10px] font-semibold tracking-widest text-slate-500">BACKUP</span>
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="hidden font-mono text-[10px] text-slate-700 sm:block">
              SYNC {lastUpdated.toLocaleTimeString()}
            </span>
          )}

          {/* System status chip */}
          <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${
            anyOnline
              ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-400'
              : 'border-red-400/30 bg-red-400/5 text-red-400'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${anyOnline ? 'animate-pulse bg-emerald-400' : 'bg-red-400'}`} />
            <span className="font-mono text-[10px] font-semibold tracking-widest">
              {anyOnline ? 'SYSTEMS ONLINE' : 'OFFLINE'}
            </span>
          </div>

          {/* Air-Gap Optical Telemetry Button */}
          {onOpenAirGap && (
            <button
              onClick={onOpenAirGap}
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-amber-300 transition-all hover:border-amber-400 hover:bg-amber-500/20 active:scale-95 shadow-[0_0_12px_rgba(245,158,11,0.15)] cursor-pointer"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>AIR-GAP OPTICAL</span>
            </button>
          )}

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            className="rounded-lg border border-[#1e3a5f] bg-[#0b1628] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400 transition-all hover:border-sky-500/40 hover:bg-sky-500/5 hover:text-sky-400 active:scale-95"
          >
            ↻ REFRESH
          </button>
        </div>
      </div>
    </header>
  )
}
