'use client'

import { useTelemetry } from '@/context/TelemetryContext'
import { GlassBoxVisualizer } from '@/components/dashboard/GlassBoxVisualizer'
import { IncidentTable } from '@/components/dashboard/IncidentTable'
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl text-base" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)' }}>
              🚨
            </span>
            <h1 className="font-mono text-lg font-black uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              Incident Control & Remediation Trail
            </h1>
          </div>
          <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            End-to-end glass box root-cause diagnosis, tamper-evident cryptographic Merkle ledger, and remediation timeline.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <Badge variant="sky" size="md">
            {incidents.length} TOTAL RECORDS
          </Badge>
          <Badge variant="green" size="md">
            SQLITE WAL PERSISTED
          </Badge>
        </div>
      </div>

      {/* ── SECTION 1: GLASS BOX ROOT CAUSE TRAIL ─────────────── */}
      <section>
        <SectionLabel
          title="GLASS BOX ROOT CAUSE TRAIL"
          subtitle="4-Step Reasoning Pipeline · AI vs Deterministic Fallback"
        />
        <GlassBoxVisualizer
          latestIncident={latestForensicIncident}
          evidenceHash={evidenceHash}
        />
      </section>

      {/* ── SECTION 2: REMEDIATION TIMELINE & AUDIT LOG ───────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel
            title="REMEDIATION TIMELINE"
            subtitle="Immutable Audit Vault · Evidence Chain of Custody"
          />
        </div>
        <IncidentTable
          incidents={incidents}
          isLoading={!isInitializing && (primary.isOnline || backup.isOnline)}
        />
      </section>
    </div>
  )
}
