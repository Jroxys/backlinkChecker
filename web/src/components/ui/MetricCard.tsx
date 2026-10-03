import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/utils/format'
import { Card } from './Card'
import { Delta } from './Delta'
import { Sparkline } from './Sparkline'
import { Tooltip } from './Tooltip'

export function MetricCard({
  label,
  value,
  delta,
  invert,
  trend,
  icon,
  hint,
  footer,
  accent,
  className,
  style,
}: {
  label: string
  value: number | string
  delta?: number
  invert?: boolean
  trend?: number[]
  icon?: ReactNode
  hint?: string
  footer?: ReactNode
  accent?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const good = delta === undefined ? true : invert ? delta <= 0 : delta >= 0
  return (
    <Card
      interactive
      style={style}
      className={cn('group relative animate-rise overflow-hidden p-4.5', accent && 'border-primary/25', className)}
    >
      {accent && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12.5px] font-medium text-fg-3">
          {icon && <span className="text-fg-4 [&_svg]:size-3.5">{icon}</span>}
          {label}
          {hint && (
            <Tooltip content={hint}>
              <Info className="size-3 text-fg-4" />
            </Tooltip>
          )}
        </div>
        {delta !== undefined && <Delta value={delta} invert={invert} />}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="tnum display text-[28px] leading-none font-semibold text-fg">
          {typeof value === 'number' ? formatNumber(value) : value}
        </div>
        {trend && (
          <Sparkline
            data={trend}
            color={good ? 'var(--primary)' : 'var(--error)'}
            className="mb-0.5 opacity-90 transition-opacity group-hover:opacity-100"
          />
        )}
      </div>
      {footer && <div className="mt-3 border-t border-line-soft pt-3 text-[12px] text-fg-3">{footer}</div>}
    </Card>
  )
}
