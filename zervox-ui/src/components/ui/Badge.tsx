import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'green' | 'red' | 'amber' | 'sky' | 'purple' | 'slate'
  size?: 'sm' | 'md'
  dot?: boolean
  className?: string
}

const variants = {
  green:  'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  red:    'bg-red-400/10 text-red-400 border-red-400/30',
  amber:  'bg-amber-400/10 text-amber-400 border-amber-400/30',
  sky:    'bg-sky-400/10 text-sky-400 border-sky-400/30',
  purple: 'bg-purple-400/10 text-purple-400 border-purple-400/30',
  slate:  'bg-slate-500/10 text-slate-400 border-slate-500/30',
}

const dotColors = {
  green:  'bg-emerald-400',
  red:    'bg-red-400',
  amber:  'bg-amber-400',
  sky:    'bg-sky-400',
  purple: 'bg-purple-400',
  slate:  'bg-slate-400',
}

export function Badge({ children, variant = 'slate', size = 'sm', dot = false, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border font-mono font-semibold uppercase tracking-wider',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
        variants[variant],
        className,
      )}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[variant])} />
      )}
      {children}
    </span>
  )
}
