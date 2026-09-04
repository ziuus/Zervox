'use client'

import { useTelemetry } from '@/context/TelemetryContext'
import { ForensicFreezeFrame } from '@/components/dashboard/ForensicFreezeFrame'
import { AirGapBeacon } from '@/components/dashboard/AirGapBeacon'
import { Card, CardLabel } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export default function ForensicsPage() {
  const {
    triggerChaosScenario,
    setIsAirGapOpen,
    setIsPolicyModalOpen,
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Air-Gap Defense & Forensic Freeze Vault
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Cryptographic pre-remediation snapshots, optical zero-egress data diodes, and tamper-proof evidence preservation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Optical Data Diode Trigger */}
          <button
            type="button"
            onClick={() => setIsAirGapOpen(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 transition-all cursor-pointer shadow-sm"
          >
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Launch Optical QR Diode</span>
          </button>

          {/* OPA Policy Gate Trigger */}
          <button
            type="button"
            onClick={() => setIsPolicyModalOpen(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100/60 dark:hover:bg-rose-900/40 transition-all cursor-pointer shadow-sm"
          >
            <span>🛡️</span>
            <span>Inspect OPA Rego Diff</span>
          </button>
        </div>
      </div>

      {/* ── SECTION 1: FORENSIC FREEZE FRAME SHOWCASE ─────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Forensic Freeze Frame
          </h2>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Pre-remediation state lock & socket dump
          </span>
        </div>
        <ForensicFreezeFrame
          onTriggerLiveFreeze={() => triggerChaosScenario('pod_crash')}
        />
      </section>

      {/* ── SECTION 2: AIR-GAP TRANSMISSION & ATTESTATION ─────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Optical Air-Gap Transmission & Attestation
          </h2>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Zero WAN footprint · Physical data diode
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Optical QR Data Diode */}
          <Card className="p-6 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">📡</span>
                <Badge variant="amber" dot>OPTICAL DIODE</Badge>
              </div>
              <CardLabel>One-Way Optical Bridge</CardLabel>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                Scannable QR Telemetry
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Transmits real-time incident root-cause and SHA-256 Merkle hashes via camera-scannable QR payloads without network cables.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsAirGapOpen(true)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-center transition-all bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 cursor-pointer shadow-sm"
              >
                Open Fullscreen Beacon →
              </button>
            </div>
          </Card>

          {/* Card 2: Ed25519 Zero-Egress Proof */}
          <Card className="p-6 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">🔐</span>
                <Badge variant="sky" dot>ZERO-EGRESS PROOF</Badge>
              </div>
              <CardLabel>Continuous Cryptographic Attestation</CardLabel>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                Ed25519 Signature Beacon
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Hardware socket counters verify zero unauthorized outbound packets. Rotary signature attestation changes every 3 seconds.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <AirGapBeacon />
            </div>
          </Card>

          {/* Card 3: Cryptographic Merkle Root Vault */}
          <Card className="p-6 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">🛡️</span>
                <Badge variant="green" dot>MERKLE INTEGRITY</Badge>
              </div>
              <CardLabel>Tamper-Evident Ledger</CardLabel>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                Latest Evidence Hash
              </h3>
              <p className="font-mono text-xs text-teal-600 dark:text-teal-400 mt-2 truncate max-w-[240px]" title={evidenceHash}>
                sha256:{evidenceHash}
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsPolicyModalOpen(true)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-center transition-all bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm"
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
