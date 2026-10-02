import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatPercent } from '@/utils/format'

/** Change indicator. `invert` flips semantics where "down is good" (e.g. issues). */
export function Delta({ value, invert, className, suffix }: { value: number; invert?: boolean; className?: string; suffix?: string }) {
  const good = invert ? value < 0 : value > 0
  const flat = value === 0
  return (
    <span
      className={cn(
        'tnum inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-medium',
        flat ? 'bg-surface-3 text-fg-3' : good ? 'bg-success-soft text-success-ink' : 'bg-error-soft text-error-ink',
        className,
      )}
    >
      {!flat && (value > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />)}
      {formatPercent(value)}
      {suffix && <span className="font-normal opacity-80">{suffix}</span>}
    </span>
  )
}
