import { cn } from '@/lib/cn'

type State = 'online' | 'warning' | 'error' | 'idle' | 'running'

const color: Record<State, string> = {
  online: 'bg-success text-success',
  warning: 'bg-warning text-warning',
  error: 'bg-error text-error',
  idle: 'bg-fg-4 text-fg-4',
  running: 'bg-primary text-primary',
}

export function StatusIndicator({
  state,
  label,
  pulse,
  className,
}: {
  state: State
  label?: string
  pulse?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[12.5px] text-fg-2', className)}>
      <span className={cn('relative size-2 rounded-full', color[state], pulse && 'animate-pulse-ring')} />
      {label}
    </span>
  )
}
