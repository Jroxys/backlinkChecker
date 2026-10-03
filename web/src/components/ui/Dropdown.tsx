import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useClickOutside } from '@/hooks/useClickOutside'

export function Dropdown({
  trigger,
  children,
  align = 'left',
  width = 220,
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  width?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside([ref], close, open)

  return (
    <div ref={ref} className={cn('relative inline-flex', className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="menu"
          style={{ width }}
          className={cn(
            'absolute top-[calc(100%+6px)] z-50 max-w-[calc(100vw-2rem)] origin-top animate-pop rounded-xl border border-line bg-surface p-1 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  children,
  icon,
  onClick,
  selected,
  danger,
  hint,
}: {
  children: ReactNode
  icon?: ReactNode
  onClick?: () => void
  selected?: boolean
  danger?: boolean
  hint?: ReactNode
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        danger ? 'text-error-ink hover:bg-error-soft' : 'text-fg-2 hover:bg-surface-3 hover:text-fg',
        selected && 'text-fg',
      )}
    >
      {icon && <span className="text-fg-3">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-[11.5px] text-fg-4">{hint}</span>}
      {selected && <Check className="text-primary" />}
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-fg-4 uppercase">{children}</div>
}

export function MenuSeparator() {
  return <div className="-mx-1 my-1 h-px bg-line" />
}

/** A compact select built on Dropdown. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  icon,
  label,
  align,
  width,
  size = 'md',
}: {
  value: T
  options: { value: T; label: string; hint?: string; icon?: ReactNode }[]
  onChange: (v: T) => void
  icon?: ReactNode
  label?: string
  align?: 'left' | 'right'
  width?: number
  size?: 'sm' | 'md'
}) {
  const current = options.find((o) => o.value === value)
  return (
    <Dropdown
      align={align}
      width={width}
      trigger={({ open, toggle }) => (
        <button
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-line bg-surface font-medium text-fg shadow-xs transition-colors hover:border-line-strong hover:bg-surface-2',
            size === 'sm' ? 'h-8 px-2.5 text-[12.5px]' : 'h-9 px-3 text-[13px]',
            open && 'border-line-strong bg-surface-2',
            '[&_svg]:size-4',
          )}
        >
          {icon && <span className="text-fg-3">{icon}</span>}
          {label && <span className="font-normal text-fg-3">{label}</span>}
          <span className="truncate">{current?.label}</span>
          <ChevronDown className={cn('!size-3.5 text-fg-4 transition-transform', open && 'rotate-180')} />
        </button>
      )}
    >
      {(close) =>
        options.map((o) => (
          <MenuItem
            key={o.value}
            icon={o.icon}
            hint={o.hint}
            selected={o.value === value}
            onClick={() => {
              onChange(o.value)
              close()
            }}
          >
            {o.label}
          </MenuItem>
        ))
      }
    </Dropdown>
  )
}
