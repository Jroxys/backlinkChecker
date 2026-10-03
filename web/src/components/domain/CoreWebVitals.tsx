import { Gauge } from 'lucide-react'
import { useCwv } from '@/api/hooks'
import type { CwvMetric } from '@/api/types'
import { cn } from '@/lib/cn'
import { Card, CardHeader } from '@/components/ui/Card'
import { Sparkline } from '@/components/ui/Sparkline'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatDate } from '@/utils/format'

const META: Record<CwvMetric, { name: string; full: string; good: number; poor: number }> = {
  lcp: { name: 'LCP', full: 'Largest Contentful Paint — when the main content has loaded', good: 2500, poor: 4000 },
  inp: { name: 'INP', full: 'Interaction to Next Paint — how fast the page reacts to taps and clicks', good: 200, poor: 500 },
  cls: { name: 'CLS', full: 'Cumulative Layout Shift — how much the layout jumps while loading', good: 0.1, poor: 0.25 },
  fcp: { name: 'FCP', full: 'First Contentful Paint', good: 1800, poor: 3000 },
  ttfb: { name: 'TTFB', full: 'Time to First Byte', good: 800, poor: 1800 },
}
const rating = (m: CwvMetric, v: number) => (v <= META[m].good ? 'good' : v <= META[m].poor ? 'needs improvement' : 'poor')
const fmt = (m: CwvMetric, v: number) => (m === 'cls' ? v.toFixed(2) : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`)
const tone = { good: 'text-success-ink', 'needs improvement': 'text-warning-ink', poor: 'text-error-ink' } as const
const stroke = { good: 'var(--success)', 'needs improvement': 'var(--warning)', poor: 'var(--error)' } as const

/** Field Core Web Vitals (CrUX): what real Chrome users experienced, p75 on phones. */
export function CoreWebVitals({ projectId }: { projectId: string }) {
  const q = useCwv(projectId)
  const d = q.data
  if (!d || !d.configured) return null
  const last = (xs: (number | null)[]) => [...xs].reverse().find((x) => x !== null) ?? null

  return (
    <Card className="mt-4">
      <CardHeader
        icon={<Gauge />}
        title="Core Web Vitals"
        description={
          d.checked && d.series
            ? `Real Chrome users on phones, 75th percentile · ${d.origin?.replace(/^https:\/\//, '')} · 28 days to ${formatDate(d.series.dates.at(-1)!)}`
            : 'Real-user performance data from the Chrome UX Report'
        }
      />
      {!d.checked ? (
        <p className="px-5 pt-3 pb-5 text-[13px] text-fg-3">The first reading arrives within a few hours.</p>
      ) : !d.series ? (
        <p className="px-5 pt-3 pb-5 text-[13px] text-fg-3">
          This site doesn’t have enough Chrome traffic to appear in the Chrome UX Report yet — normal for newer or smaller sites. Google then judges page experience at a broader level. We check again every week.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 divide-y divide-line-soft border-t border-line-soft sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {(['lcp', 'inp', 'cls'] as const).map((m) => {
            const v = last(d.series!.p75[m])
            const r = v === null ? null : rating(m, v)
            const pts = d.series!.p75[m].filter((x): x is number => x !== null)
            return (
              <div key={m} className="p-5">
                <Tooltip content={META[m].full}>
                  <span className="text-[12px] font-medium text-fg-3 underline decoration-line-strong decoration-dotted underline-offset-4">{META[m].name}</span>
                </Tooltip>
                <div className="mt-1.5 flex items-end justify-between gap-3">
                  <div>
                    <div className="tnum text-[24px] font-semibold text-fg">{v === null ? '—' : fmt(m, v)}</div>
                    <div className={cn('text-[12px] font-medium capitalize', r ? tone[r] : 'text-fg-4')}>{r ?? 'no data'}</div>
                  </div>
                  {pts.length > 1 && r && <Sparkline data={pts} width={110} height={36} color={stroke[r]} />}
                </div>
                <div className="mt-2 text-[11.5px] text-fg-4">
                  Good ≤ {fmt(m, META[m].good)} · poor &gt; {fmt(m, META[m].poor)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
