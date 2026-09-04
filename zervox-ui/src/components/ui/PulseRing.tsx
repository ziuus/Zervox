'use client'

import { cn } from '@/lib/utils'

interface PulseRingProps {
  online: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PulseRing({ online, size = 'md', className }: PulseRingProps) {
  const sizes = {
    sm: { outer: 'h-2.5 w-2.5', inner: 'h-1.5 w-1.5' },
    md: { outer: 'h-4 w-4',     inner: 'h-2.5 w-2.5' },
    lg: { outer: 'h-5 w-5',     inner: 'h-3 w-3'     },
  }
  const { outer, inner } = sizes[size]
  const bg     = online ? 'var(--status-green)' : 'var(--status-red)'
  const shadow = online ? '0 0 8px var(--status-green)' : '0 0 8px var(--status-red)'

  return (
    <span className={cn('relative inline-flex items-center justify-center', outer, className)}>
      {online && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
          style={{ background: bg }}
        />
      )}
      <span
        className={cn('relative inline-flex rounded-full', inner)}
        style={{ background: bg, boxShadow: shadow }}
      />
    </span>
  )
}
