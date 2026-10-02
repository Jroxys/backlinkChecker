import { FileSearch, Link2, Map, ShieldAlert, Swords, FileCode2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Alert } from '@/types'

const kindIcon = {
  index: FileSearch,
  backlink: Link2,
  technical: ShieldAlert,
  sitemap: Map,
  competitor: Swords,
  robots: FileCode2,
}

const sev = {
  critical: 'bg-error-soft text-error-ink ring-error/20',
  warning: 'bg-warning-soft text-warning-ink ring-warning/25',
  success: 'bg-success-soft text-success-ink ring-success/20',
  info: 'bg-primary-soft text-primary-ink ring-primary-soft-2',
}

export function AlertIcon({ alert, size = 'md' }: { alert: Pick<Alert, 'kind' | 'severity'>; size?: 'sm' | 'md' }) {
  const Icon = kindIcon[alert.kind]
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
        size === 'sm' ? 'size-7' : 'size-9',
        sev[alert.severity],
      )}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} />
    </span>
  )
}
