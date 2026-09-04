import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ExecutionStatus, EngineMode, ClusterState } from '@/types/api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

export function getStatusColors(status: ExecutionStatus): {
  text: string
  bg: string
  dot: string
  border: string
} {
  switch (status) {
    case 'resolved':
    case 'allowed':
      return { text: 'text-emerald-400', bg: 'bg-emerald-400/10', dot: 'bg-emerald-400', border: 'border-emerald-400/30' }
    case 'blocked_by_policy':
      return { text: 'text-red-400', bg: 'bg-red-400/10', dot: 'bg-red-400', border: 'border-red-400/30' }
    case 'failed':
      return { text: 'text-orange-400', bg: 'bg-orange-400/10', dot: 'bg-orange-400', border: 'border-orange-400/30' }
    case 'evaluating_policy':
    case 'pending':
      return { text: 'text-yellow-400', bg: 'bg-yellow-400/10', dot: 'bg-yellow-400', border: 'border-yellow-400/30' }
    default:
      return { text: 'text-slate-400', bg: 'bg-slate-400/10', dot: 'bg-slate-400', border: 'border-slate-400/30' }
  }
}

export function getModeColors(mode: string): { text: string; bg: string; border: string } {
  switch (mode) {
    case 'ai':
      return { text: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/30' }
    case 'fallback':
      return { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' }
    case 'simulation':
      return { text: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' }
    default:
      return { text: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/30' }
  }
}

export function getEngineModeLabel(mode: EngineMode | null): string {
  if (!mode) return 'UNKNOWN'
  return mode === 'ai' ? 'LLM / AI' : 'LOCAL FALLBACK'
}

export function getClusterStateLabel(state: ClusterState): string {
  return state.toUpperCase()
}

export function truncate(str: string, max = 40): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}
