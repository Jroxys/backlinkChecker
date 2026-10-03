import { PauseCircle } from 'lucide-react'
import { useMe } from '@/api/hooks'
import { Link } from '@/lib/router'
import { formatNumber } from '@/utils/format'

/** Shown when a downgrade left entries over the plan's limits: they're kept, but not checked. */
export function PausedNotice({ kind }: { kind: 'urls' | 'backlinks' }) {
  const me = useMe().data
  const n = me?.paused?.[kind] ?? 0
  if (!me || !n) return null
  const what = kind === 'urls' ? 'URLs' : 'backlinks'
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-[13px] text-fg-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-start gap-2">
        <PauseCircle className="mt-0.5 size-4 shrink-0 text-warning-ink" />
        <span>
          <span className="font-medium text-fg">{formatNumber(n)} {what} are paused</span> — they’re over the {me.plan.name} plan’s limit of {formatNumber(kind === 'urls' ? me.plan.limits.urls : me.plan.limits.backlinks)}. Nothing was deleted; they resume as soon as there’s room.
        </span>
      </span>
      {me.team?.role !== 'member' && (
        <Link to="/app/settings?tab=billing" className="shrink-0 font-medium text-primary-ink hover:underline">
          See plans
        </Link>
      )}
    </div>
  )
}
