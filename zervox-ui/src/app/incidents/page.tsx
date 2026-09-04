'use client'

import { useTelemetry } from '@/context/TelemetryContext'
import { GlassBoxVisualizer } from '@/components/dashboard/GlassBoxVisualizer'
import { IncidentTable } from '@/components/dashboard/IncidentTable'
import { Badge } from '@/components/ui/Badge'

export default function IncidentsPage() {
  const { incidents, primary, backup, isInitializing } = useTelemetry()

  const latestForensicIncident =
    incidents.find((inc) => inc.evidence_hash || inc.forensic_snapshot_id) ??
    incidents[0] ??
    null
  const evidenceHash =
    latestForensicIncident?.evidence_hash ??
    latestForensicIncident?.forensic_snapshot_id ??
    null

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Incident Control & Remediation Trail
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            End-to-end glass box root-cause diagnosis, tamper-evident cryptographic Merkle ledger, and remediation timeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="sky" size="md">
            {incidents.length} TOTAL RECORDS
          </Badge>
          <Badge variant="green" size="md">
            SQLITE WAL ACTIVE
          </Badge>
        </div>
      </div>

      {/* ── SECTION 1: GLASS BOX ROOT CAUSE TRAIL ─────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Glass Box Root Cause Trail
          </h2>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            4-step deterministic vs AI reasoning verification
          </span>
        </div>
        <GlassBoxVisualizer
          latestIncident={latestForensicIncident}
          evidenceHash={evidenceHash}
        />
      </section>

      {/* ── SECTION 2: REMEDIATION TIMELINE & AUDIT LOG ───────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Remediation Timeline & Evidence Ledger
          </h2>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Unconstrained vertical audit view
          </span>
        </div>
        <IncidentTable
          incidents={incidents}
          isLoading={!isInitializing && (primary.isOnline || backup.isOnline)}
        />
      </section>
    </div>
  )
}
