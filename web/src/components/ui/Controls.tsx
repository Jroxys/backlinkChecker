import { forwardRef, type InputHTMLAttributes } from 'react'
import { Check, Minus, Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Kbd } from './Badge'

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  const on = checked || indeterminate
  return (
    <button
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150',
        on
          ? 'border-primary bg-primary text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
          : 'border-line-strong bg-surface hover:border-fg-4',
      )}
    >
      {indeterminate ? <Minus className="size-3" strokeWidth={3} /> : checked && <Check className="size-3" strokeWidth={3} />}
    </button>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  size = 'md',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200',
        size === 'sm' ? 'h-4.5 w-8' : 'h-5 w-9',
        checked ? 'bg-primary' : 'bg-line-strong',
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-transform duration-200',
          size === 'sm' ? 'size-3.5' : 'size-4',
          checked && (size === 'sm' ? 'translate-x-3.5' : 'translate-x-4'),
        )}
      />
    </button>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13.5px] text-fg shadow-xs transition-[border-color,box-shadow] placeholder:text-fg-4',
        'hover:border-line-strong focus:border-primary focus:ring-3 focus:ring-[var(--ring)] focus:outline-none',
        className,
      )}
      {...props}
    />
  )
})

export function Label({ children, hint, htmlFor }: { children: React.ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-fg-2">
        {children}
      </label>
      {hint && <span className="text-[11.5px] text-fg-4">{hint}</span>}
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  shortcut,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  shortcut?: string
}) {
  return (
    <label
      className={cn(
        'group flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 shadow-xs transition-[border-color,box-shadow]',
        'hover:border-line-strong focus-within:border-primary focus-within:ring-3 focus-within:ring-[var(--ring)]',
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-fg-4" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-fg placeholder:text-fg-4 focus:outline-none"
      />
      {value ? (
        <button onClick={() => onChange('')} className="rounded p-0.5 text-fg-4 hover:text-fg" aria-label="Clear search">
          <X className="size-3.5" />
        </button>
      ) : (
        shortcut && <Kbd>{shortcut}</Kbd>
      )}
    </label>
  )
}

export function ProgressBar({
  value,
  tone = 'primary',
  className,
}: {
  value: number
  tone?: 'primary' | 'success' | 'error' | 'warning' | 'neutral'
  className?: string
}) {
  const color = {
    primary: 'bg-primary',
    success: 'bg-success',
    error: 'bg-error',
    warning: 'bg-warning',
    neutral: 'bg-fg-4',
  }[tone]
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-700 ease-out', color)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}
