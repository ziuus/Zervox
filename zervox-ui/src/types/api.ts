/**
 * Zervox API Type Definitions
 * Mirrors the Rust structs in zervox-core/src/types.rs exactly.
 */

// ─── Engine / Node Types ─────────────────────────────────────────────────────

export type EngineMode = 'ai' | 'fallback'
export type NodeRole = 'primary' | 'backup'
export type ClusterState = 'active' | 'standby'
export type ExecutionStatus = 'resolved' | 'blocked_by_policy' | 'failed' | 'evaluating_policy' | 'allowed' | 'pending'

// ─── Incident Record (from SQLite WAL store) ─────────────────────────────────

export interface IncidentRecord {
  id: string
  alert_name: string
  severity: string
  mode: string              // 'ai' | 'fallback' | 'simulation'
  root_cause: string
  action_type: string       // 'restart_pod' | 'scale' | 'cordon' | 'no_action' | 'dangerous_action'
  target_resource: string
  policy_allowed: boolean
  policy_violations: string | null
  execution_status: ExecutionStatus
  execution_error: string | null
  created_at: string        // ISO 8601 datetime string
  updated_at: string
}

// ─── System Status (/api/status) ─────────────────────────────────────────────

export interface SystemStatus {
  service: string
  version: string
  role: NodeRole
  state: ClusterState
  engine_mode: EngineMode
  uptime_seconds: number
  peer_address: string | null
  peer_status: string       // 'peer_connected' | 'peer_unreachable' | 'standalone'
  opa_status: string        // 'reachable' | 'embedded-guard-active'
  k8s_status: string        // 'connected' | 'dry-run/simulated'
  total_incidents: number
  recent_incidents: IncidentRecord[]
}

// ─── Health Check (/healthz) ─────────────────────────────────────────────────

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  service: string
  role: NodeRole
  state: ClusterState
  uptime_seconds: number
}

// ─── Combined telemetry (derived in hooks) ───────────────────────────────────

export interface InstanceTelemetry {
  url: string
  label: 'PRIMARY' | 'BACKUP'
  health: HealthResponse | null
  status: SystemStatus | null
  error: string | null
  lastUpdated: Date | null
  latencyMs: number | null
  isOnline: boolean
}
