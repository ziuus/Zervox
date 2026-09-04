'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { InstanceTelemetry } from '@/types/api'

const POLL_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? 2500)

export function useZervoxTelemetry() {
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

  // Active instance is whichever is in active state (or primary by default)
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

  return {
    primary,
    backup,
    activeInstance,
    incidents,
    engineMode,
    opaStatus,
    k8sStatus,
    totalIncidents,
    peerStatus,
    uptimeSeconds,
    isInitializing,
    refetch: poll,
  }
}
