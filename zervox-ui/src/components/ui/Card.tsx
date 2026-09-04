import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  glow?: boolean
  style?: React.CSSProperties
}

export function Card({ children, className, style }: CardProps) {
  return (
    <div
      style={style}
      className={cn(
        'rounded-2xl surface-elevated border border-slate-200 dark:border-slate-800 transition-all duration-200',
        className
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
    <p
      className={cn(
        'text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide',
        className
      )}
    >
      {children}
    </p>
  )
}
