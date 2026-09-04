'use client'

import { cn } from '@/lib/utils'

interface PulseRingProps {
  online: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PulseRing({ online, size = 'md', className }: PulseRingProps) {
  const sizes = {
    sm:  { outer: 'h-2.5 w-2.5', inner: 'h-1.5 w-1.5' },
    md:  { outer: 'h-4 w-4',     inner: 'h-2.5 w-2.5' },
    lg:  { outer: 'h-5 w-5',     inner: 'h-3 w-3'     },
  }
  const { outer, inner } = sizes[size]
  const color = online
    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
    : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
  const pingColor = online ? 'bg-emerald-400' : 'bg-red-500'

  return (
    <span className={cn('relative inline-flex items-center justify-center', outer, className)}>
      {online && (
        <span
          className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', pingColor)}
        />
      )}
      <span className={cn('relative inline-flex rounded-full', inner, color)} />
    </span>
  )
}
