import { cn } from '@/lib/utils'

type BadgeVariant = 'green' | 'amber' | 'red' | 'sky' | 'slate' | 'purple' | 'indigo' | 'rose'
type BadgeSize    = 'sm' | 'md'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  className?: string
}

const variantStyles: Record<BadgeVariant, { color: string; bg: string; border: string; dotBg: string }> = {
  green:  { color: 'var(--status-green)',   bg: 'var(--status-green-bg)',  border: 'var(--status-green-bdr)',  dotBg: 'var(--status-green)' },
  amber:  { color: 'var(--status-amber)',   bg: 'var(--status-amber-bg)',  border: 'var(--status-amber-bdr)',  dotBg: 'var(--status-amber)' },
  red:    { color: 'var(--status-red)',     bg: 'var(--status-red-bg)',    border: 'var(--status-red-bdr)',    dotBg: 'var(--status-red)' },
  sky:    { color: 'var(--accent)',         bg: 'var(--accent-subtle)',    border: 'var(--accent-border)',     dotBg: 'var(--accent)' },
  slate:  { color: 'var(--text-secondary)', bg: 'var(--bg-sunken)',        border: 'var(--border-subtle)',     dotBg: 'var(--text-muted)' },
  purple: { color: '#a855f7',               bg: 'rgba(168,85,247,0.08)',   border: 'rgba(168,85,247,0.20)',    dotBg: '#a855f7' },
  indigo: { color: '#6366f1',               bg: 'rgba(99,102,241,0.08)',   border: 'rgba(99,102,241,0.20)',    dotBg: '#6366f1' },
  rose:   { color: '#f43f5e',               bg: 'rgba(244,63,94,0.08)',    border: 'rgba(244,63,94,0.20)',     dotBg: '#f43f5e' },
}

export function Badge({ children, variant = 'sky', size = 'md', dot, className }: BadgeProps) {
  const v = variantStyles[variant]
  const padding = size === 'sm' ? '1px 6px' : '2px 8px'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium select-none',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        className,
      )}
      style={{
        color: v.color,
        background: v.bg,
        border: `1px solid ${v.border}`,
        padding,
      }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{ background: v.dotBg }}
        />
      )}
      {children}
    </span>
  )
}
