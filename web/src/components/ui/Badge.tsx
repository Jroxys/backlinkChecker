import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type Tone = 'neutral' | 'primary' | 'success' | 'error' | 'warning' | 'outline'

const tones: Record<Tone, string> = {
  neutral: 'bg-neutral-soft text-fg-2 ring-line',
  primary: 'bg-primary-soft text-primary-ink ring-primary-soft-2',
  success: 'bg-success-soft text-success-ink ring-success/20',
  error: 'bg-error-soft text-error-ink ring-error/20',
  warning: 'bg-warning-soft text-warning-ink ring-warning/25',
  outline: 'bg-transparent text-fg-2 ring-line',
}

const dots: Record<Tone, string> = {
  neutral: 'bg-fg-4',
  primary: 'bg-primary',
  success: 'bg-success',
  error: 'bg-error',
  warning: 'bg-warning',
  outline: 'bg-fg-4',
}

export function Badge({
  tone = 'neutral',
  dot,
  icon,
  children,
  className,
  size = 'sm',
}: {
  tone?: Tone
  dot?: boolean
  icon?: ReactNode
  children: ReactNode
  className?: string
  size?: 'xs' | 'sm'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap ring-1 ring-inset',
        size === 'xs' ? 'h-5 px-1.5 text-[11px]' : 'h-6 px-2 text-[12px]',
        '[&_svg]:size-3',
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', dots[tone])} />}
      {icon}
      {children}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface-2 px-1 font-sans text-[10.5px] font-medium text-fg-3">
      {children}
    </kbd>
  )
}
