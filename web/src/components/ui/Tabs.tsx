import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  count?: number
  icon?: ReactNode
}

/** Underlined tabs with an animated indicator — for page-level sections. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [ind, setInd] = useState({ left: 0, width: 0 })

  useLayoutEffect(() => {
    const el = refs.current[value]
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value, items.length])

  return (
    <div className={cn('no-scrollbar relative flex gap-1 overflow-x-auto border-b border-line', className)} role="tablist">
      {items.map((t) => (
        <button
          key={t.value}
          ref={(el) => {
            refs.current[t.value] = el
          }}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'relative flex shrink-0 items-center gap-2 px-2.5 pt-1 pb-3 text-[13px] font-medium transition-colors [&_svg]:size-4',
            value === t.value ? 'text-fg' : 'text-fg-3 hover:text-fg-2',
          )}
        >
          {t.icon}
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                'tnum rounded-md px-1.5 py-px text-[11px]',
                value === t.value ? 'bg-primary-soft text-primary-ink' : 'bg-surface-3 text-fg-3',
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
      <span
        className="absolute bottom-0 h-0.5 rounded-full bg-primary transition-all duration-250 ease-out"
        style={{ left: ind.left, width: ind.width }}
      />
    </div>
  )
}

/** Segmented control — for compact toggles like time ranges. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  size = 'sm',
  className,
}: {
  items: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  size?: 'xs' | 'sm'
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-lg border border-line bg-surface-2 p-0.5', className)} role="tablist">
      {items.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'tnum rounded-md font-medium transition-all duration-150 [&_svg]:size-3.5',
            size === 'xs' ? 'h-6 px-2 text-[11.5px]' : 'h-7 px-2.5 text-[12.5px]',
            value === t.value
              ? 'bg-surface text-fg shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-line dark:bg-surface-3'
              : 'text-fg-3 hover:text-fg',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
