import { Ban, CheckCircle2, CircleDashed, Eye, XCircle, HelpCircle } from 'lucide-react'
import type { IndexStatus, LinkRel, BacklinkStatus } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { statusMeta } from '@/lib/status'

const statusIcon = {
  indexed: <CheckCircle2 />,
  crawled: <Eye />,
  discovered: <CircleDashed />,
  blocked: <Ban />,
  error: <XCircle />,
  unknown: <HelpCircle />,
}

export function IndexStatusBadge({ status, withTip = true }: { status: IndexStatus; withTip?: boolean }) {
  const m = statusMeta[status]
  const b = (
    <Badge tone={m.tone} icon={statusIcon[status]}>
      {m.label}
    </Badge>
  )
  return withTip ? <Tooltip content={m.help}>{b}</Tooltip> : b
}

export function HttpBadge({ code }: { code: number | null }) {
  if (code === null) return <span className="text-[12px] text-fg-4">—</span>
  const tone = code >= 500 ? 'error' : code >= 400 ? 'error' : code >= 300 ? 'warning' : 'neutral'
  return (
    <span
      className={
        'tnum inline-flex h-5 items-center rounded-[5px] px-1.5 font-mono text-[11.5px] font-medium ' +
        (tone === 'neutral'
          ? 'bg-surface-3 text-fg-2'
          : tone === 'warning'
            ? 'bg-warning-soft text-warning-ink'
            : 'bg-error-soft text-error-ink')
      }
    >
      {code}
    </span>
  )
}

export function LinkTypeBadge({ type }: { type: LinkRel | null }) {
  if (!type) return <span className="text-[12px] text-fg-4">—</span>
  const label = { dofollow: 'Dofollow', nofollow: 'Nofollow', ugc: 'UGC', sponsored: 'Sponsored' }[type]
  return (
    <Badge tone={type === 'dofollow' ? 'primary' : 'outline'} size="xs">
      {label}
    </Badge>
  )
}

export function LinkStatusBadge({ status, isNew }: { status: BacklinkStatus | 'new'; isNew?: boolean }) {
  if (status === 'pending')
    return (
      <Badge tone="outline" size="xs">
        Verifying
      </Badge>
    )
  if (status === 'broken')
    return (
      <Badge tone="error" dot size="xs">
        Page down
      </Badge>
    )
  if (status === 'blocked')
    return (
      <Badge tone="outline" size="xs">
        Can’t verify
      </Badge>
    )
  if (status === 'new' || isNew)
    return (
      <Badge tone="success" dot size="xs">
        New
      </Badge>
    )
  if (status === 'lost')
    return (
      <Badge tone="error" dot size="xs">
        Lost
      </Badge>
    )
  return (
    <Badge tone="neutral" dot size="xs">
      Active
    </Badge>
  )
}

export function AuthorityPill({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[12px] text-fg-4">—</span>
  const w = Math.max(6, value)
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tnum w-6 text-right text-[13px] font-semibold text-fg">{value}</span>
      <span className="h-1 w-12 overflow-hidden rounded-full bg-surface-3">
        <span
          className="block h-full rounded-full"
          style={{ width: `${w}%`, background: value >= 70 ? 'var(--primary)' : value >= 40 ? 'var(--primary-light)' : 'var(--fg-4)' }}
        />
      </span>
    </span>
  )
}
