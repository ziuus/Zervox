'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/ui/ThemeProvider'
import { PulseRing } from '@/components/ui/PulseRing'
import { AirGapBeacon } from '@/components/dashboard/AirGapBeacon'

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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const anyOnline = primaryOnline || backupOnline
  const isDark = theme === 'dark'

  const navLinks = [
    { href: '/', label: 'Overview', icon: '🌐' },
    { href: '/incidents', label: 'Incidents', icon: '🚨' },
    { href: '/forensics', label: 'Forensics & Air-Gap', icon: '📸' },
    { href: '/chaos', label: 'Chaos Sandbox', icon: '⚡' },
  ]

  return (
    <header
      className="sticky top-0 z-50 transition-all border-b"
      style={{
        background: 'var(--header-bg)',
        borderColor: 'var(--border-subtle)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* ── TOP HEADER: Brand & Clean Navigation ───────────────── */}
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-2.5">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm transition-transform group-hover:scale-105"
              style={{
                background: 'var(--accent-subtle)',
                border: '1px solid var(--accent-border)',
                color: 'var(--accent)',
              }}
            >
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base tracking-tight text-slate-900 dark:text-slate-100">
                  Zervox
                </span>
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                  style={{
                    background: 'var(--bg-sunken)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  SRE
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Center: Clean Linear/Vercel Style Navigation Tabs */}
        <nav className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--bg-sunken)' }}>
          {navLinks.map(({ href, label, icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold shadow-sm border border-slate-200 dark:border-slate-700/60'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <span className="text-xs">{icon}</span>
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          {/* Operational status badge */}
          <div
            className="flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium"
            style={{
              background: anyOnline ? 'var(--status-green-bg)' : 'var(--status-red-bg)',
              border: `1px solid ${anyOnline ? 'var(--status-green-bdr)' : 'var(--status-red-bdr)'}`,
              color: anyOnline ? 'var(--status-green)' : 'var(--status-red)',
            }}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${anyOnline ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}
            />
            <span className="text-[11px] font-medium">
              {anyOnline ? 'Operational' : 'Offline'}
            </span>
          </div>

          {/* Sync Button */}
          <button
            onClick={onRefresh}
            type="button"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all cursor-pointer"
            title="Poll fresh telemetry"
          >
            <span className="text-xs">↻</span>
            <span className="hidden sm:inline text-[11px]">Sync</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggle}
            type="button"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all cursor-pointer"
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      {/* ── SECONDARY SUB-HEADER: System Telemetry & Attestation Bar ── */}
      <div
        className="px-6 py-1.5 border-t text-xs flex flex-wrap items-center justify-between gap-3 text-slate-500 dark:text-slate-400"
        style={{
          background: 'var(--bg-sunken)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Left: Node Health Summary */}
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <PulseRing online={primaryOnline} size="sm" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Primary Node:</span>
            <span className={primaryOnline ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-500'}>
              {primaryOnline ? 'Active' : 'Offline'}
            </span>
          </div>

          <span className="text-slate-300 dark:text-slate-700">•</span>

          <div className="flex items-center gap-1.5">
            <PulseRing online={backupOnline} size="sm" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Backup Node:</span>
            <span className={backupOnline ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-amber-500'}>
              {backupOnline ? 'Standby' : 'Dormant'}
            </span>
          </div>

          <span className="text-slate-300 dark:text-slate-700 hidden md:inline">•</span>

          <span className="hidden md:inline text-slate-500 dark:text-slate-400 font-mono text-[10px]">
            mTLS Tunnel: TCP 9000
          </span>
        </div>

        {/* Right: Air-Gap Attestation, Hardware Guard & Sync Time */}
        <div className="flex items-center gap-3 text-[11px]">
          {/* Air-Gap Beacon Pill */}
          <div className="flex items-center gap-1.5">
            <AirGapBeacon />
          </div>

          {/* Hardware Breaker */}
          {hardwareStatus && (
            <span
              className="hidden lg:inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: 'rgba(168,85,247,0.08)',
                border: '1px solid rgba(168,85,247,0.25)',
                color: isDark ? '#c4b5fd' : '#7c3aed',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              {hardwareStatus.includes('ARMED') ? 'RISC-V ESP32 Armed' : 'HW Standalone'}
            </span>
          )}

          {/* Sync Time */}
          {lastUpdated && (
            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
              Sync: {lastUpdated.toLocaleTimeString()}
            </span>
          )}

          {/* Air-Gap Optical Modal Trigger */}
          {onOpenAirGap && (
            <button
              onClick={onOpenAirGap}
              type="button"
              className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Optical Diode
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
