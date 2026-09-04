import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  glow?: boolean
}

export function Card({ children, className, glow = false }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[#1e3a5f] bg-[#0b1628] p-5 transition-all duration-300',
        glow && 'shadow-[0_0_24px_rgba(56,189,248,0.07)] hover:shadow-[0_0_32px_rgba(56,189,248,0.12)]',
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
    <p className={cn('mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500', className)}>
      {children}
    </p>
  )
}
