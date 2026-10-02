import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Minus, KeyRound, MousePointerClick, Eye, Target, RefreshCw, Sparkles, ShieldCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/router'
import { useProject } from '@/lib/project'
import { useKeywords } from '@/api/hooks'
import { useSource } from '@/api/source'
import type { KeywordRow } from '@/api/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { MetricCard } from '@/components/ui/MetricCard'
import { MetricCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { SearchInput } from '@/components/ui/Controls'
import { Segmented } from '@/components/ui/Tabs'
import { Table, THead, TH, TR, TD } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatDate, formatNumber } from '@/utils/format'

type View = 'all' | 'striking' | 'ctr'
type SortKey = 'clicks' | 'impressions' | 'position' | 'change'

/** Rough expected CTR by position for organic results; used only to flag under-performers. */
const expectedCtr = (pos: number) => (pos <= 1.5 ? 0.25 : pos <= 2.5 ? 0.14 : pos <= 3.5 ? 0.09 : pos <= 5.5 ? 0.05 : 0.025)

export function Keywords() {
  const { project } = useProject()
  const source = useSource()
  const qc = useQueryClient()
  const q = useKeywords(project?.id)
  const [view, setView] = useState<View>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'clicks', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [refreshing, setRefreshing] = useState(false)

  const rows = useMemo(() => q.data?.rows ?? [], [q.data])
  const striking = (r: KeywordRow) => r.position >= 4 && r.position <= 15 && r.impressions >= 50
  const lowCtr = (r: KeywordRow) => r.position <= 5 && r.impressions >= 100 && r.ctr < expectedCtr(r.position) * 0.6
  const change = (r: KeywordRow) => (r.prevPosition === null ? 0 : r.prevPosition - r.position)

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim()
    const xs = rows.filter((r) => (!s || r.query.includes(s)) && (view === 'all' || (view === 'striking' ? striking(r) : lowCtr(r))))
    const d = sort.dir === 'asc' ? 1 : -1
    return [...xs].sort((a, b) => (sort.key === 'change' ? change(a) - change(b) : a[sort.key] - b[sort.key]) * d)
  }, [rows, search, view, sort])

  const totals = rows.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }), { clicks: 0, impressions: 0 })
  const avgPos = rows.length ? rows.reduce((a, r) => a + r.position * r.impressions, 0) / Math.max(1, totals.impressions) : 0
  const buckets = [
    { label: '1–3', n: rows.filter((r) => r.position <= 3).length },
    { label: '4–10', n: rows.filter((r) => r.position > 3 && r.position <= 10).length },
    { label: '11–20', n: rows.filter((r) => r.position > 10 && r.position <= 20).length },
    { label: '21+', n: rows.filter((r) => r.position > 20).length },
  ]
  const toggle = (key: SortKey) => setSort((x) => ({ key, dir: x.key === key ? (x.dir === 'asc' ? 'desc' : 'asc') : key === 'position' ? 'asc' : 'desc' }))
  const pageRows = filtered.slice((page - 1) * 20, page * 20)

  const refresh = async () => {
    if (!project) return
    setRefreshing(true)
    try {
      const data = await source.keywords(project.id, true)
      qc.setQueryData([source.mode, 'keywords', project.id], data)
    } finally {
      setRefreshing(false)
    }
  }

  if (q.data && !q.data.connected)
    return (
      <>
        <PageHeader title="Keywords" description="The search queries your site actually appears for in Google." />
        <Card>
          <EmptyState
            icon={<ShieldCheck />}
            title="Connect Search Console to see your keywords"
            description="Keywords come straight from Google Search Console: real clicks, impressions and average position for every query — no estimates, no scraping."
            action={
              <Link to="/app/settings?tab=integrations">
                <Button variant="primary">Connect Search Console</Button>
              </Link>
            }
          />
        </Card>
      </>
    )

  return (
    <>
      <PageHeader
        title="Keywords"
        description={q.data?.range ? `Search Console queries, ${formatDate(q.data.range.start)} – ${formatDate(q.data.range.end)}, compared with the 28 days before.` : 'Search Console queries for the last 28 days.'}
        actions={
          <Button leftIcon={<RefreshCw className={cn(refreshing && 'animate-spin')} />} disabled={refreshing || source.mode === 'demo'} onClick={refresh}>
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {q.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard accent label="Queries with impressions" icon={<KeyRound />} value={rows.length} />
            <MetricCard label="Clicks (28 days)" icon={<MousePointerClick />} value={totals.clicks} />
            <MetricCard label="Impressions (28 days)" icon={<Eye />} value={totals.impressions} />
            <MetricCard label="Avg. position" icon={<Target />} value={avgPos ? avgPos.toFixed(1) : '—'} hint="Weighted by impressions." />
          </>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="heading text-[14px] font-semibold text-fg">Position distribution</h3>
              <span className="text-[12px] text-fg-3">{formatNumber(rows.length)} queries</span>
            </div>
            <div className="flex h-8 gap-[2px] overflow-hidden rounded-lg bg-surface-3">
              {buckets.map((b, i) =>
                b.n ? (
                  <div key={b.label} className="flex items-center justify-center text-[11.5px] font-semibold text-white" style={{ width: `${(b.n / rows.length) * 100}%`, background: `color-mix(in srgb, var(--primary) ${100 - i * 24}%, var(--surface-3))` }}>
                    {b.n}
                  </div>
                ) : null,
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-4 text-[12px] text-fg-3">
              {buckets.map((b, i) => (
                <span key={b.label} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[3px]" style={{ background: `color-mix(in srgb, var(--primary) ${100 - i * 24}%, var(--surface-3))` }} />
                  Position {b.label}
                </span>
              ))}
            </div>
          </Card>
          <Card className="flex flex-col justify-between p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="text-[13px] leading-relaxed text-fg-2">
                <span className="font-semibold text-fg">{rows.filter(striking).length} queries in striking distance</span> — ranking 4–15 with real impressions. Improving these pages is usually the fastest traffic win.
              </div>
            </div>
            <Button size="sm" variant="soft" className="mt-4 self-start" onClick={() => (setView('striking'), setPage(1))}>
              Show them
            </Button>
          </Card>
        </div>
      )}

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-col gap-3 px-5 pt-4.5 pb-3.5 md:flex-row md:items-center md:justify-between">
          <Segmented<View>
            value={view}
            onChange={(v) => (setView(v), setPage(1))}
            items={[
              { value: 'all', label: 'All queries' },
              { value: 'striking', label: 'Striking distance' },
              { value: 'ctr', label: 'Low CTR' },
            ]}
          />
          <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder="Filter queries…" className="w-full md:w-64" />
        </div>
        {q.isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<KeyRound />}
            title={rows.length ? 'No queries match' : 'No search data yet'}
            description={rows.length ? 'Try another filter.' : 'Search Console has no impressions for this property in the period yet. New sites usually see data within a few weeks.'}
          />
        ) : (
          <>
            {view !== 'all' && (
              <div className="mx-5 mb-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-fg-3">
                {view === 'striking'
                  ? 'Ranking 4–15 with at least 50 impressions. Expand the ranking page, add internal links to it, and target the query in its title.'
                  : 'Top-5 positions earning well under the usual click-through rate. Rewrite the title and meta description to match the query’s intent.'}
              </div>
            )}
            <Table minWidth={900}>
              <THead>
                <TH>Query</TH>
                <TH sortable sorted={sort.key === 'position' && sort.dir} onSort={() => toggle('position')} align="right">
                  Position
                </TH>
                <TH sortable sorted={sort.key === 'change' && sort.dir} onSort={() => toggle('change')}>
                  Change
                </TH>
                <TH sortable sorted={sort.key === 'clicks' && sort.dir} onSort={() => toggle('clicks')} align="right">
                  Clicks
                </TH>
                <TH sortable sorted={sort.key === 'impressions' && sort.dir} onSort={() => toggle('impressions')} align="right">
                  Impressions
                </TH>
                <TH align="right">CTR</TH>
                <TH>Ranking page</TH>
              </THead>
              <tbody>
                {pageRows.map((r) => {
                  const d = change(r)
                  let path = r.page ?? ''
                  try {
                    path = r.page ? new URL(r.page).pathname : ''
                  } catch {
                    /* keep */
                  }
                  return (
                    <TR key={r.query}>
                      <TD className="max-w-[280px] truncate font-medium text-fg">
                        {r.query}
                        {striking(r) && view === 'all' && (
                          <Badge size="xs" tone="primary" className="ml-2">
                            Quick win
                          </Badge>
                        )}
                      </TD>
                      <TD align="right" className="tnum text-[14px] font-semibold text-fg">
                        {r.position.toFixed(1)}
                      </TD>
                      <TD>
                        {r.prevPosition === null ? (
                          <Badge size="xs" tone="success">
                            New
                          </Badge>
                        ) : (
                          <Tooltip content={`Previous period: ${r.prevPosition.toFixed(1)}`}>
                            <span className={cn('tnum inline-flex items-center gap-0.5 text-[12.5px] font-medium', d > 0.4 ? 'text-success-ink' : d < -0.4 ? 'text-error-ink' : 'text-fg-4')}>
                              {d > 0.4 ? <ArrowUp className="size-3" /> : d < -0.4 ? <ArrowDown className="size-3" /> : <Minus className="size-3" />}
                              {Math.abs(d) > 0.4 ? Math.abs(d).toFixed(1) : ''}
                            </span>
                          </Tooltip>
                        )}
                      </TD>
                      <TD align="right" className="tnum">
                        {formatNumber(r.clicks)}
                      </TD>
                      <TD align="right" className="tnum">
                        {formatNumber(r.impressions)}
                      </TD>
                      <TD align="right" className={cn('tnum', lowCtr(r) && 'text-warning-ink')}>
                        {(r.ctr * 100).toFixed(1)}%
                      </TD>
                      <TD className="max-w-[240px] truncate font-mono text-[12.5px]">
                        {r.page ? (
                          <a href={r.page} target="_blank" rel="noreferrer" className="hover:text-primary-ink hover:underline">
                            {path}
                          </a>
                        ) : (
                          '—'
                        )}
                      </TD>
                    </TR>
                  )
                })}
              </tbody>
            </Table>
            <div className="border-t border-line">
              <Pagination page={page} pageSize={20} total={filtered.length} onChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </>
  )
}
