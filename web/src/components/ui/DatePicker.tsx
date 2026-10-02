import { useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { NOW, formatShortDate } from '@/utils/format'
import { Dropdown } from './Dropdown'
import { Button } from './Button'

export type DatePreset = '7d' | '30d' | '90d' | '12m' | 'custom'

const presets: { value: Exclude<DatePreset, 'custom'>; label: string; days: number }[] = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
  { value: '12m', label: 'Last 12 months', days: 365 },
]

export interface DateRange {
  preset: DatePreset
  from: Date
  to: Date
}

export function rangeFromPreset(p: Exclude<DatePreset, 'custom'>): DateRange {
  const days = presets.find((x) => x.value === p)!.days
  const to = new Date(NOW)
  const from = new Date(NOW)
  from.setDate(from.getDate() - days + 1)
  return { preset: p, from, to }
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function DatePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [month, setMonth] = useState(() => new Date(value.to.getFullYear(), value.to.getMonth(), 1))
  const [draft, setDraft] = useState<{ from: Date | null; to: Date | null }>({ from: value.from, to: value.to })

  const label =
    value.preset === 'custom'
      ? `${formatShortDate(value.from)} – ${formatShortDate(value.to)}`
      : presets.find((p) => p.value === value.preset)!.label

  const days = useMemo(() => {
    const first = new Date(month)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first)
    start.setDate(1 - offset)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [month])

  const pick = (d: Date) => {
    if (!draft.from || draft.to) setDraft({ from: d, to: null })
    else if (d < draft.from) setDraft({ from: d, to: draft.from })
    else setDraft({ from: draft.from, to: d })
  }

  return (
    <Dropdown
      align="right"
      width={520}
      trigger={({ open, toggle }) => (
        <button
          onClick={toggle}
          aria-expanded={open}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-fg shadow-xs transition-colors hover:border-line-strong hover:bg-surface-2',
            open && 'border-line-strong bg-surface-2',
          )}
        >
          <CalendarDays className="size-4 text-fg-3" />
          {label}
          <ChevronDown className={cn('size-3.5 text-fg-4 transition-transform', open && 'rotate-180')} />
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col sm:flex-row">
          <div className="flex shrink-0 flex-row flex-wrap gap-0.5 border-line p-1 sm:w-40 sm:flex-col sm:border-r">
            {presets.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  onChange(rangeFromPreset(p.value))
                  close()
                }}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors',
                  value.preset === p.value ? 'bg-primary-soft text-primary-ink' : 'text-fg-2 hover:bg-surface-3',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex-1 p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                className="rounded-md p-1 text-fg-3 hover:bg-surface-3"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-[13px] font-semibold text-fg">
                {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button
                className="rounded-md p-1 text-fg-3 hover:bg-surface-3"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {WEEK.map((w) => (
                <span key={w} className="py-1 text-[11px] font-medium text-fg-4">
                  {w}
                </span>
              ))}
              {days.map((d) => {
                const out = d.getMonth() !== month.getMonth()
                const future = d > NOW
                const isFrom = draft.from && sameDay(d, draft.from)
                const isTo = draft.to && sameDay(d, draft.to)
                const inRange = draft.from && draft.to && d > draft.from && d < draft.to
                return (
                  <button
                    key={d.toISOString()}
                    disabled={future}
                    onClick={() => pick(d)}
                    className={cn(
                      'tnum h-8 text-[12.5px] transition-colors disabled:opacity-30',
                      out ? 'text-fg-4' : 'text-fg-2',
                      inRange && 'bg-primary-soft text-primary-ink',
                      (isFrom || isTo) && 'rounded-lg bg-primary font-semibold text-white',
                      !isFrom && !isTo && !inRange && 'rounded-lg hover:bg-surface-3',
                      sameDay(d, NOW) && !isFrom && !isTo && 'font-semibold text-primary-ink',
                    )}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="tnum text-[12px] text-fg-3">
                {draft.from ? formatShortDate(draft.from) : '—'} → {draft.to ? formatShortDate(draft.to) : '—'}
              </span>
              <Button
                size="sm"
                variant="primary"
                disabled={!draft.from || !draft.to}
                onClick={() => {
                  if (draft.from && draft.to) onChange({ preset: 'custom', from: draft.from, to: draft.to })
                  close()
                }}
              >
                Apply range
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dropdown>
  )
}
