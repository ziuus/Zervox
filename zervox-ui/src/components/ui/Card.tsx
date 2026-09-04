import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  glow?: boolean
}

export function Card({ children, className, glow }: CardProps) {
  return (
    <div
      className={cn('rounded-2xl p-5 transition-all duration-300 surface', glow && 'glow-sky', className)}
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
    <p
      className={cn('mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-token-muted', className)}
    >
      {children}
    </p>
  )
}
