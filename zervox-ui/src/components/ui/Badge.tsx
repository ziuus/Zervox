import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'green' | 'red' | 'amber' | 'sky' | 'purple' | 'slate'
  size?: 'sm' | 'md'
  dot?: boolean
  className?: string
}

const variants = {
  green:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
  red:    'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)]',
  amber:  'bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
  sky:    'bg-sky-500/10 text-sky-300 border-sky-500/30 shadow-[0_0_12px_rgba(56,189,248,0.15)]',
  purple: 'bg-purple-500/10 text-purple-300 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]',
  slate:  'bg-slate-800/40 text-slate-300 border-slate-700/50',
}

const dotColors = {
  green:  'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]',
  red:    'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]',
  amber:  'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]',
  sky:    'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]',
  purple: 'bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]',
  slate:  'bg-slate-400',
}

export function Badge({ children, variant = 'slate', size = 'sm', dot = false, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-mono font-semibold uppercase tracking-wider backdrop-blur-sm',
        size === 'sm' ? 'px-2.5 py-0.5 text-[9px]' : 'px-3 py-1 text-[11px]',
        variants[variant],
        className,
      )}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', dotColors[variant])} />
      )}
      {children}
    </span>
  )
}

