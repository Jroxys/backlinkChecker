import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, CreditCard, Link2, ScanSearch, Wrench, ListChecks } from 'lucide-react'
import { api } from '@/api/client'
import { useMe } from '@/api/hooks'
import { useSource } from '@/api/source'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { MetricCard } from '@/components/ui/MetricCard'
import { MetricCardSkeleton } from '@/components/ui/Skeleton'
import { Segmented } from '@/components/ui/Tabs'
import { ProgressBar } from '@/components/ui/Controls'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatNumber } from '@/utils/format'
import { NotFound } from '@/pages/NotFound'

interface Metrics {
  days: number
  totals: { users: number; projects: number; urls: number; backlinks: number; paying: number; founding: number; mrr: number }
  funnel: { step: string; users: number }[]
  daily: { day: string; signups: number }[]
  tools: Record<string, number>
  queue: { kind: string; status: string; n: number }[]
}

/** Founder-only view of the launch funnel. The API answers 404 for everyone else. */
export function Admin() {
  const source = useSource()
  const me = useMe().data
  const [days, setDays] = useState<'30' | '90' | '180'>('30')
  const allowed = source.mode === 'live' && !!me?.user.isAdmin
  const q = useQuery({ queryKey: ['admin', days], queryFn: () => api.get<Metrics>(`/api/admin/metrics?days=${days}`), enabled: allowed })
  if (me && !allowed) return <NotFound inApp />
  const m = q.data

  // Fill gaps so quiet days show as empty bars instead of disappearing.
  const series: { day: string; signups: number }[] = []
  if (m) {
    const byDay = new Map(m.daily.map((d) => [d.day, d.signups]))
    for (let i = m.days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
      series.push({ day, signups: byDay.get(day) ?? 0 })
    }
  }
  const peak = Math.max(1, ...series.map((s) => s.signups))
  const top = m?.funnel[0]?.users ?? 0

  return (
    <div>
      <PageHeader
        title="Founder metrics"
        description="Signups, activation and revenue from your own database. Only visible to ADMIN_EMAILS."
        actions={<Segmented value={days} onChange={setDays} items={[{ value: '30', label: '30d' }, { value: '90', label: '90d' }, { value: '180', label: '180d' }]} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!m ? (
          Array.from({ length: 4 }, (_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard label="MRR" value={`$${formatNumber(m.totals.mrr)}`} icon={<CreditCard />} hint="Monthly recurring revenue at list or founding price" />
            <MetricCard label="Paying customers" value={m.totals.paying} icon={<Users />} footer={<span>{m.totals.founding} on founding price · {Math.max(0, 100 - m.totals.founding)} founding seats left</span>} />
            <MetricCard label="Users" value={m.totals.users} icon={<Users />} footer={<span>{m.totals.projects} projects</span>} />
            <MetricCard label="Monitored" value={formatNumber(m.totals.urls + m.totals.backlinks)} icon={<ScanSearch />} footer={<span>{formatNumber(m.totals.urls)} URLs · {formatNumber(m.totals.backlinks)} backlinks</span>} />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Activation funnel" description={`Users who signed up in the last ${days} days`} icon={<ListChecks />} />
          <CardBody className="space-y-3.5">
            {m?.funnel.map((f, i) => {
              const pct = top ? (f.users / top) * 100 : 0
              const prev = i > 0 ? m.funnel[i - 1].users : 0
              return (
                <div key={f.step}>
                  <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
                    <span className="text-fg-2">{f.step}</span>
                    <span className="tnum text-fg-3">
                      <span className="font-semibold text-fg">{formatNumber(f.users)}</span>
                      {i > 0 && prev > 0 && <span className="ml-2">{Math.round((f.users / prev) * 100)}% of previous</span>}
                    </span>
                  </div>
                  <ProgressBar value={pct} tone={i === m.funnel.length - 1 ? 'success' : 'primary'} />
                </div>
              )
            })}
            {m && top === 0 && <p className="text-[12.5px] text-fg-3">No signups in this window yet. Share a free tool to start the funnel.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Daily signups" description={`${formatNumber(series.reduce((a, s) => a + s.signups, 0))} in ${days} days`} icon={<Users />} />
          <CardBody>
            <div className="flex h-40 items-end gap-px" role="img" aria-label="Daily signups bar chart">
              {series.map((s) => (
                <Tooltip key={s.day} content={`${s.day}: ${s.signups}`} className="flex h-full flex-1 items-end">
                  <div className="w-full rounded-t-sm bg-primary/80 hover:bg-primary" style={{ height: `${s.signups ? Math.max(4, (s.signups / peak) * 100) : 1}%`, opacity: s.signups ? 1 : 0.25 }} />
                </Tooltip>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-fg-4 tnum">
              <span>{series[0]?.day}</span>
              <span>{series.at(-1)?.day}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Free tools" description="Lead-magnet usage in this window" icon={<Wrench />} />
          <CardBody className="space-y-2 text-[13px]">
            {[
              ['tool_backlink_check', 'Backlink checker'],
              ['tool_indexability_check', 'Indexability checker'],
            ].map(([k, label]) => (
              <div key={k} className="flex justify-between">
                <span className="text-fg-2">{label}</span>
                <span className="tnum font-semibold text-fg">{formatNumber(m?.tools[k] ?? 0)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Job queue" description="Queued, running and failed jobs right now" icon={<Link2 />} />
          <CardBody className="space-y-2 text-[13px]">
            {m && m.queue.length === 0 && <p className="text-fg-3">Queue is empty.</p>}
            {m?.queue.map((j) => (
              <div key={`${j.kind}-${j.status}`} className="flex justify-between">
                <span className="text-fg-2">
                  {j.kind} <span className={j.status === 'failed' ? 'text-error' : 'text-fg-4'}>· {j.status}</span>
                </span>
                <span className="tnum font-semibold text-fg">{formatNumber(j.n)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
