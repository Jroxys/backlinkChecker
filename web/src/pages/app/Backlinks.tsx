import { useMemo, useState } from 'react'
import { Link } from '@/lib/router'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, ExternalLink, Globe2, Link2, Plus, Minus, Play, Sparkles, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useChartColors } from '@/lib/chartColors'
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MetricCard } from '@/components/ui/MetricCard'
import { MetricCardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { Segmented } from '@/components/ui/Tabs'
import { SearchInput } from '@/components/ui/Controls'
import { Table, THead, TH, TR, TD } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { DomainIcon } from '@/components/ui/Avatar'
import { Tooltip as Tip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { ChartTooltip, axisProps, niceDomain } from '@/components/charts/ChartParts'
import { AuthorityPill, LinkStatusBadge, LinkTypeBadge } from '@/components/domain/StatusBadge'
import { backlinks, anchorDistribution, authorityBuckets } from '@/data/backlinks'
import { backlinkSeries, lastDays, weekly } from '@/data/series'
import { formatDate, formatNumber, formatShortDate } from '@/utils/format'

type FilterKey = 'dofollow' | 'nofollow' | 'new' | 'lost' | 'high' | 'low'
const filters: { key: FilterKey; label: string }[] = [
  { key: 'dofollow', label: 'Dofollow' },
  { key: 'nofollow', label: 'Nofollow' },
  { key: 'new', label: 'New' },
  { key: 'lost', label: 'Lost' },
  { key: 'high', label: 'High Authority' },
  { key: 'low', label: 'Low Authority' },
]

type Metric = 'total' | 'refDomains'
type Range = '30D' | '90D' | '1Y'

export function Backlinks() {
  const loading = useSimulatedLoad(650)
  const c = useChartColors()
  const toast = useToast()
  const [metric, setMetric] = useState<Metric>('total')
  const [range, setRange] = useState<Range>('90D')
  const [active, setActive] = useState<FilterKey[]>([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ key: 'authority' | 'firstSeen' | 'lastSeen'; dir: 'asc' | 'desc' }>({ key: 'firstSeen', dir: 'desc' })

  const chart = useMemo(() => {
    const n = range === '30D' ? 30 : range === '90D' ? 90 : 365
    const xs = lastDays(backlinkSeries, n)
    return range === '1Y'
      ? weekly(xs, (ch) => ({
          ...ch[ch.length - 1],
          gained: ch.reduce((a, x) => a + x.gained, 0),
          lost: ch.reduce((a, x) => a + x.lost, 0),
        }))
      : xs
  }, [range])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    const has = (k: FilterKey) => active.includes(k)
    return backlinks
      .filter((b) => {
        if (s && !(b.sourceDomain + b.anchor + b.target).toLowerCase().includes(s)) return false
        if ((has('dofollow') || has('nofollow')) && !((has('dofollow') && b.type === 'dofollow') || (has('nofollow') && b.type !== 'dofollow'))) return false
        if ((has('new') || has('lost')) && !((has('new') && b.status === 'new') || (has('lost') && b.status === 'lost'))) return false
        if ((has('high') || has('low')) && !((has('high') && b.authority >= 70) || (has('low') && b.authority < 30))) return false
        return true
      })
      .sort((a, b) => {
        const d = sort.dir === 'asc' ? 1 : -1
        return sort.key === 'authority' ? (a.authority - b.authority) * d : a[sort.key].localeCompare(b[sort.key]) * d
      })
  }, [q, active, sort])

  const pageRows = rows.slice((page - 1) * 10, page * 10)
  const toggleSort = (key: typeof sort.key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))
  const totalAnchors = anchorDistribution.reduce((a, x) => a + x.value, 0)

  return (
    <>
      <PageHeader
        title="Backlinks"
        description="Every link pointing to northwindlabs.com, re-verified daily. Lost links are detected within 24 hours."
        actions={
          <>
            <Button leftIcon={<Download />} onClick={() => toast({ title: 'Export started', description: '8,421 backlinks exported to CSV.' })}>
              Export
            </Button>
            <Button variant="primary" leftIcon={<Play />} onClick={() => toast({ title: 'Backlink scan started', tone: 'info', description: 'Checking 642 referring domains.' })}>
              Scan now
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard accent label="Total Backlinks" icon={<Link2 />} value={8421} delta={8.2} trend={lastDays(backlinkSeries, 30).map((p) => p.total)} />
            <MetricCard label="Referring Domains" icon={<Globe2 />} value={642} delta={5.7} trend={lastDays(backlinkSeries, 30).map((p) => p.refDomains)} />
            <MetricCard label="New Backlinks" icon={<Plus />} value={214} delta={11.3} trend={lastDays(backlinkSeries, 30).map((p) => p.gained)} hint="First seen in the last 30 days." />
            <MetricCard label="Lost Backlinks" icon={<Minus />} value={61} delta={-6.1} invert trend={lastDays(backlinkSeries, 30).map((p) => p.lost)} hint="Removed, nofollowed or 404 in the last 30 days." />
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4.5">
            <div>
              <h3 className="heading text-[14px] font-semibold text-fg">Backlink growth</h3>
              <p className="mt-0.5 text-[12.5px] text-fg-3">Net growth with daily gained and lost links</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Segmented<Metric>
                value={metric}
                onChange={setMetric}
                items={[
                  { value: 'total', label: 'Backlinks' },
                  { value: 'refDomains', label: 'Ref. domains' },
                ]}
              />
              <Segmented<Range> value={range} onChange={setRange} items={['30D', '90D', '1Y'].map((r) => ({ value: r as Range, label: r }))} />
            </div>
          </div>
          <div className="px-2 pt-4 sm:px-3">
            {loading ? (
              <ChartSkeleton height={300} />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chart} syncId="bl" margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="blg" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={c.s1} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={c.s1} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={c.grid} />
                    <XAxis dataKey="date" hide />
                    <YAxis {...axisProps(c.axis)} width={52} domain={niceDomain(metric === 'total' ? 200 : 20)} tickFormatter={(v) => formatNumber(Math.round(v))} tickCount={5} />
                    <Tooltip cursor={{ stroke: c.cursor, strokeDasharray: '3 3' }} content={(p) => <ChartTooltip {...p} formatLabel={(l) => formatShortDate(l)} />} />
                    <Area
                      type="monotone"
                      dataKey={metric}
                      name={metric === 'total' ? 'Backlinks' : 'Referring domains'}
                      stroke={c.s1}
                      strokeWidth={2}
                      fill="url(#blg)"
                      activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={chart.map((p) => ({ ...p, lostNeg: -p.lost }))} syncId="bl" stackOffset="sign" margin={{ top: 6, right: 12, left: 0, bottom: 0 }} barCategoryGap={1}>
                    <CartesianGrid vertical={false} stroke={c.grid} />
                    <XAxis dataKey="date" {...axisProps(c.axis)} tickFormatter={(d) => formatShortDate(d)} minTickGap={36} />
                    <YAxis {...axisProps(c.axis)} width={52} tickCount={3} tickFormatter={(v) => String(Math.abs(v))} />
                    <Tooltip cursor={{ fill: c.grid }} content={(p) => <ChartTooltip {...p} formatLabel={(l) => formatShortDate(l)} valueFormatter={(v) => formatNumber(Math.abs(v))} />} />
                    <Bar dataKey="gained" name="Gained" stackId="a" fill={c.s1} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="lostNeg" name="Lost" stackId="a" fill={c.s4} radius={[0, 0, 2, 2]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 px-5 pt-1 pb-4 text-[12px] text-fg-3">
            <span className="flex items-center gap-2"><span className="size-2 rounded-[3px]" style={{ background: c.s1 }} /> Gained</span>
            <span className="flex items-center gap-2"><span className="size-2 rounded-[3px]" style={{ background: c.s4 }} /> Lost</span>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Link profile" description="Anchor text and authority distribution" />
          <div className="p-5">
            <div className="mb-2 text-[12px] font-medium text-fg-3">Anchor text</div>
            <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
              {anchorDistribution.map((a, i) => (
                <div key={a.name} style={{ width: `${(a.value / totalAnchors) * 100}%`, background: i === 0 ? c.s1 : `color-mix(in srgb, ${c.s1} ${80 - i * 16}%, var(--surface-3))` }} />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {anchorDistribution.map((a, i) => (
                <div key={a.name} className="flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center gap-2 text-fg-2">
                    <span className="size-2 rounded-[3px]" style={{ background: i === 0 ? c.s1 : `color-mix(in srgb, ${c.s1} ${80 - i * 16}%, var(--surface-3))` }} />
                    {a.name}
                  </span>
                  <span className="tnum font-medium text-fg">{a.value}%</span>
                </div>
              ))}
            </div>
            <div className="mt-6 mb-2 text-[12px] font-medium text-fg-3">Referring domains by authority</div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={authorityBuckets} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap={6}>
                <XAxis dataKey="bucket" {...axisProps(c.axis)} tickMargin={6} />
                <Tooltip cursor={{ fill: c.grid }} content={(p) => <ChartTooltip {...p} formatLabel={(l) => `Authority ${l}`} />} />
                <Bar dataKey="count" name="Domains" fill={c.s1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Link to="/app/opportunities" className="mx-5 mt-auto mb-5 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary-soft p-3.5 text-[12.5px] transition-colors hover:bg-primary-soft-2">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span className="flex-1 text-fg-2">
              <span className="font-medium text-fg">12 backlink opportunities</span> found from competitor gaps
            </span>
            <ArrowRight className="size-3.5 text-primary-ink" />
          </Link>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-col gap-3 px-5 pt-4.5 pb-3.5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="heading text-[14px] font-semibold text-fg">All backlinks</h3>
              <p className="mt-0.5 text-[12.5px] text-fg-3">{formatNumber(rows.length)} links match</p>
            </div>
            <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Search domain, anchor or target…" className="w-full md:w-80" />
          </div>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {filters.map((f) => {
              const on = active.includes(f.key)
              return (
                <button
                  key={f.key}
                  onClick={() => {
                    setActive((a) => (on ? a.filter((x) => x !== f.key) : [...a, f.key]))
                    setPage(1)
                  }}
                  className={cn(
                    'h-7 shrink-0 rounded-full border px-3 text-[12.5px] font-medium transition-all',
                    on ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg',
                  )}
                >
                  {f.label}
                </button>
              )
            })}
            {active.length > 0 && (
              <button onClick={() => setActive([])} className="h-7 shrink-0 px-2 text-[12.5px] font-medium text-fg-3 hover:text-fg">
                Clear all
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Link2 />}
            title="No backlinks match these filters"
            description="Nothing in your link profile fits this combination. Widen the authority range or remove the status filter."
            action={<Button size="sm" onClick={() => (setActive([]), setQ(''))}>Reset filters</Button>}
          />
        ) : (
          <>
            <Table minWidth={1040}>
              <THead>
                <TH>Source</TH>
                <TH>Target</TH>
                <TH>Anchor Text</TH>
                <TH sortable sorted={sort.key === 'authority' && sort.dir} onSort={() => toggleSort('authority')}>
                  Domain Authority
                </TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH sortable sorted={sort.key === 'firstSeen' && sort.dir} onSort={() => toggleSort('firstSeen')}>
                  First Seen
                </TH>
                <TH sortable sorted={sort.key === 'lastSeen' && sort.dir} onSort={() => toggleSort('lastSeen')}>
                  Last Seen
                </TH>
              </THead>
              <tbody>
                {pageRows.map((b) => (
                  <TR key={b.id} className={b.status === 'lost' ? 'opacity-75' : ''}>
                    <TD className="max-w-[250px]">
                      <div className="flex items-center gap-2.5">
                        <DomainIcon domain={b.sourceDomain} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-fg">{b.sourceDomain}</div>
                          <a href={b.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-[12px] text-fg-4 hover:text-primary-ink">
                            <span className="truncate">{b.sourceUrl.replace(/^https:\/\/[^/]+/, '')}</span>
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                        </div>
                      </div>
                    </TD>
                    <TD className="max-w-[190px] truncate font-mono text-[12.5px]">{b.target}</TD>
                    <TD className="max-w-[170px] truncate">
                      <Tip content={b.anchor}>
                        <span className="truncate">“{b.anchor}”</span>
                      </Tip>
                    </TD>
                    <TD>
                      <AuthorityPill value={b.authority} />
                    </TD>
                    <TD>
                      <LinkTypeBadge type={b.type} />
                    </TD>
                    <TD>
                      <LinkStatusBadge status={b.status} />
                    </TD>
                    <TD className="tnum">{formatDate(b.firstSeen)}</TD>
                    <TD className={cn('tnum', b.status === 'lost' && 'text-error-ink')}>{formatDate(b.lastSeen)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <div className="border-t border-line">
              <Pagination page={page} pageSize={10} total={rows.length} onChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </>
  )
}
