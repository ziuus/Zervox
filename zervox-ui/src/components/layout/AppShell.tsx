'use client'

import React from 'react'
import { TelemetryProvider, useTelemetry } from '@/context/TelemetryContext'
import { Header } from '@/components/dashboard/Header'
import { PolicyFirewallModal } from '@/components/dashboard/PolicyFirewallModal'
import { AirGapOpticalModal } from '@/components/dashboard/AirGapOpticalModal'

function InnerShell({ children }: { children: React.ReactNode }) {
  const {
    primary,
    backup,
    activeInstance,
    incidents,
    isAirGapOpen,
    setIsAirGapOpen,
    isPolicyModalOpen,
    setIsPolicyModalOpen,
    triggerChaosScenario,
    refetch,
    isInitializing,
  } = useTelemetry()

  const hardwareStatus = activeInstance.status?.hardware_breaker_status

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      {/* Noise overlay */}
      <div className="noise-layer" />

      {/* Background depth auroras */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full blur-[130px]"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -right-20 h-[500px] w-[500px] rounded-full blur-[140px]"
          style={{ background: 'radial-gradient(circle, rgba(147,51,234,0.04) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 left-10 h-[450px] w-[450px] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)' }}
        />
        <div className="bg-grid absolute inset-0" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        {/* Persistent Header with Navigation */}
        <Header
          primaryOnline={primary.isOnline}
          backupOnline={backup.isOnline}
          lastUpdated={primary.lastUpdated ?? backup.lastUpdated}
          onRefresh={refetch}
          onOpenAirGap={() => setIsAirGapOpen(true)}
          hardwareStatus={hardwareStatus}
        />

        {/* Initializing Banner */}
        {isInitializing && (
          <div className="mx-auto w-full max-w-screen-2xl px-6 pt-4">
            <div
              className="flex items-center gap-3 rounded-2xl px-5 py-3 animate-slide-down"
              style={{
                border: '1px solid var(--accent-border)',
                background: 'var(--accent-subtle)',
              }}
            >
              <span className="h-2.5 w-2.5 animate-ping rounded-full" style={{ background: 'var(--accent)' }} />
              <span className="font-mono text-xs font-bold tracking-widest" style={{ color: 'var(--accent)' }}>
                CONNECTING TO ZERVOX CORE SRE TELEMETRY DOCK…
              </span>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="mx-auto w-full max-w-screen-2xl px-6 py-6 flex-1 flex flex-col">
          {children}
        </main>

        {/* Persistent Footer */}
        <footer
          className="relative z-10 py-4 text-center"
          style={{
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--header-bg)',
          }}
        >
          <p className="font-mono text-[10px] tracking-wider" style={{ color: 'var(--text-muted)' }}>
            ZERVOX SRE ENGINE v{activeInstance.status?.version ?? '0.1.0'} · KERALA POLICE CYBERDOME ·{' '}
            <span style={{ color: 'var(--accent)' }} className="font-semibold">AUTONOMOUS CYBER RESILIENCE</span>
          </p>
        </footer>
      </div>

      {/* Global Modals */}
      <PolicyFirewallModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        onTriggerSimulatedAttack={() => triggerChaosScenario('rbac_attack')}
      />

      <AirGapOpticalModal
        isOpen={isAirGapOpen}
        onClose={() => setIsAirGapOpen(false)}
        activeInstance={activeInstance}
        incidents={incidents}
      />
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TelemetryProvider>
      <InnerShell>{children}</InnerShell>
    </TelemetryProvider>
  )
}
