'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { HealthResponse, SystemStatus, InstanceTelemetry } from '@/types/api'

const POLL_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? 3000)
const PRIMARY_URL = process.env.NEXT_PUBLIC_PRIMARY_URL ?? 'http://localhost:8080'
const BACKUP_URL = process.env.NEXT_PUBLIC_BACKUP_URL ?? 'http://localhost:8081'

async function fetchWithLatency<T>(url: string, timeoutMs = 5000): Promise<{ data: T; latencyMs: number }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const t0 = performance.now()
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    const latencyMs = Math.round(performance.now() - t0)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: T = await res.json()
    return { data, latencyMs }
  } finally {
    clearTimeout(timer)
  }
}

async function pollInstance(baseUrl: string): Promise<Omit<InstanceTelemetry, 'label' | 'url'>> {
  try {
    const [healthResult, statusResult] = await Promise.allSettled([
      fetchWithLatency<HealthResponse>(`${baseUrl}/healthz`),
      fetchWithLatency<SystemStatus>(`${baseUrl}/api/status`),
    ])

    const health = healthResult.status === 'fulfilled' ? healthResult.value.data : null
    const status = statusResult.status === 'fulfilled' ? statusResult.value.data : null
    const latencyMs = healthResult.status === 'fulfilled' ? healthResult.value.latencyMs : null
    const error =
      healthResult.status === 'rejected'
        ? String((healthResult as PromiseRejectedResult).reason)
        : null

    return {
      health,
      status,
      error,
      lastUpdated: new Date(),
      latencyMs,
      isOnline: health !== null,
    }
  } catch (err) {
    return {
      health: null,
      status: null,
      error: String(err),
      lastUpdated: new Date(),
      latencyMs: null,
      isOnline: false,
    }
  }
}

export function useZervoxTelemetry() {
  const [primary, setPrimary] = useState<InstanceTelemetry>({
    url: PRIMARY_URL,
    label: 'PRIMARY',
    health: null,
    status: null,
    error: null,
    lastUpdated: null,
    latencyMs: null,
    isOnline: false,
  })

  const [backup, setBackup] = useState<InstanceTelemetry>({
    url: BACKUP_URL,
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
    const [primResult, backResult] = await Promise.allSettled([
      pollInstance(PRIMARY_URL),
      pollInstance(BACKUP_URL),
    ])

    if (primResult.status === 'fulfilled') {
      setPrimary(prev => ({ ...prev, ...primResult.value }))
    }
    if (backResult.status === 'fulfilled') {
      setBackup(prev => ({ ...prev, ...backResult.value }))
    }
    setIsInitializing(false)
  }, [])

  useEffect(() => {
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      clearInterval(interval)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [poll])

  // Derive the active instance (whichever is active state)
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
