'use client'

import { useState, useEffect } from 'react'
import type { IncidentRecord } from '@/types/api'

interface ReasoningNode {
  step: number
  title: string
  detail: string
  confidence?: number
  status: 'verified' | 'analyzing' | 'rerouted' | 'executed'
  branch?: 'ai' | 'fallback'
}

interface GlassBoxVisualizerProps {
  evidenceHash?: string | null
  latestIncident?: IncidentRecord | null
}

export function GlassBoxVisualizer({ evidenceHash, latestIncident }: GlassBoxVisualizerProps = {}) {
  const [activeBranch, setActiveBranch] = useState<'ai' | 'fallback'>('ai')
  const [isSimulating, setIsSimulating] = useState(false)
  const [currentStep, setCurrentStep] = useState(4)
  const [fetchedHash, setFetchedHash] = useState<string | null>(null)

  // Fetch real forensic evidence package if hash is not directly supplied
  useEffect(() => {
    if (evidenceHash) {
      setFetchedHash(evidenceHash)
      return
    }
    const incidentId = latestIncident?.id
    if (!incidentId) return

    let isMounted = true
    fetch(`/api/incidents/${incidentId}/forensics`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.sha256_hash) {
          setFetchedHash(data.sha256_hash)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [evidenceHash, latestIncident?.id])

  const resolvedEvidenceHash =
    fetchedHash ??
    evidenceHash ??
    latestIncident?.evidence_hash ??
    latestIncident?.forensic_snapshot_id ??
    '9fcf8296446f28f5352db7714b59c83a40e29b91263bc656ab4530d486623ab5'

  const aiNodes: ReasoningNode[] = [
    {
      step: 1,
      title: 'Alert Ingest & Correlation',
      detail: `Received ${latestIncident?.alert_name ?? 'PodCrashLooping'} alert from k3s prometheus. Pod ${latestIncident?.target_resource ?? 'victim-api-6d7c8f'} terminating with exit code 137 (OOMKilled).`,
      confidence: 99,
      status: 'verified',
      branch: 'ai',
    },
    {
      step: 2,
      title: 'Hypothesis Formulation',
      detail: 'Hypothesis: Memory leak during batch payload ingestion caused cgroup memory limit saturation. Requires pod restart with pre-freeze.',
      confidence: 94,
      status: 'verified',
      branch: 'ai',
    },
    {
      step: 3,
      title: 'Forensic Snapshot Gate',
      detail: `Condition verified: evidence_hash = sha256:${resolvedEvidenceHash.slice(0, 16)}… Ephemeral debug container attach captured /proc/memory and socket table into Merkle vault.`,
      confidence: 100,
      status: 'verified',
      branch: 'ai',
    },
    {
      step: 4,
      title: 'Remediation Synthesis',
      detail: `Action: ${latestIncident?.action_type ?? 'restart_pod'}. Blast radius check: non-stateful deployment. Sub-second execution approved.`,
      confidence: 96,
      status: 'executed',
      branch: 'ai',
    },
  ]

  const fallbackNodes: ReasoningNode[] = [
    {
      step: 1,
      title: 'Alert Ingest',
      detail: 'Alert PodCrashLooping detected on victim-api-6d7c8f.',
      status: 'verified',
      branch: 'fallback',
    },
    {
      step: 2,
      title: 'LLM Latency Gate (Hard 10s Timeout)',
      detail: 'LLM connection deadline exceeded / air-gap isolated. Rerouting to deterministic rule engine.',
      status: 'rerouted',
      branch: 'fallback',
    },
    {
      step: 3,
      title: 'Deterministic Rule Table Match',
      detail: 'RULE-04 fired: PodCrashLooping + exitCode 137 → Action: restart_pod. Latency: 1.2ms (Zero external calls).',
      confidence: 100,
      status: 'verified',
      branch: 'fallback',
    },
    {
      step: 4,
      title: 'OPA Policy Enforcement',
      detail: 'Rego policy verified. Action permitted under blast-radius threshold.',
      status: 'executed',
      branch: 'fallback',
    },
  ]

  const runSimulation = (branch: 'ai' | 'fallback') => {
    setActiveBranch(branch)
    setIsSimulating(true)
    setCurrentStep(1)
    let s = 1
    const interval = setInterval(() => {
      s++
      setCurrentStep(s)
      if (s >= 4) {
        clearInterval(interval)
        setIsSimulating(false)
      }
    }, 600)
  }

  const nodes = activeBranch === 'ai' ? aiNodes : fallbackNodes

  return (
    <div className="rounded-2xl p-5 surface-elevated border font-mono space-y-4" style={{ borderColor: 'var(--border-medium)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 text-sm">
            🧠
          </span>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              Glass Box Root Cause Trail
            </h3>
            <p className="text-xs text-slate-300 font-medium" style={{ color: 'var(--text-secondary)' }}>
              LLM Reasoning Chain &amp; Deterministic Fallback Visualizer
            </p>
          </div>
        </div>

        {/* Mode Toggle Pills */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={() => runSimulation('ai')}
            className={`rounded-lg px-3 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer ${
              activeBranch === 'ai'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-400/40 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            AI REASONING GRAPH
          </button>
          <button
            type="button"
            onClick={() => runSimulation('fallback')}
            className={`rounded-lg px-3 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer ${
              activeBranch === 'fallback'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            ⚡ FALLBACK REROUTE
          </button>
        </div>
      </div>

      {/* Narrative status bar */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${activeBranch === 'ai' ? 'bg-sky-400' : 'bg-amber-400'} animate-pulse`} />
          <span className="text-slate-200 font-medium" style={{ color: 'var(--text-secondary)' }}>
            {activeBranch === 'ai'
              ? 'LLM DECISION GRAPH: 4-step chain-of-thought verification with confidence validation'
              : 'DETERMINISTIC FAILOVER: LLM timeout intercepted — 1.2ms local rule-table execution'}
          </span>
        </div>
        {isSimulating && (
          <span className="text-[11px] font-bold text-sky-300 animate-pulse">STREAMING DECISION GRAPH…</span>
        )}
      </div>

      {/* Decision Graph Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative pt-2">
        {nodes.map((n) => {
          const isVisible = n.step <= currentStep
          const isCurrent = n.step === currentStep && isSimulating

          return (
            <div
              key={n.step}
              className={`rounded-xl p-3.5 transition-all duration-300 border flex flex-col justify-between gap-2 ${
                !isVisible ? 'opacity-30 translate-y-2' : 'opacity-100 translate-y-0'
              } ${isCurrent ? 'ring-2 ring-sky-400' : ''}`}
              style={{
                background: n.status === 'rerouted' ? 'rgba(245,158,11,0.08)' : 'var(--bg-sunken)',
                borderColor: n.status === 'rerouted' ? 'rgba(245,158,11,0.4)' : isVisible ? 'var(--border-medium)' : 'var(--border-subtle)',
              }}
            >
              <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: activeBranch === 'ai' ? 'var(--accent)' : 'var(--status-amber)' }}>
                  STEP 0{n.step}
                </span>
                {n.confidence && (
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    {n.confidence}% CONF
                  </span>
                )}
                {n.status === 'rerouted' && (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40 animate-pulse">
                    ⚡ REROUTED
                  </span>
                )}
              </div>

              <div>
                <p className="text-xs font-bold leading-tight text-slate-100" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                <p className="text-xs mt-1.5 leading-relaxed text-slate-200 font-normal" style={{ color: 'var(--text-secondary)' }}>{n.detail}</p>
                {activeBranch === 'ai' && n.step === 3 && (
                  <div className="mt-2 rounded-lg border border-purple-500/40 bg-purple-950/30 p-2 font-mono text-[9px]">
                    <div className="flex items-center justify-between text-purple-300 font-bold uppercase tracking-wider mb-1">
                      <span>SHA-256 MERKLE ROOT</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-200">SEALED</span>
                    </div>
                    <p className="break-all font-mono font-semibold text-purple-200 select-all" title={resolvedEvidenceHash}>
                      sha256:{resolvedEvidenceHash}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-1 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-medium" style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span className={`font-bold tracking-wider ${n.status === 'executed' ? 'text-emerald-300' : n.status === 'rerouted' ? 'text-amber-300' : 'text-sky-300'}`}>
                  {n.status.toUpperCase()}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
