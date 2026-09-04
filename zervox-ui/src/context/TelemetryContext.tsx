'use client'

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import type { InstanceTelemetry, IncidentRecord, EngineMode } from '@/types/api'

const POLL_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? 2500)

export interface ChaosFeedback {
  title: string
  desc: string
  type: 'success' | 'blocked' | 'info'
}

export interface TelemetryContextValue {
  primary: InstanceTelemetry
  backup: InstanceTelemetry
  activeInstance: InstanceTelemetry
  incidents: IncidentRecord[]
  engineMode: EngineMode | null
  opaStatus: string | null
  k8sStatus: string | null
  peerStatus: string | null
  totalIncidents: number
  uptimeSeconds: number | null
  isInitializing: boolean
  refetch: () => Promise<void>
  
  // Modals
  isAirGapOpen: boolean
  setIsAirGapOpen: (open: boolean) => void
  isPolicyModalOpen: boolean
  setIsPolicyModalOpen: (open: boolean) => void

  // Chaos Actions
  chaosLoading: string | null
  chaosFeedback: ChaosFeedback | null
  setChaosFeedback: (fb: ChaosFeedback | null) => void
  triggerChaosScenario: (scenario: 'pod_crash' | 'rbac_attack' | 'node_cordon' | 'immune_quarantine') => Promise<void>
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null)

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [primary, setPrimary] = useState<InstanceTelemetry>({
    url: 'http://localhost:8080',
    label: 'PRIMARY',
    health: null,
    status: null,
    error: null,
    lastUpdated: null,
    latencyMs: null,
    isOnline: false,
  })

  const [backup, setBackup] = useState<InstanceTelemetry>({
    url: 'http://localhost:8081',
    label: 'BACKUP',
    health: null,
    status: null,
    error: null,
    lastUpdated: null,
    latencyMs: null,
    isOnline: false,
  })

  const [isInitializing, setIsInitializing] = useState(true)
  const [isAirGapOpen, setIsAirGapOpen] = useState(false)
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false)
  const [chaosLoading, setChaosLoading] = useState<string | null>(null)
  const [chaosFeedback, setChaosFeedback] = useState<ChaosFeedback | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()

      if (json.primary) {
        setPrimary({
          ...json.primary,
          lastUpdated: json.primary.lastUpdated ? new Date(json.primary.lastUpdated) : null,
        })
      }
      if (json.backup) {
        setBackup({
          ...json.backup,
          lastUpdated: json.backup.lastUpdated ? new Date(json.backup.lastUpdated) : null,
        })
      }
    } catch (err) {
      console.warn('Telemetry poll error:', err)
    } finally {
      setIsInitializing(false)
    }
  }, [])

  useEffect(() => {
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      clearInterval(interval)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [poll])

  const activeInstance =
    primary.health?.state === 'active'
      ? primary
      : backup.health?.state === 'active'
        ? backup
        : primary

  const incidents =
    activeInstance.status?.recent_incidents ??
    backup.status?.recent_incidents ??
    []

  const engineMode = activeInstance.status?.engine_mode ?? null
  const opaStatus = activeInstance.status?.opa_status ?? null
  const k8sStatus = activeInstance.status?.k8s_status ?? null
  const totalIncidents = activeInstance.status?.total_incidents ?? 0
  const peerStatus = activeInstance.status?.peer_status ?? null
  const uptimeSeconds = activeInstance.status?.uptime_seconds ?? null

  const triggerChaosScenario = async (
    scenario: 'pod_crash' | 'rbac_attack' | 'node_cordon' | 'immune_quarantine',
  ) => {
    setChaosLoading(scenario)
    setChaosFeedback(null)

    try {
      if (scenario === 'pod_crash') {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/api/v1/alerts',
            payload: {
              version: '4',
              groupKey: '{}:{alertname="PodCrashLooping"}',
              status: 'firing',
              receiver: 'zervox-webhook',
              alerts: [{
                status: 'firing',
                labels: { alertname: 'PodCrashLooping', severity: 'critical', pod: `victim-api-${Date.now().toString(36)}`, namespace: 'default' },
                annotations: { summary: 'Pod victim-api is crashing (OOMKilled exit code 137)' },
                startsAt: new Date().toISOString(),
              }],
            },
          }),
        })
        setChaosFeedback({
          title: '⚡ FORENSIC FREEZE FRAME SEALED',
          desc: 'Pod /proc dump and socket tables hashed into tamper-evident SQLite ledger before pod restart.',
          type: 'success',
        })
      } else if (scenario === 'rbac_attack') {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/api/simulate_attack',
            payload: { attack_type: 'delete_namespace', namespace: 'default', target_name: 'victim-api' },
          }),
        })
        setIsPolicyModalOpen(true)
        setChaosFeedback({
          title: '🛡️ POLICY FIREWALL: DANGEROUS ACTION BLOCKED',
          desc: 'Simulated namespace deletion intercepted by Rego rule REG-001. Diff theater displayed.',
          type: 'blocked',
        })
      } else if (scenario === 'node_cordon') {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/api/v1/alerts',
            payload: {
              version: '4',
              groupKey: '{}:{alertname="NodeDiskPressure"}',
              status: 'firing',
              receiver: 'zervox-webhook',
              alerts: [{
                status: 'firing',
                labels: { alertname: 'NodeDiskPressure', severity: 'critical', node: 'k3s-master-01' },
                annotations: { summary: 'Node disk pressure requiring cordon' },
                startsAt: new Date().toISOString(),
              }],
            },
          }),
        })
        setChaosFeedback({
          title: '🔐 HARDWARE CIRCUIT-BREAKER VERIFIED',
          desc: 'Cordon blast radius authorized via physical RISC-V ESP32-C3 dual-key microcontroller challenge.',
          type: 'info',
        })
      } else if (scenario === 'immune_quarantine') {
        for (let i = 0; i < 2; i++) {
          await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: '/api/simulate_attack',
              payload: { attack_type: 'delete_namespace', namespace: 'default', target_name: 'victim-api' },
            }),
          })
        }
        setChaosFeedback({
          title: '🦠 ADAPTIVE IMMUNE SYSTEM ACTIVATED',
          desc: 'Target placed in 30-minute quarantine lockdown due to repeated attack vectors.',
          type: 'blocked',
        })
      }
      setTimeout(() => poll(), 600)
    } catch (err) {
      setChaosFeedback({ title: 'EXECUTION FAILED', desc: String(err), type: 'blocked' })
    } finally {
      setChaosLoading(null)
    }
  }

  return (
    <TelemetryContext.Provider
      value={{
        primary,
        backup,
        activeInstance,
        incidents,
        engineMode,
        opaStatus,
        k8sStatus,
        peerStatus,
        totalIncidents,
        uptimeSeconds,
        isInitializing,
        refetch: poll,
        isAirGapOpen,
        setIsAirGapOpen,
        isPolicyModalOpen,
        setIsPolicyModalOpen,
        chaosLoading,
        chaosFeedback,
        setChaosFeedback,
        triggerChaosScenario,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  )
}

export function useTelemetry(): TelemetryContextValue {
  const ctx = useContext(TelemetryContext)
  if (!ctx) {
    throw new Error('useTelemetry must be used within a TelemetryProvider')
  }
  return ctx
}
