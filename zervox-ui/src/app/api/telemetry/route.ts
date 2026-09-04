import { NextResponse } from 'next/server'
import type { HealthResponse, SystemStatus } from '@/types/api'

// Helper to attempt fetch across Docker container hostname then localhost fallback
async function fetchInstance(urls: string[], timeoutMs = 2500) {
  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const t0 = performance.now()
      const res = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
      })
      clearTimeout(timer)
      const latencyMs = Math.round(performance.now() - t0)
      if (res.ok) {
        const data = await res.json()
        return { data, latencyMs, url, error: null }
      }
    } catch (e) {
      // try next fallback url
    }
  }
  return { data: null, latencyMs: null, url: urls[0], error: 'Connection refused / offline' }
}

export async function GET() {
  const primaryHost = process.env.ZERVOX_PRIMARY_URL ?? 'http://zervox-primary:8080'
  const backupHost = process.env.ZERVOX_BACKUP_URL ?? 'http://zervox-backup:8081'

  const primaryUrls = [primaryHost, 'http://localhost:8080', 'http://127.0.0.1:8080']
  const backupUrls = [backupHost, 'http://localhost:8081', 'http://127.0.0.1:8081']

  const [primHealth, primStatus, backHealth, backStatus] = await Promise.all([
    fetchInstance(primaryUrls.map(u => `${u}/healthz`)),
    fetchInstance(primaryUrls.map(u => `${u}/api/status`)),
    fetchInstance(backupUrls.map(u => `${u}/healthz`)),
    fetchInstance(backupUrls.map(u => `${u}/api/status`)),
  ])

  const primaryOnline = primHealth.data !== null
  const backupOnline = backHealth.data !== null

  const primaryTelemetry = {
    url: primHealth.url.replace('/healthz', ''),
    label: 'PRIMARY',
    health: primHealth.data as HealthResponse | null,
    status: primStatus.data as SystemStatus | null,
    error: primaryOnline ? null : primHealth.error,
    lastUpdated: new Date().toISOString(),
    latencyMs: primHealth.latencyMs,
    isOnline: primaryOnline,
  }

  const backupTelemetry = {
    url: backHealth.url.replace('/healthz', ''),
    label: 'BACKUP',
    health: backHealth.data as HealthResponse | null,
    status: backStatus.data as SystemStatus | null,
    error: backupOnline ? null : (primaryOnline ? 'Dormant standby (mTLS monitor active)' : backHealth.error),
    lastUpdated: new Date().toISOString(),
    latencyMs: backHealth.latencyMs,
    isOnline: backupOnline,
  }

  return NextResponse.json({
    primary: primaryTelemetry,
    backup: backupTelemetry,
    timestamp: Date.now(),
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
