'use client'

import { PulseRing } from '@/components/ui/PulseRing'

interface HeaderProps {
  primaryOnline: boolean
  backupOnline: boolean
  lastUpdated: Date | null
  onRefresh: () => void
  onOpenAirGap?: () => void
  hardwareStatus?: string
}

export function Header({ primaryOnline, backupOnline, lastUpdated, onRefresh, onOpenAirGap, hardwareStatus }: HeaderProps) {
  const anyOnline = primaryOnline || backupOnline

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#030712]/85 backdrop-blur-xl transition-all">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-3.5">
        {/* Brand */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/30 bg-gradient-to-br from-sky-400/20 via-sky-500/10 to-transparent shadow-[0_0_16px_rgba(56,189,248,0.2)]">
              <span className="text-lg">⚡</span>
              {anyOnline && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm font-extrabold tracking-[0.25em] text-white">ZERVOX</p>
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.2 font-mono text-[8px] font-bold uppercase tracking-widest text-sky-300">
                  DEFENSE
                </span>
              </div>
              <p className="font-mono text-[9px] tracking-widest text-slate-400 uppercase">
                CYBERDOME SRE CORE · HAC'KP
              </p>
            </div>
          </div>

          {/* Separator */}
          <div className="h-6 w-px bg-white/[0.08]" />

          {/* Instance health pill cluster */}
          <div className="hidden md:flex items-center gap-3 rounded-full border border-white/[0.06] bg-white/[0.02] px-3.5 py-1">
            <div className="flex items-center gap-1.5">
              <PulseRing online={primaryOnline} size="sm" />
              <span className="font-mono text-[10px] font-semibold tracking-wider text-slate-400">PRIMARY</span>
            </div>
            <span className="text-white/20 text-xs">/</span>
            <div className="flex items-center gap-1.5">
              <PulseRing online={backupOnline} size="sm" />
              <span className="font-mono text-[10px] font-semibold tracking-wider text-slate-400">BACKUP</span>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="hidden font-mono text-[10px] tracking-wider text-slate-500 sm:block">
              SYNC {lastUpdated.toLocaleTimeString()}
            </span>
          )}

          {/* Hardware Circuit Breaker Chip */}
          {hardwareStatus && (
            <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.2)] backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="font-mono text-[9px] font-bold tracking-wider uppercase">
                {hardwareStatus.includes('ARMED') ? 'RISC-V DUAL-KEY ARMED' : 'CIRCUIT-BREAKER DISARMED'}
              </span>
            </div>
          )}

          {/* Overall System Status Pill */}
          <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 backdrop-blur-md ${
            anyOnline
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${anyOnline ? 'animate-pulse bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase">
              {anyOnline ? 'SYSTEM OPERATIONAL' : 'SYSTEM OFFLINE'}
            </span>
          </div>

          {/* Innovation 4: Air-Gap Optical Telemetry Button */}
          {onOpenAirGap && (
            <button
              onClick={onOpenAirGap}
              type="button"
              className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-amber-500/25 to-amber-500/15 px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-200 transition-all hover:border-amber-300 hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]" />
              <span>AIR-GAP OPTICAL</span>
            </button>
          )}

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-all hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-sky-300 hover:shadow-[0_0_16px_rgba(56,189,248,0.15)] active:scale-95 cursor-pointer"
            title="Poll fresh telemetry"
          >
            <span className="text-xs">↻</span>
            <span className="hidden sm:inline">SYNC</span>
          </button>
        </div>
      </div>
    </header>
  )
}

