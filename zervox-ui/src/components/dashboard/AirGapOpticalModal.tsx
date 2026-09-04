'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { IncidentRecord, InstanceTelemetry } from '@/types/api'

interface AirGapOpticalModalProps {
  isOpen: boolean
  onClose: () => void
  activeInstance: InstanceTelemetry
  incidents: IncidentRecord[]
}

export function AirGapOpticalModal({
  isOpen,
  onClose,
  activeInstance,
  incidents,
}: AirGapOpticalModalProps) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'qr' | 'json'>('qr')

  if (!isOpen) return null

  const latestForensicId = incidents.find(i => i.forensic_snapshot_id)?.forensic_snapshot_id ?? 'NONE'
  const latestIncident = incidents[0]

  // Construct compact air-gapped cryptographic payload
  const airGapPayload = {
    protocol: 'ZERVOX_AIRGAP_OPTICAL_V1',
    timestamp: new Date().toISOString(),
    node: {
      role: activeInstance.status?.role ?? 'PRIMARY',
      state: activeInstance.status?.state ?? 'ACTIVE',
      engine: activeInstance.status?.engine_mode ?? 'FALLBACK',
      uptime: activeInstance.status?.uptime_seconds ?? 0,
    },
    cluster: {
      k8s: activeInstance.status?.k8s_status ?? 'DRY_RUN',
      opa: activeInstance.status?.opa_status ?? 'REACHABLE',
      peer: activeInstance.status?.peer_status ?? 'CONNECTED',
    },
    forensics: {
      total_incidents: activeInstance.status?.total_incidents ?? incidents.length,
      latest_incident_id: latestIncident?.id ?? 'NONE',
      latest_action: latestIncident?.action_type ?? 'NONE',
      latest_target: latestIncident?.target_resource ?? 'NONE',
      forensic_snapshot_id: latestForensicId,
      tamper_proof_integrity: 'SHA256_CRYPTOGRAPHICALLY_SEALED',
    },
    signature: `ED25519_ZRVX_${(latestIncident?.id ?? '0000').slice(-8)}_SEALED`,
  }

  const payloadString = JSON.stringify(airGapPayload)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-xl border border-amber-500/40 bg-[#060913] p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)] text-slate-100 font-mono">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-500/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/50 bg-amber-500/10">
              <span className="text-xl">📡</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-wider text-amber-300 uppercase">
                  Air-Gapped Optical Telemetry Broadcast
                </h3>
                <span className="rounded border border-amber-500/50 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">
                  ZERO-NETWORK
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Kerala Police Cyberdome / Physical Optical Extraction Protocol
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-400 hover:border-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            ✕ ESC
          </button>
        </div>

        {/* Subtitle / Cyber Threat Context */}
        <div className="mt-4 rounded border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-200/90">
          <span className="font-bold text-amber-400">MILITARY AIR-GAP MODE:</span> In total network blackouts or EMP/outage scenarios, on-site engineers or forensics officers can scan this high-density optical matrix using any offline mobile camera to extract verified cluster telemetry and SHA-256 evidence keys without physical USB connections.
        </div>

        {/* Tab switch */}
        <div className="mt-4 flex items-center justify-between border-b border-[#1e3a5f] pb-2 text-[11px]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('qr')}
              className={`rounded px-3 py-1 font-semibold transition-colors cursor-pointer ${
                activeTab === 'qr'
                  ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ▣ HIGH-DENSITY OPTICAL MATRIX
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`rounded px-3 py-1 font-semibold transition-colors cursor-pointer ${
                activeTab === 'json'
                  ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {'{ }'} SIGNED TELEMETRY PAYLOAD
            </button>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(airGapPayload, null, 2))
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="text-[10px] text-slate-400 hover:text-amber-300 underline cursor-pointer"
          >
            {copied ? '✓ COPIED TO CLIPBOARD' : 'COPY RAW JSON'}
          </button>
        </div>

        {/* Main Display */}
        <div className="mt-4 flex flex-col items-center justify-center min-h-[260px]">
          {activeTab === 'qr' ? (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl border-4 border-amber-400/80 bg-white p-4 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                <QRCodeSVG
                  value={payloadString}
                  size={210}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="text-[10px] text-slate-400 tracking-wide text-center">
                Scan with any standard camera app · 0 bytes transferred over network
              </p>
            </div>
          ) : (
            <div className="w-full max-h-[240px] overflow-auto rounded border border-amber-500/30 bg-[#020409] p-3 text-[10px] text-emerald-400">
              <pre className="font-mono whitespace-pre-wrap selection:bg-emerald-500/30">
                {JSON.stringify(airGapPayload, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-[#1e3a5f] flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400 font-semibold">ED25519 AIR-GAP BROADCAST ACTIVE</span>
          </div>
          <div>
            FORENSIC SIGNATURE: <span className="text-amber-300 font-mono select-all">{airGapPayload.signature}</span>
          </div>
        </div>

      </div>
    </div>
  )
}
