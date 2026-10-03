import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, CheckCircle2, ExternalLink, ListChecks, RefreshCw, Scale, Target, Trash2, Trophy, XCircle, MinusCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Link, useNavigate } from '@/lib/router'
import { useProject } from '@/lib/project'
import { useChartColors } from '@/lib/chartColors'
import { useAction, useMe, useRankedKeyword, useRankings } from '@/api/hooks'
import { ApiError } from '@/api/client'
import type { Comparison, Verdict } from '@/api/types'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, type Tone } from '@/components/ui/Badge'
import { Input, Label } from '@/components/ui/Controls'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton, ChartSkeleton } from '@/components/ui/Skeleton'
import { DomainIcon } from '@/components/ui/Avatar'
import { Table, THead, TH, TR, TD } from '@/components/ui/Table'
import { ChartTooltip, axisProps } from '@/components/charts/ChartParts'
import { formatDate, formatNumber, formatShortDate, timeAgo } from '@/utils/format'
import { PositionChange } from './Rankings'

const verdicts: Record<Verdict, { label: string; tone: Tone; icon: typeof CheckCircle2 }> = {
  ahead: { label: 'You lead', tone: 'success', icon: CheckCircle2 },
  even: { label: 'Even', tone: 'neutral', icon: MinusCircle },
  behind: { label: 'Behind', tone: 'warning', icon: AlertCircle },
  missing: { label: 'Missing', tone: 'error', icon: XCircle },
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return u
  }
}

export function RankingDetail() {
  const { id = '' } = useParams()
  const { project } = useProject()
  const navigate = useNavigate()
  const q = useRankedKeyword(id)
  const list = useRankings(project?.id)
  const me = useMe().data
  const c = useChartColors()
  const row = list.data?.keywords.find((k) => k.id === id)

  const remove = useAction((s) => s.deleteRankedKeyword, { invalidate: ['rankings'], success: () => ({ title: 'Keyword removed' }) })
  const serp = useAction((s) => s.refreshSerp, { invalidate: ['rankedKeyword', 'rankings'], success: () => ({ title: 'Live results updated' }) })

  const chart = useMemo(() => (q.data?.history ?? []).filter((h) => h.source === 'gsc' && h.position !== null).map((h) => ({ date: h.date, position: h.position })), [q.data])
  const maxPos = Math.ceil(Math.max(10, ...chart.map((x) => x.position ?? 0)) / 5) * 5
  const ticks = [1, ...Array.from({ length: maxPos / 5 }, (_, i) => (i + 1) * 5)]

  if (q.error instanceof ApiError && q.error.status === 404)
    return (
      <Card>
        <EmptyState
          icon={<Target />}
          title="This keyword isn’t tracked"
          description="It may have been removed, or the link is outdated."
          action={
            <Link to="/app/rankings">
              <Button variant="primary">Go to Rankings</Button>
            </Link>
          }
        />
      </Card>
    )

  const d = q.data
  if (!d)
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-96 max-w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )

  const k = d.keyword
  const myDomain = project?.domain ?? ''
  const serpRows = d.serp?.results ?? []
  const me1 = serpRows.find((r) => myDomain && r.domain.endsWith(myDomain))
  const firstRival = serpRows.find((r) => !(myDomain && r.domain.endsWith(myDomain)))
  const totals = d.history.filter((h) => h.source === 'gsc').reduce((a, h) => ({ clicks: a.clicks + (h.clicks ?? 0), impressions: a.impressions + (h.impressions ?? 0) }), { clicks: 0, impressions: 0 })

  return (
    <>
      <Link to="/app/rankings" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-3 hover:text-fg">
        <ArrowLeft className="size-3.5" /> Rankings
      </Link>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="heading truncate text-[22px] font-semibold tracking-tight text-fg">{k.keyword}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-3">
            <span>Tracked since {formatDate(k.createdAt)}</span>
            {k.bestPage && (
              <a href={k.bestPage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono hover:text-primary-ink">
                {new URL(k.bestPage).pathname} <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            leftIcon={<Trash2 />}
            loading={remove.isPending}
            onClick={() => remove.mutate([k.id], { onSuccess: () => navigate('/app/rankings') })}
          >
            Stop tracking
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Position', value: row?.position === null || row?.position === undefined ? '—' : row.source === 'serp' ? String(row.position) : row.position.toFixed(1), extra: <PositionChange value={row?.change7d ?? null} /> },
          { label: 'Clicks (history)', value: formatNumber(totals.clicks) },
          { label: 'Impressions (history)', value: formatNumber(totals.impressions) },
          { label: 'Position #1', value: firstRival ? hostOf(firstRival.url) : '—' },
        ].map((m) => (
          <Card key={m.label} className="p-4">
            <div className="text-[12px] text-fg-3">{m.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="tnum truncate text-[20px] font-semibold text-fg">{m.value}</span>
              {m.extra}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader title="Position over time" description="Google’s average position for your site, from Search Console. Higher on the chart is better." />
        <div className="px-2 pt-4 pb-3 sm:px-3">
          {q.isLoading ? (
            <ChartSkeleton height={240} />
          ) : chart.length < 2 ? (
            <EmptyState className="py-12" icon={<Target />} title="No positions yet" description="Search Console hasn’t shown your site for this keyword in the last 90 days. History appears as soon as it does." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="date" {...axisProps(c.axis)} tickFormatter={(v) => formatShortDate(v)} minTickGap={40} />
                <YAxis {...axisProps(c.axis)} width={32} reversed domain={[1, maxPos]} ticks={ticks} interval={0} />
                <Tooltip cursor={{ stroke: c.cursor, strokeDasharray: '3 3' }} content={(p) => <ChartTooltip {...p} formatLabel={(l) => formatDate(l)} valueFormatter={(v) => v.toFixed(1)} />} />
                <Line type="monotone" dataKey="position" name="Position" stroke={c.s1} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="self-start xl:col-span-2">
          <CardHeader
            icon={<Trophy />}
            title="Google top 10"
            description={d.serp ? `Checked ${timeAgo(d.serp.fetchedAt)}` : 'Who ranks above you'}
            actions={
              list.data?.serpConfigured && (
                <Button size="xs" variant="ghost" leftIcon={<RefreshCw className={cn(serp.isPending && 'animate-spin')} />} disabled={serp.isPending} onClick={() => serp.mutate([k.id])}>
                  Refresh
                </Button>
              )
            }
          />
          {serpRows.length ? (
            <ol className="mt-3 divide-y divide-line">
              {serpRows.map((r) => {
                const mine = myDomain && r.domain.endsWith(myDomain)
                return (
                  <li key={r.position} className={cn('flex items-center gap-3 px-5 py-2.5', mine && 'bg-primary-soft/60')}>
                    <span className="tnum w-5 text-right text-[12.5px] font-semibold text-fg-3">{r.position}</span>
                    <DomainIcon domain={r.domain} size={18} />
                    <div className="min-w-0 flex-1">
                      <div className={cn('truncate text-[13px]', mine ? 'font-semibold text-primary-ink' : 'text-fg')}>{r.title || r.domain}</div>
                      <div className="truncate text-[11.5px] text-fg-4">{r.domain}</div>
                    </div>
                    {mine && (
                      <Badge size="xs" tone="primary">
                        You
                      </Badge>
                    )}
                  </li>
                )
              })}
            </ol>
          ) : (
            <div className="px-5 pt-3 pb-5 text-[13px] leading-relaxed text-fg-3">
              {list.data?.serpConfigured ? (
                'Live results for this keyword are on their way — the first check runs within a few minutes of adding it.'
              ) : (
                <>
                  Live top-10 results need a search data provider{me?.plan.limits.serpRefreshDays === null ? ' and a paid plan' : ''}. You don’t need it to compare, though: search the keyword on Google yourself, copy the URL of the result above you, and paste it into the comparison.
                </>
              )}
            </div>
          )}
          {me1 && <div className="border-t border-line px-5 py-2.5 text-[12px] text-fg-3">You’re #{me1.position} in this check.</div>}
        </Card>

        <div className="xl:col-span-3">
          <ComparePanel
            projectId={project?.id}
            keyword={k.keyword}
            keywordId={k.id}
            defaultMine={k.bestPage ?? (project ? `https://${project.domain}/` : '')}
            defaultTheirs={firstRival?.url ?? ''}
            initial={d.comparison}
          />
        </div>
      </div>
    </>
  )
}

function ComparePanel({
  projectId,
  keyword,
  keywordId,
  defaultMine,
  defaultTheirs,
  initial,
}: {
  projectId?: string
  keyword: string
  keywordId: string
  defaultMine: string
  defaultTheirs: string
  initial: Comparison | null
}) {
  const [mine, setMine] = useState(initial?.mine.url ?? defaultMine)
  const [theirs, setTheirs] = useState(initial?.theirs.url ?? defaultTheirs)
  const [result, setResult] = useState<Comparison | null>(initial)
  const run = useAction((s) => s.compare, { invalidate: ['rankedKeyword'] })

  const valid = (u: string) => /^https?:\/\/\S+\.\S+/.test(u.trim())
  const go = () =>
    projectId && run.mutate([projectId, { keyword, keywordId, myUrl: mine.trim() || undefined, theirUrl: theirs.trim() || undefined }], { onSuccess: (r) => setResult(r) })

  const score = result ? result.checks.filter((x) => x.verdict === 'ahead' || x.verdict === 'even').length : 0

  return (
    <Card>
      <CardHeader icon={<Scale />} title="You vs. the page above you" description="We read both pages and compare what Google weighs: relevance, depth, structure, speed and links." />
      <div className="grid grid-cols-1 gap-3 px-5 pt-4 sm:grid-cols-2">
        <div>
          <Label>Your page</Label>
          <Input value={mine} onChange={(e) => setMine(e.target.value)} placeholder="https://yoursite.com/page" />
        </div>
        <div>
          <Label>Competitor page</Label>
          <Input value={theirs} onChange={(e) => setTheirs(e.target.value)} placeholder="https://competitor.com/page" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-4">
        <span className="text-[12px] text-fg-4">{result?.createdAt ? `Last compared ${timeAgo(result.createdAt)}` : 'Takes a few seconds.'}</span>
        <Button variant="primary" leftIcon={<Scale />} loading={run.isPending} disabled={!valid(mine) || !valid(theirs)} onClick={go}>
          {result ? 'Compare again' : 'Compare'}
        </Button>
      </div>

      {result && (
        <>
          <div className="border-t border-line px-5 py-3 text-[13px] text-fg-2">
            You match or beat <span className="font-semibold text-fg">{hostOf(result.theirs.url)}</span> on{' '}
            <span className="font-semibold text-fg">
              {score} of {result.checks.length}
            </span>{' '}
            signals.
          </div>
          <Table minWidth={560}>
            <THead>
              <TH>Signal</TH>
              <TH>You</TH>
              <TH>Them</TH>
              <TH />
            </THead>
            <tbody>
              {result.checks.map((x) => {
                const v = verdicts[x.verdict]
                return (
                  <TR key={x.id}>
                    <TD className="font-medium text-fg">{x.label}</TD>
                    <TD className="max-w-[160px] truncate text-[12.5px]">{x.mine}</TD>
                    <TD className="max-w-[160px] truncate text-[12.5px]">{x.theirs}</TD>
                    <TD align="right">
                      <Badge size="xs" tone={v.tone} icon={<v.icon />}>
                        {v.label}
                      </Badge>
                    </TD>
                  </TR>
                )
              })}
            </tbody>
          </Table>
          {result.todo.length > 0 && (
            <div className="border-t border-line px-5 py-4">
              <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-fg">
                <ListChecks className="size-4 text-primary" /> What to do, most important first
              </div>
              <ol className="space-y-2">
                {result.todo.map((t, i) => (
                  <li key={t.id} className="flex gap-3 text-[13px] leading-relaxed text-fg-2">
                    <span className="tnum flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-ink">{i + 1}</span>
                    {t.advice}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
