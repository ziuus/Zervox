'use client'

import { useState } from 'react'

interface PolicyFirewallModalProps {
  isOpen: boolean
  onClose: () => void
  onTriggerSimulatedAttack?: () => Promise<void>
}

export function PolicyFirewallModal({ isOpen, onClose, onTriggerSimulatedAttack }: PolicyFirewallModalProps) {
  const [activeTab, setActiveTab] = useState<'diff' | 'rego' | 'audit'>('diff')
  const [isFiring, setIsFiring] = useState(false)

  if (!isOpen) return null

  const handleSimulate = async () => {
    setIsFiring(true)
    try {
      await onTriggerSimulatedAttack?.()
    } finally {
      setIsFiring(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in-up">
      <div
        className="w-full max-w-2xl rounded-2xl p-6 surface-elevated border font-mono space-y-5 shadow-2xl relative overflow-hidden"
        style={{ borderColor: 'rgba(239,68,68,0.5)' }}
      >
        {/* Red Warning Header Band */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 animate-pulse" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-lg shadow-[0_0_15px_rgba(239,68,68,0.4)]">
              🛡️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-red-400">
                  ACTION BLOCKED BY POLICY FIREWALL
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-red-500/20 border border-red-500/40 text-red-300">
                  REGO ENFORCED
                </span>
              </div>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Kerala Police Cyberdome Immutable Safety Gate · Zero-Trust Blast Ceiling
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs p-1 opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
          {[
            { id: 'diff' as const, label: 'ATTEMPTED VS BLOCKED DIFF' },
            { id: 'rego' as const, label: 'REGO RULE: REG-001' },
            { id: 'audit' as const, label: 'CRYPTOGRAPHIC AUDIT PROOF' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'diff' && (
          <div className="space-y-3">
            {/* Diff View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Proposed (Strikethrough) */}
              <div className="rounded-xl p-3.5 border bg-red-950/25 border-red-500/30 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-red-500/20">
                  <span className="text-[10px] font-bold uppercase text-red-400">Proposed Autonomous Action</span>
                  <span className="text-[9px] font-extrabold text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">DENIED ✕</span>
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  <p className="line-through text-red-300 font-bold">
                    kubectl delete namespace default
                  </p>
                  <p className="text-[10px] text-red-400/80">Action: dangerous_action</p>
                  <p className="text-[10px] text-red-400/80">Target: namespace/default/default</p>
                  <p className="text-[10px] text-red-400/80">Blast Radius: UNRESTRICTED (CLUSTER-WIDE DESTRUCTION)</p>
                </div>
              </div>

              {/* Allowed Safe Alternative */}
              <div className="rounded-xl p-3.5 border bg-emerald-950/20 border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/20">
                  <span className="text-[10px] font-bold uppercase text-emerald-400">Enforced Safe Boundary</span>
                  <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">ALLOWED ✔</span>
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  <p className="text-emerald-300 font-bold">
                    QUARANTINE_ISOLATE + RESTART_POD
                  </p>
                  <p className="text-[10px] text-emerald-400/80">Bounded Scope: victim-api pod container only</p>
                  <p className="text-[10px] text-emerald-400/80">Pre-Remediation: Forensic Freeze frame sealed</p>
                  <p className="text-[10px] text-emerald-400/80">Namespace Preservation: 100% Guaranteed</p>
                </div>
              </div>
            </div>

            {/* Violation Details */}
            <div className="p-3.5 rounded-xl border bg-black/40 border-red-500/30 space-y-1 text-xs">
              <p className="text-[10px] uppercase font-bold text-red-400">Firing Rule Violation Message</p>
              <p className="text-red-200 text-[11px] leading-relaxed">
                &quot;CRITICAL: Namespace deletion is absolutely prohibited during autonomous execution. Action rejected by OPA policy gate before Kubernetes client API execution.&quot;
              </p>
            </div>
          </div>
        )}

        {activeTab === 'rego' && (
          <div className="rounded-xl p-4 bg-black/60 border border-white/10 text-xs font-mono space-y-2 overflow-x-auto">
            <div className="flex justify-between text-[10px] text-slate-400 pb-2 border-b border-white/10">
              <span>POLICY FILE: /policies/authz.rego</span>
              <span className="text-emerald-400">COMPILED OPA v0.68</span>
            </div>
            <pre className="text-slate-300 text-[11px] leading-relaxed selection:bg-red-500/40">
{`package zervox.authz

default allow = false

# Rule ID: REG-001 (Blast Ceiling Guard)
deny[msg] {
    input.action == "delete_namespace"
    msg := "CRITICAL: Namespace deletion is absolutely prohibited during autonomous execution."
}

# Rule ID: REG-002 (Forensic Freeze Guarantee)
deny[msg] {
    input.action == "restart_pod"
    not input.evidence_hash
    msg := "FORENSIC INTEGRITY: Pod remediation forbidden without sealed evidence hash."
}

allow {
    count(deny) == 0
}`}
            </pre>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="rounded-xl p-4 bg-black/40 border border-white/10 text-xs space-y-2">
            <p className="text-[10px] uppercase font-bold text-slate-400">Cryptographic Interception Audit</p>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Decision ID:</span>
                <span className="font-mono text-sky-400">opa-dec-8f4b1e99a3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Policy Hash:</span>
                <span className="font-mono text-purple-400">sha256:d6b9f2910a3c9...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Execution Blocked At:</span>
                <span className="font-bold text-emerald-400">Zero K8s API calls transmitted</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Kerala Police Evidentiary Log:</span>
                <span className="text-slate-300">Recorded into SQLite WAL incident chain</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            type="button"
            disabled={isFiring}
            onClick={handleSimulate}
            className="rounded-xl px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-300 border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {isFiring ? 'INTERCEPTING LIVE…' : '⚡ LIVE REPLAY: TRIGGER ATTACK INTERCEPTION'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-slate-700 hover:bg-slate-600 text-white transition-all cursor-pointer"
          >
            CLOSE THEATER
          </button>
        </div>
      </div>
    </div>
  )
}
