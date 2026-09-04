import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  glow?: boolean
  interactive?: boolean
}

export function Card({ children, className, glow = false, interactive = true }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.08] bg-[#0b1329]/70 backdrop-blur-xl p-5 transition-all duration-300',
        'shadow-[0_4px_24px_-2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]',
        interactive && 'hover:border-sky-500/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(56,189,248,0.08)] hover:-translate-y-0.5',
        glow && 'shadow-[0_0_28px_rgba(56,189,248,0.12)] border-sky-500/25',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface CardLabelProps {
  children: React.ReactNode
  className?: string
}

export function CardLabel({ children, className }: CardLabelProps) {
  return (
    <p className={cn('mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400/80', className)}>
      {children}
    </p>
  )
}

