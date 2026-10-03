import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/utils/format'

interface Item {
  name?: string | number
  value?: unknown
  color?: string
  dataKey?: unknown
  payload?: unknown
}

/** Shared tooltip body for every Recharts chart. Values in ink, color only on the swatch. */
export function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  valueFormatter = (v) => formatNumber(v),
  footer,
}: {
  active?: boolean
  payload?: readonly Item[]
  label?: ReactNode
  formatLabel?: (l: string) => ReactNode
  valueFormatter?: (v: number) => ReactNode
  footer?: (payload: readonly Item[]) => ReactNode
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-44 animate-fade-in rounded-xl border border-line bg-surface/95 px-3 py-2.5 shadow-pop backdrop-blur-sm">
      {label !== undefined && (
        <div className="mb-2 text-[11.5px] font-medium text-fg-3">
          {formatLabel ? formatLabel(String(label)) : label}
        </div>
      )}
      <div className="space-y-1.5">
        {payload.map((p) => (
          <div key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-5 text-[12.5px]">
            <span className="flex items-center gap-2 text-fg-2">
              <span className="h-2.5 w-1 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="tnum font-semibold text-fg">{valueFormatter(Number(p.value))}</span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-2 border-t border-line pt-2 text-[11.5px] text-fg-3">{footer(payload)}</div>}
    </div>
  )
}

export function Legend({
  items,
  className,
  onToggle,
  hidden = [],
}: {
  items: { key: string; label: string; color: string; value?: ReactNode }[]
  className?: string
  onToggle?: (key: string) => void
  hidden?: string[]
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      {items.map((i) => {
        const off = hidden.includes(i.key)
        return (
          <button
            key={i.key}
            type="button"
            onClick={() => onToggle?.(i.key)}
            disabled={!onToggle}
            className={cn(
              'flex items-center gap-2 rounded-md text-[12.5px] transition-opacity',
              onToggle && 'hover:opacity-80',
              off && 'opacity-40',
            )}
          >
            <span className="size-2 rounded-[3px]" style={{ background: i.color }} />
            <span className="text-fg-2">{i.label}</span>
            {i.value !== undefined && <span className="tnum font-semibold text-fg">{i.value}</span>}
          </button>
        )
      })}
    </div>
  )
}

export const axisProps = (color: string) => ({
  tickLine: false,
  axisLine: false,
  tick: { fill: color, fontSize: 11.5 },
  tickMargin: 10,
})

/** Y-domain padded and snapped to a clean step so ticks read 8,200 · 8,300 rather than 8,394. */
export const niceDomain = (step: number): [(min: number) => number, (max: number) => number] => [
  (min) => Math.floor((min - step * 0.25) / step) * step,
  (max) => Math.ceil((max + step * 0.25) / step) * step,
]
