'use client'

import { useState } from 'react'

interface ForensicFreezeFrameProps {
  onTriggerLiveFreeze?: () => Promise<void>
}

type FreezeStage = 'idle' | 'threat_detected' | 'flashing_freeze' | 'hashing' | 'evidence_sealed' | 'remediated'

export function ForensicFreezeFrame({ onTriggerLiveFreeze }: ForensicFreezeFrameProps) {
  const [stage, setStage] = useState<FreezeStage>('idle')
  const [hashProgress, setHashProgress] = useState('')
  const [targetPod, setTargetPod] = useState('victim-api-6d7c8f')

  const runLiveFreezeDemo = async () => {
    setStage('threat_detected')
    setTargetPod(`victim-api-${Math.random().toString(36).substring(2, 8)}`)

    // Stage 1: Threat detected
    setTimeout(() => {
      setStage('flashing_freeze')
    }, 1200)

    // Stage 2: Flashing freeze & dump
    setTimeout(() => {
      setStage('hashing')
      setHashProgress('sha256:calculating_merkle_root...')
      let i = 0
      const timer = setInterval(() => {
        i++
        setHashProgress(`sha256:${Math.random().toString(16).substring(2, 14)}${Math.random().toString(16).substring(2, 14)}`)
        if (i > 5) clearInterval(timer)
      }, 200)
    }, 2800)

    // Stage 3: Evidence sealed
    setTimeout(async () => {
      setStage('evidence_sealed')
      if (onTriggerLiveFreeze) {
        await onTriggerLiveFreeze()
      }
    }, 4500)

    // Stage 4: Auto-remediation executed
    setTimeout(() => {
      setStage('remediated')
    }, 6500)
  }

  const reset = () => {
    setStage('idle')
    setHashProgress('')
  }

  return (
    <div
      className={`rounded-2xl p-5 border font-mono surface-elevated transition-all duration-500 relative overflow-hidden ${
        stage === 'flashing_freeze'
          ? 'ring-4 ring-purple-400 bg-purple-950/40 shadow-[0_0_35px_rgba(168,85,247,0.4)]'
          : stage === 'evidence_sealed'
          ? 'border-emerald-500/50'
          : 'border-[var(--border-medium)]'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 text-sm">
            📸
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                Forensic Freeze Frame
              </h3>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-purple-500/20 border border-purple-500/40 text-purple-300">
                PRE-REMEDIATION LOCK
              </span>
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Immutable Evidence Snapshot: Cause → Freeze → Cure in &lt;10s
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stage === 'idle' || stage === 'remediated' ? (
            <button
              type="button"
              onClick={runLiveFreezeDemo}
              className="rounded-xl px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-200 border border-purple-400/50 bg-purple-500/20 hover:bg-purple-500/30 transition-all cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.2)] hover:scale-105 active:scale-95"
            >
              ⚡ RUN LIVE FREEZE DEMO
            </button>
          ) : (
            <span className="text-[10px] font-bold text-purple-300 animate-pulse">
              EXECUTING FREEZE PIPELINE…
            </span>
          )}
        </div>
      </div>

      {/* Stage Sequence Progress Bar */}
      <div className="grid grid-cols-4 gap-2 pt-2 text-[9px] uppercase font-bold text-center">
        {[
          { key: 'threat_detected', label: '1. THREAT DETECTED', active: stage !== 'idle' },
          { key: 'flashing_freeze', label: '2. MEMORY FROZEN', active: ['flashing_freeze', 'hashing', 'evidence_sealed', 'remediated'].includes(stage) },
          { key: 'evidence_sealed', label: '3. EVIDENCE SEALED ✔', active: ['evidence_sealed', 'remediated'].includes(stage) },
          { key: 'remediated', label: '4. POD CURED (OPA APPROVED)', active: stage === 'remediated' },
        ].map(st => (
          <div
            key={st.key}
            className={`py-1.5 px-2 rounded-lg border transition-all ${
              st.active
                ? 'bg-purple-500/20 border-purple-400/40 text-purple-200 shadow-[0_0_8px_rgba(168,85,247,0.2)]'
                : 'border-white/5 opacity-40 text-slate-500'
            }`}
          >
            {st.label}
          </div>
        ))}
      </div>

      {/* Visual Pod Card */}
      <div className="mt-3 p-4 rounded-xl border relative" style={{ background: 'var(--bg-sunken)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">TARGET POD:</span>
              <span className="text-xs font-mono font-bold text-sky-400">{targetPod}</span>
              <span className="text-[10px] text-slate-500">(namespace: default)</span>
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
              Incident: <span className="font-semibold text-rose-400">PodCrashLooping (OOMKilled at cgroup limit)</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {stage === 'idle' && (
              <span className="text-[10px] px-2.5 py-1 rounded-full border border-slate-500/30 text-slate-400">
                POD RUNNING (UNPROTECTED)
              </span>
            )}
            {stage === 'threat_detected' && (
              <span className="text-[10px] px-2.5 py-1 rounded-full border border-rose-500/40 bg-rose-500/20 text-rose-300 animate-pulse">
                CRASH LOOP DETECTED
              </span>
            )}
            {stage === 'flashing_freeze' && (
              <span className="text-[10px] px-2.5 py-1 rounded-full border border-purple-400 bg-purple-500/30 text-purple-200 animate-ping">
                📸 SNAPSHOTTING /proc &amp; SOCKETS
              </span>
            )}
            {(stage === 'hashing' || stage === 'evidence_sealed') && (
              <span className="text-[10px] px-2.5 py-1 rounded-full border border-emerald-400 bg-emerald-500/20 text-emerald-300 font-extrabold shadow-[0_0_10px_#34d399]">
                EVIDENCE SEALED ✔
              </span>
            )}
            {stage === 'remediated' && (
              <span className="text-[10px] px-2.5 py-1 rounded-full border border-sky-400 bg-sky-500/20 text-sky-300 font-extrabold">
                REMEDIATED &amp; SERVICE RESTORED
              </span>
            )}
          </div>
        </div>

        {/* Live Hash & Rego Guarantee banner */}
        {(stage === 'hashing' || stage === 'evidence_sealed' || stage === 'remediated') && (
          <div className="mt-3 pt-3 border-t border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="text-purple-400 font-bold">MERKLE ROOT:</span>
              <span className="font-mono text-purple-300 select-all break-all">
                {hashProgress || 'sha256:8f2c3a91e4b85d70f1a92e3c4b5a6971c2'}
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold whitespace-nowrap">
              OPA RULE GUARANTEE: remediate == true (evidence_hash sealed)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
