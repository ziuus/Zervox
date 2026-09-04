'use client'

import { useTelemetry } from '@/context/TelemetryContext'
import { ForensicFreezeFrame } from '@/components/dashboard/ForensicFreezeFrame'
import { AirGapBeacon } from '@/components/dashboard/AirGapBeacon'
import { Card, CardLabel } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

function SectionLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="hr-gradient flex-1" />
      <div className="text-right shrink-0">
        <p className="font-mono text-xs font-extrabold uppercase tracking-[0.25em]" style={{ color: 'var(--text-primary)' }}>
          {title}
        </p>
        <p className="font-mono text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
      </div>
    </div>
  )
}

export default function ForensicsPage() {
  const {
    triggerChaosScenario,
    setIsAirGapOpen,
    setIsPolicyModalOpen,
    activeInstance,
    incidents,
  } = useTelemetry()

  const latestForensicIncident =
    incidents.find((i) => i.forensic_snapshot_id || i.evidence_hash) ??
    incidents[0] ??
    null

  const evidenceHash =
    latestForensicIncident?.evidence_hash ??
    latestForensicIncident?.forensic_snapshot_id ??
    '4df49dedbf93917714590866cd5077a6560530a9ef37a0a665ab321843f02fef'

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl text-base" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)' }}>
              📸
            </span>
            <h1 className="font-mono text-lg font-black uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              Air-Gap Defense & Forensic Freeze Vault
            </h1>
          </div>
          <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Cryptographic pre-remediation snapshots, optical zero-egress data diodes, and tamper-proof evidence preservation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Optical Data Diode Trigger */}
          <button
            type="button"
            onClick={() => setIsAirGapOpen(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
            style={{
              border: '1px solid rgba(245,158,11,0.40)',
              background: 'rgba(245,158,11,0.10)',
              color: '#d97706',
            }}
          >
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Launch Optical QR Diode</span>
          </button>

          {/* OPA Policy Gate Trigger */}
          <button
            type="button"
            onClick={() => setIsPolicyModalOpen(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
            style={{
              border: '1px solid rgba(239,68,68,0.40)',
              background: 'rgba(239,68,68,0.10)',
              color: '#dc2626',
            }}
          >
            <span>🛡️</span>
            <span>Inspect OPA Rego Diff</span>
          </button>
        </div>
      </div>

      {/* ── SECTION 1: FORENSIC FREEZE FRAME SHOWCASE ─────────── */}
      <section>
        <SectionLabel
          title="FORENSIC FREEZE FRAME"
          subtitle="Pre-Remediation Lock · /proc Ephemeral State Preservation"
        />
        <ForensicFreezeFrame
          onTriggerLiveFreeze={() => triggerChaosScenario('pod_crash')}
        />
      </section>

      {/* ── SECTION 2: AIR-GAP TRANSMISSION & ATTESTATION ─────── */}
      <section>
        <SectionLabel
          title="OPTICAL AIR-GAP TRANSMISSION & ATTESTATION"
          subtitle="Physical Data Diodes · Zero WAN Footprint · Ed25519 Continuous Proof"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Optical QR Data Diode */}
          <Card className="p-5 flex flex-col justify-between hover:-translate-y-0.5 transition-transform duration-200">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">📡</span>
                <Badge variant="amber" dot>OPTICAL DIODE</Badge>
              </div>
              <CardLabel>One-Way Optical Bridge</CardLabel>
              <h3 className="font-mono text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                Scannable QR Telemetry
              </h3>
              <p className="font-mono text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                Transmits real-time incident root-cause and SHA-256 Merkle hashes via camera-scannable QR payloads without network cables.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setIsAirGapOpen(true)}
                className="w-full py-2 rounded-xl font-mono text-xs font-bold uppercase tracking-wider text-center transition-all hover:scale-[1.02] cursor-pointer"
                style={{
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.35)',
                  color: '#d97706',
                }}
              >
                Open Fullscreen Beacon →
              </button>
            </div>
          </Card>

          {/* Card 2: Ed25519 Zero-Egress Proof */}
          <Card className="p-5 flex flex-col justify-between hover:-translate-y-0.5 transition-transform duration-200">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">🔐</span>
                <Badge variant="sky" dot>ZERO-EGRESS PROOF</Badge>
              </div>
              <CardLabel>Continuous Cryptographic Attestation</CardLabel>
              <h3 className="font-mono text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                Ed25519 Signature Beacon
              </h3>
              <p className="font-mono text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                Hardware socket counters verify zero unauthorized outbound packets. Rotary signature attestation changes every 3 seconds.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <AirGapBeacon />
            </div>
          </Card>

          {/* Card 3: Cryptographic Merkle Root Vault */}
          <Card className="p-5 flex flex-col justify-between hover:-translate-y-0.5 transition-transform duration-200">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">🛡️</span>
                <Badge variant="green" dot>MERKLE INTEGRITY</Badge>
              </div>
              <CardLabel>Tamper-Evident Ledger</CardLabel>
              <h3 className="font-mono text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                Latest Evidence Hash
              </h3>
              <p className="font-mono text-xs mt-2 truncate text-ellipsis" style={{ color: 'var(--text-secondary)' }}>
                sha256:{evidenceHash}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setIsPolicyModalOpen(true)}
                className="w-full py-2 rounded-xl font-mono text-xs font-bold uppercase tracking-wider text-center transition-all hover:scale-[1.02] cursor-pointer"
                style={{
                  background: 'var(--accent-subtle)',
                  border: '1px solid var(--accent-border)',
                  color: 'var(--text-primary)',
                }}
              >
                Inspect OPA Policy Audit →
              </button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
