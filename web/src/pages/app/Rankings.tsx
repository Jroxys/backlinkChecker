import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Minus, Plus, ShieldCheck, Target, Trophy, TrendingUp, Crown, Globe2, ChevronRight, Info } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Link, useNavigate } from '@/lib/router'
import { useProject } from '@/lib/project'
import { useAction, useMe, useRankings, useRankingSuggestions } from '@/api/hooks'
import type { RankedKeyword } from '@/api/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { MetricCard } from '@/components/ui/MetricCard'
import { MetricCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { Input, Label, SearchInput } from '@/components/ui/Controls'
import { Segmented } from '@/components/ui/Tabs'
import { Table, THead, TH, TR, TD } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Sparkline } from '@/components/ui/Sparkline'
import { Tooltip } from '@/components/ui/Tooltip'
import { DomainIcon } from '@/components/ui/Avatar'
import { formatNumber } from '@/utils/format'

type View = 'all' | 'top3' | 'top10' | 'striking' | 'down'
type SortKey = 'keyword' | 'position' | 'change' | 'clicks'

const pathOf = (u: string | null) => {
  if (!u) return ''
  try {
    return new URL(u).pathname
  } catch {
    return u
  }
}

/** Position movement, positive = moved up. */
export function PositionChange({ value }: { value: number | null }) {
  if (value === null) return <span className="text-fg-4">—</span>
  const up = value >= 0.5
  const down = value <= -0.5
  return (
    <span className={cn('tnum inline-flex items-center gap-0.5 text-[12.5px] font-medium', up ? 'text-success-ink' : down ? 'text-error-ink' : 'text-fg-4')}>
      {up ? <ArrowUp className="size-3" /> : down ? <ArrowDown className="size-3" /> : <Minus className="size-3" />}
      {up || down ? Math.abs(value).toFixed(1) : ''}
    </span>
  )
}

export function Rankings() {
  const { project } = useProject()
  const navigate = useNavigate()
  const q = useRankings(project?.id)
  const me = useMe().data
  const [view, setView] = useState<View>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'position', dir: 'asc' })
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => q.data?.keywords ?? [], [q.data])
  const ranked = rows.filter((r) => r.position !== null)
  const pos = (r: RankedKeyword) => r.position ?? 999

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim()
    const keep = (r: RankedKeyword) =>
      view === 'all' ||
      (view === 'top3' && pos(r) <= 3) ||
      (view === 'top10' && pos(r) <= 10) ||
      (view === 'striking' && pos(r) > 3 && pos(r) <= 15) ||
      (view === 'down' && (r.change7d ?? 0) <= -0.5)
    const d = sort.dir === 'asc' ? 1 : -1
    const val = (r: RankedKeyword) => (sort.key === 'position' ? pos(r) : sort.key === 'change' ? (r.change7d ?? 0) : sort.key === 'clicks' ? r.clicks30d : 0)
    return rows
      .filter((r) => (!s || r.keyword.includes(s)) && keep(r))
      .sort((a, b) => (sort.key === 'keyword' ? a.keyword.localeCompare(b.keyword) : val(a) - val(b)) * d)
  }, [rows, search, view, sort])

  const toggle = (key: SortKey) => setSort((x) => ({ key, dir: x.key === key ? (x.dir === 'asc' ? 'desc' : 'asc') : key === 'position' || key === 'keyword' ? 'asc' : 'desc' }))
  const avg = ranked.length ? ranked.reduce((a, r) => a + pos(r), 0) / ranked.length : 0
  const moved = rows.filter((r) => r.change7d !== null)
  const up = moved.filter((r) => r.change7d! >= 0.5).length
  const down = moved.filter((r) => r.change7d! <= -0.5).length

  const header = (
    <PageHeader
      title="Rankings"
      description="Where you rank for the searches that matter, how that changes, and what the page above you does differently."
      actions={
        <Button variant="primary" leftIcon={<Plus />} onClick={() => setAdding(true)} disabled={!q.data}>
          Track keywords
        </Button>
      }
    />
  )

  if (q.data && !q.data.gscConnected && !q.data.serpConfigured)
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={<ShieldCheck />}
            title="Connect Search Console to track rankings"
            description="Daily positions come free from Google Search Console — the same numbers Google shows you, per keyword and per page. No credits, no estimates."
            action={
              <Link to="/app/settings?tab=integrations">
                <Button variant="primary">Connect Search Console</Button>
              </Link>
            }
          />
        </Card>
        {project && <AddKeywordsModal open={adding} onClose={() => setAdding(false)} projectId={project.id} limit={q.data.limit} used={rows.length} />}
      </>
    )

  return (
    <>
      {header}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {q.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard accent label="Tracked keywords" icon={<Target />} value={rows.length} hint={`${formatNumber(q.data?.limit ?? 0)} on your plan.`} />
            <MetricCard label="Average position" icon={<TrendingUp />} value={avg ? avg.toFixed(1) : '—'} hint="Across keywords you rank for." />
            <MetricCard label="In the top 3" icon={<Trophy />} value={ranked.filter((r) => pos(r) <= 3).length} hint={`${ranked.filter((r) => pos(r) <= 10).length} on page one.`} />
            <MetricCard label="Moved this week" icon={<ArrowUp />} value={`${up} ↑ · ${down} ↓`} hint="Change versus 7 days earlier." />
          </>
        )}
      </div>

      {q.data && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-fg-3">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
          {q.data.serpConfigured ? (
            <span>
              Positions come from Search Console daily, plus a live Google check ({q.data.location.name}, {q.data.location.language}) every few days that shows who ranks above you.
            </span>
          ) : (
            <span>
              Positions come from Search Console: Google’s own average position for your site, updated daily. To see who ranks above you, open a keyword and compare your page with any competitor page — paste its URL.
              {me?.plan.limits.serpRefreshDays === null && ' Live top-10 results are part of paid plans.'}
            </span>
          )}
        </div>
      )}

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-col gap-3 px-5 pt-4.5 pb-3.5 md:flex-row md:items-center md:justify-between">
          <Segmented<View>
            value={view}
            onChange={setView}
            items={[
              { value: 'all', label: 'All' },
              { value: 'top3', label: 'Top 3' },
              { value: 'top10', label: 'Page one' },
              { value: 'striking', label: 'Striking distance' },
              { value: 'down', label: 'Dropped' },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="Filter keywords…" className="w-full md:w-64" />
        </div>
        {q.isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Target />}
            title={rows.length ? 'No keywords match' : 'Track your first keywords'}
            description={
              rows.length
                ? 'Try another filter.'
                : 'Pick the searches you want to win. We’ll suggest the ones Search Console already shows you for, and backfill 90 days of history.'
            }
            action={
              !rows.length && (
                <Button variant="primary" leftIcon={<Plus />} onClick={() => setAdding(true)}>
                  Track keywords
                </Button>
              )
            }
          />
        ) : (
          <Table minWidth={920}>
            <THead>
              <TH sortable sorted={sort.key === 'keyword' && sort.dir} onSort={() => toggle('keyword')}>
                Keyword
              </TH>
              <TH sortable sorted={sort.key === 'position' && sort.dir} onSort={() => toggle('position')} align="right">
                Position
              </TH>
              <TH sortable sorted={sort.key === 'change' && sort.dir} onSort={() => toggle('change')}>
                7 days
              </TH>
              <TH>30-day trend</TH>
              <TH sortable sorted={sort.key === 'clicks' && sort.dir} onSort={() => toggle('clicks')} align="right">
                Clicks
              </TH>
              <TH>Ranking page</TH>
              <TH>Top competitor</TH>
              <TH />
            </THead>
            <tbody>
              {filtered.map((r) => {
                const trend = r.trend.filter((x): x is number => x !== null)
                return (
                  <TR key={r.id} onClick={() => navigate(`/app/rankings/${r.id}`)}>
                    <TD className="max-w-[260px] truncate font-medium text-fg">{r.keyword}</TD>
                    <TD align="right">
                      {r.position === null ? (
                        <Tooltip content="Not in Search Console results for this keyword yet">
                          <span className="text-fg-4">—</span>
                        </Tooltip>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {r.position <= 1.5 && <Crown className="size-3.5 text-warning" />}
                          <span className="tnum text-[14px] font-semibold text-fg">{r.source === 'serp' ? r.position : r.position.toFixed(1)}</span>
                        </span>
                      )}
                    </TD>
                    <TD>
                      <PositionChange value={r.change7d} />
                    </TD>
                    <TD>
                      {/* Plotted negated so "up" on the chart means a better position */}
                      {trend.length > 1 ? <Sparkline data={trend.map((x) => -x)} width={88} height={26} /> : <span className="text-fg-4">—</span>}
                    </TD>
                    <TD align="right" className="tnum">
                      {formatNumber(r.clicks30d)}
                    </TD>
                    <TD className="max-w-[200px] truncate font-mono text-[12.5px]">{pathOf(r.bestPage) || '—'}</TD>
                    <TD className="max-w-[200px]">
                      {r.topCompetitor ? (
                        <span className="flex items-center gap-2 truncate text-[12.5px]">
                          <DomainIcon domain={r.topCompetitor.domain} size={16} />
                          <span className="truncate">{r.topCompetitor.domain}</span>
                          <Badge size="xs" tone="outline">
                            #{r.topCompetitor.position}
                          </Badge>
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-fg-4">Compare →</span>
                      )}
                    </TD>
                    <TD align="right">
                      <ChevronRight className="size-4 text-fg-4" />
                    </TD>
                  </TR>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {project && q.data && <AddKeywordsModal open={adding} onClose={() => setAdding(false)} projectId={project.id} limit={q.data.limit} used={rows.length} serp={q.data.serpConfigured ? q.data.location : null} />}
    </>
  )
}

function AddKeywordsModal({
  open,
  onClose,
  projectId,
  limit,
  used,
  serp,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  limit: number
  used: number
  serp?: { name: string; language: string } | null
}) {
  const [text, setText] = useState('')
  const [location, setLocation] = useState(serp?.name ?? '')
  const [language, setLanguage] = useState(serp?.language ?? '')
  const suggestions = useRankingSuggestions(projectId, open)
  const add = useAction((s) => s.addRankedKeywords, {
    invalidate: ['rankings', 'rankingSuggestions'],
    success: (r) => ({ title: `Tracking ${r.created} keyword${r.created === 1 ? '' : 's'}`, description: r.skipped ? `${r.skipped} already tracked or over the limit.` : 'History from Search Console is loading now.' }),
  })
  const settings = useAction((s) => s.saveRankingSettings, { invalidate: ['rankings'] })

  const list = text
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean)
  const lower = new Set(list.map((x) => x.toLowerCase()))
  const left = Math.max(0, limit - used)
  const pick = (k: string) => setText((t) => (lower.has(k.toLowerCase()) ? t : (t.trim() ? t.trim() + '\n' : '') + k))

  const submit = async () => {
    if (serp && (location !== serp.name || language !== serp.language)) await settings.mutateAsync([projectId, { location, language }])
    await add.mutateAsync([projectId, list])
    setText('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Track keywords"
      description={`One per line. ${formatNumber(left)} of ${formatNumber(limit)} left on your plan.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={add.isPending} disabled={!list.length || list.length > left} onClick={submit}>
            Track {list.length || ''} keyword{list.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={'seo audit tool\nbacklink checker\ngoogle indexing api'}
        className="w-full resize-none rounded-lg border border-line bg-surface p-3 text-[13px] text-fg shadow-xs placeholder:text-fg-4 focus:border-primary focus:ring-3 focus:ring-[var(--ring)] focus:outline-none"
      />
      {list.length > left && <p className="mt-1.5 text-[12.5px] text-error-ink">That’s more than your plan has room for.</p>}

      <div className="mt-4">
        <div className="mb-2 text-[12.5px] font-medium text-fg-2">Suggested from Search Console</div>
        {suggestions.isLoading ? (
          <div className="text-[12.5px] text-fg-4">Loading…</div>
        ) : !suggestions.data?.suggestions.length ? (
          <div className="text-[12.5px] text-fg-4">No suggestions yet — they appear once Search Console has data for your site.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.data.suggestions.map((s) => {
              const on = lower.has(s.keyword.toLowerCase())
              return (
                <Tooltip key={s.keyword} content={`${formatNumber(s.impressions)} impressions · position ${s.position.toFixed(1)}`}>
                  <button
                    type="button"
                    onClick={() => pick(s.keyword)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                      on ? 'border-primary bg-primary-soft text-primary-ink' : 'border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg',
                    )}
                  >
                    {on ? '✓ ' : '+ '}
                    {s.keyword}
                  </button>
                </Tooltip>
              )
            })}
          </div>
        )}
      </div>

      {serp && (
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_120px]">
          <div>
            <Label>
              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="size-3.5" /> Location
              </span>
            </Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Turkey" />
          </div>
          <div>
            <Label>Language</Label>
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="tr" />
          </div>
        </div>
      )}
    </Modal>
  )
}
