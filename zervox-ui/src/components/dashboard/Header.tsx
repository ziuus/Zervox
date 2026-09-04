'use client'

import { useTheme } from '@/components/ui/ThemeProvider'
import { PulseRing } from '@/components/ui/PulseRing'

interface HeaderProps {
  primaryOnline: boolean
  backupOnline: boolean
  lastUpdated: Date | null
  onRefresh: () => void
  onOpenAirGap?: () => void
  hardwareStatus?: string
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function Header({
  primaryOnline,
  backupOnline,
  lastUpdated,
  onRefresh,
  onOpenAirGap,
  hardwareStatus,
}: HeaderProps) {
  const { theme, toggle } = useTheme()
  const anyOnline = primaryOnline || backupOnline
  const isDark = theme === 'dark'

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl transition-all animate-slide-down"
      style={{
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--header-border)',
      }}
    >
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-3">

        {/* ── Brand ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div
              className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-all"
              style={{
                background: 'var(--accent-subtle)',
                border: '1px solid var(--accent-border)',
                boxShadow: anyOnline ? '0 0 14px var(--glow-sky)' : 'none',
              }}
            >
              <span className="text-lg select-none">⚡</span>
              {anyOnline && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full animate-pulse"
                  style={{ background: 'var(--status-green)', boxShadow: '0 0 8px var(--status-green)' }}
                />
              )}
            </div>

            {/* Wordmark */}
            <div>
              <div className="flex items-center gap-2">
                <p
                  className="font-mono text-sm font-extrabold tracking-[0.25em]"
                  style={{ color: 'var(--text-primary)' }}
                >
                  ZERVOX
                </p>
                <span
                  className="rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest"
                  style={{
                    color: 'var(--accent)',
                    background: 'var(--accent-subtle)',
                    border: '1px solid var(--accent-border)',
                  }}
                >
                  DEFENSE
                </span>
              </div>
              <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                CYBERDOME SRE CORE · HAC&apos;KP
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-6 w-px" style={{ background: 'var(--border-medium)' }} />

          {/* Instance health pills */}
          <div
            className="hidden md:flex items-center gap-3 rounded-full px-3.5 py-1"
            style={{
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <PulseRing online={primaryOnline} size="sm" />
              <span className="font-mono text-[10px] font-semibold tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                PRIMARY
              </span>
            </div>
            <span style={{ color: 'var(--border-medium)' }} className="text-xs">/</span>
            <div className="flex items-center gap-1.5">
              <PulseRing online={backupOnline} size="sm" />
              <span className="font-mono text-[10px] font-semibold tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                BACKUP
              </span>
            </div>
          </div>
        </div>

        {/* ── Right Controls ────────────────────────────────────── */}
        <div className="flex items-center gap-2.5">
          {/* Last updated */}
          {lastUpdated && (
            <span className="hidden font-mono text-[10px] tracking-wider sm:block" style={{ color: 'var(--text-muted)' }}>
              SYNC {lastUpdated.toLocaleTimeString()}
            </span>
          )}

          {/* Hardware Circuit Breaker Chip */}
          {hardwareStatus && (
            <div
              className="hidden lg:flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{
                border: '1px solid rgba(168,85,247,0.35)',
                background: 'rgba(168,85,247,0.08)',
                color: isDark ? '#c4b5fd' : '#7c3aed',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="font-mono text-[9px] font-bold tracking-wider uppercase">
                {hardwareStatus.includes('ARMED') ? 'RISC-V ARMED' : 'HW BREAKER'}
              </span>
            </div>
          )}

          {/* System Status Pill */}
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1 transition-all"
            style={{
              border: anyOnline ? '1px solid var(--status-green-bdr)' : '1px solid var(--status-red-bdr)',
              background: anyOnline ? 'var(--status-green-bg)' : 'var(--status-red-bg)',
              color: anyOnline ? 'var(--status-green)' : 'var(--status-red)',
            }}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${anyOnline ? 'animate-pulse' : ''}`}
              style={{ background: anyOnline ? 'var(--status-green)' : 'var(--status-red)' }}
            />
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase">
              {anyOnline ? 'OPERATIONAL' : 'OFFLINE'}
            </span>
          </div>

          {/* Air-Gap Optical Button */}
          {onOpenAirGap && (
            <button
              onClick={onOpenAirGap}
              type="button"
              className="flex items-center gap-2 rounded-xl px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              style={{
                border: '1px solid rgba(245,158,11,0.40)',
                background: 'rgba(245,158,11,0.08)',
                color: isDark ? '#fcd34d' : '#92400e',
              }}
            >
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" style={{ boxShadow: '0 0 6px #fbbf24' }} />
              AIR-GAP OPTICAL
            </button>
          )}

          {/* ── Theme Toggle ─────────────────────────────────────── */}
          <button
            onClick={toggle}
            type="button"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
            style={{
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-sunken)',
              color: 'var(--text-secondary)',
            }}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            <span className="transition-transform duration-300" style={{ display: 'flex', alignItems: 'center' }}>
              {isDark ? <SunIcon /> : <MoonIcon />}
            </span>
          </button>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
            style={{
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-sunken)',
              color: 'var(--text-secondary)',
            }}
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
