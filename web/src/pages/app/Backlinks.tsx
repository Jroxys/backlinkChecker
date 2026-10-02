import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ExternalLink, Globe2, Link2, Plus, Minus, Play, Sparkles, ArrowRight, Upload, MoreHorizontal, RefreshCw, Trash2, Info, Clock3 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/router'
import { useChartColors } from '@/lib/chartColors'
import { useProject } from '@/lib/project'
import { useAction, useBacklinkProfile, useBacklinks, useHistory, useMe } from '@/api/hooks'
import type { Backlink } from '@/api/types'
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
import { Modal } from '@/components/ui/Modal'
import { Dropdown, MenuItem, MenuSeparator } from '@/components/ui/Dropdown'
import { ChartTooltip, axisProps, niceDomain } from '@/components/charts/ChartParts'
import { AuthorityPill, LinkStatusBadge, LinkTypeBadge } from '@/components/domain/StatusBadge'
import { formatDate, formatNumber, formatShortDate, timeAgo } from '@/utils/format'

type FilterKey = 'dofollow' | 'nofollow' | 'new' | 'lost' | 'high' | 'low' | 'pending'
const filters: { key: FilterKey; label: string }[] = [
  { key: 'dofollow', label: 'Dofollow' },
  { key: 'nofollow', label: 'Nofollow' },
  { key: 'new', label: 'New' },
  { key: 'lost', label: 'Lost' },
  { key: 'high', label: 'High Authority' },
  { key: 'low', label: 'Low Authority' },
  { key: 'pending', label: 'Verifying' },
]

type Metric = 'backlinks' | 'ref_domains'
type Range = '30D' | '90D' | '1Y'
const rangeDays: Record<Range, number> = { '30D': 30, '90D': 90, '1Y': 365 }

function change(xs: number[]) {
  if (xs.length < 2 || !xs[0]) return undefined
  return ((xs[xs.length - 1] - xs[0]) / xs[0]) * 100
}

export function Backlinks() {
  const { project } = useProject()
  const me = useMe().data
  const c = useChartColors()
  const [metric, setMetric] = useState<Metric>('backlinks')
  const [range, setRange] = useState<Range>('90D')
  const [active, setActive] = useState<FilterKey[]>([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ key: 'authority' | 'firstSeen' | 'lastSeen'; dir: 'asc' | 'desc' }>({ key: 'firstSeen', dir: 'desc' })
  const [importing, setImporting] = useState(false)

  const history = useHistory(project?.id, rangeDays[range])
  const h30 = useHistory(project?.id, 30).data ?? []
  const profile = useBacklinkProfile(project?.id)
  const list = useBacklinks(project?.id, { page, pageSize: 10, q: q || undefined, filter: active, sort: sort.key, dir: sort.dir })
  const scan = useAction((s) => s.scanProject, { invalidate: ['backlinks', 'projects'], success: (r) => ({ title: 'Verification started', description: `${formatNumber(r.queued.backlinks)} backlinks queued.` }) })

  const chart = useMemo(() => {
    const xs = history.data ?? []
    if (range !== '1Y') return xs
    const out = []
    for (let i = xs.length % 7; i < xs.length; i += 7) {
      const ch = xs.slice(i, i + 7)
      out.push({ ...ch[ch.length - 1], gained: ch.reduce((a, x) => a + x.gained, 0), lost: ch.reduce((a, x) => a + x.lost, 0) })
    }
    return out
  }, [history.data, range])

  const s = project?.stats
  const rows = list.data?.backlinks ?? []
  const total = list.data?.total ?? 0
  const toggleSort = (key: typeof sort.key) => setSort((x) => ({ key, dir: x.key === key && x.dir === 'desc' ? 'asc' : 'desc' }))
  const anchors = profile.data?.anchors
  const anchorRows = anchors
    ? [
        { name: 'Branded', value: anchors.branded },
        { name: 'Keyword / other', value: anchors.other },
        { name: 'Naked URL', value: anchors.url },
        { name: 'Generic', value: anchors.generic },
        { name: 'Empty / image', value: anchors.empty },
      ]
    : []
  const anchorTotal = Math.max(1, anchorRows.reduce((a, x) => a + x.value, 0))
  const shade = (i: number) => (i === 0 ? c.s1 : `color-mix(in srgb, ${c.s1} ${80 - i * 16}%, var(--surface-3))`)
  const noLinksYet = s && s.trackedBacklinks === 0

  return (
    <>
      <PageHeader
        title="Backlinks"
        description={project ? `Every link pointing to ${project.domain}, re-verified on the linking page itself. A link counts as lost only after two consecutive misses.` : ''}
        actions={
          <>
            <Button leftIcon={<Upload />} onClick={() => setImporting(true)}>
              Add / import
            </Button>
            <Button variant="primary" leftIcon={<Play />} loading={scan.isPending} disabled={!project} onClick={() => project && scan.mutate([project.id])}>
              Verify now
            </Button>
          </>
        }
      />

      {noLinksYet ? (
        <Card>
          <EmptyState
            icon={<Link2 />}
            title="No backlinks tracked yet"
            description="Import your existing links — the free “Latest links” export from Search Console works great — and we’ll verify every one of them on a schedule."
            action={
              <Button variant="primary" leftIcon={<Upload />} onClick={() => setImporting(true)}>
                Import backlinks
              </Button>
            }
            secondary={
              me?.plan.limits.discovery ? null : (
                <Link to="/app/settings?tab=billing">
                  <Button variant="ghost" rightIcon={<ArrowRight />}>
                    Automatic discovery on Pro
                  </Button>
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {!s ? (
              Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
            ) : (
              <>
                <MetricCard accent label="Live Backlinks" icon={<Link2 />} value={s.backlinks} delta={change(h30.map((x) => x.backlinks))} trend={h30.length > 1 ? h30.map((x) => x.backlinks) : undefined} hint="Links found on the linking page at the last check." />
                <MetricCard label="Referring Domains" icon={<Globe2 />} value={s.refDomains} delta={change(h30.map((x) => x.ref_domains))} trend={h30.length > 1 ? h30.map((x) => x.ref_domains) : undefined} />
                <MetricCard label="New (30 days)" icon={<Plus />} value={s.gained30d} trend={h30.length > 1 ? h30.map((x) => x.gained) : undefined} hint="First seen in the last 30 days." />
                <MetricCard label="Lost (30 days)" icon={<Minus />} value={s.lost30d} invert trend={h30.length > 1 ? h30.map((x) => x.lost) : undefined} hint="Missing on two consecutive checks, or the linking page went down." />
              </>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4.5">
                <div>
                  <h3 className="heading text-[14px] font-semibold text-fg">Backlink growth</h3>
                  <p className="mt-0.5 text-[12.5px] text-fg-3">Verified links over time with daily gains and losses</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Segmented<Metric>
                    value={metric}
                    onChange={setMetric}
                    items={[
                      { value: 'backlinks', label: 'Backlinks' },
                      { value: 'ref_domains', label: 'Ref. domains' },
                    ]}
                  />
                  <Segmented<Range> value={range} onChange={setRange} items={(['30D', '90D', '1Y'] as Range[]).map((r) => ({ value: r, label: r }))} />
                </div>
              </div>
              <div className="px-2 pt-4 sm:px-3">
                {history.isLoading ? (
                  <ChartSkeleton height={300} />
                ) : chart.length < 2 ? (
                  <EmptyState className="py-14" icon={<Clock3 />} title="History builds up daily" description="We snapshot your link profile every day. The growth chart appears after the second snapshot." />
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
                        <YAxis {...axisProps(c.axis)} width={52} domain={niceDomain(metric === 'backlinks' ? 50 : 10)} tickFormatter={(v) => formatNumber(Math.round(v))} tickCount={5} />
                        <Tooltip cursor={{ stroke: c.cursor, strokeDasharray: '3 3' }} content={(p) => <ChartTooltip {...p} formatLabel={(l) => formatShortDate(l)} />} />
                        <Area type="monotone" dataKey={metric} name={metric === 'backlinks' ? 'Backlinks' : 'Referring domains'} stroke={c.s1} strokeWidth={2} fill="url(#blg)" activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height={110}>
                      <BarChart data={chart.map((p) => ({ ...p, lostNeg: -p.lost }))} syncId="bl" stackOffset="sign" margin={{ top: 6, right: 12, left: 0, bottom: 0 }} barCategoryGap={1}>
                        <CartesianGrid vertical={false} stroke={c.grid} />
                        <XAxis dataKey="date" {...axisProps(c.axis)} tickFormatter={(d) => formatShortDate(d)} minTickGap={36} />
                        <YAxis {...axisProps(c.axis)} width={52} tickCount={3} allowDecimals={false} tickFormatter={(v) => String(Math.abs(v))} />
                        <Tooltip cursor={{ fill: c.grid }} content={(p) => <ChartTooltip {...p} formatLabel={(l) => formatShortDate(l)} valueFormatter={(v) => formatNumber(Math.abs(v))} />} />
                        <Bar dataKey="gained" name="Gained" stackId="a" fill={c.s1} radius={[2, 2, 0, 0]} />
                        <Bar dataKey="lostNeg" name="Lost" stackId="a" fill={c.s4} radius={[0, 0, 2, 2]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 px-3 pt-1 pb-4 text-[12px] text-fg-3">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-[3px]" style={{ background: c.s1 }} /> Gained
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-[3px]" style={{ background: c.s4 }} /> Lost
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card className="flex flex-col">
              <CardHeader title="Link profile" description="Anchor text and authority of live links" />
              <div className="p-5">
                <div className="mb-2 text-[12px] font-medium text-fg-3">Anchor text</div>
                <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-surface-3">
                  {anchorRows.map((a, i) => (a.value ? <div key={a.name} style={{ width: `${(a.value / anchorTotal) * 100}%`, background: shade(i) }} /> : null))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {anchorRows.map((a, i) => (
                    <div key={a.name} className="flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-2 text-fg-2">
                        <span className="size-2 rounded-[3px]" style={{ background: shade(i) }} />
                        {a.name}
                      </span>
                      <span className="tnum font-medium text-fg">{Math.round((a.value / anchorTotal) * 100)}%</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 mb-2 flex items-baseline justify-between text-[12px] font-medium text-fg-3">
                  Referring domains by authority
                  {!!profile.data?.unknownAuthority && <span className="font-normal text-fg-4">{profile.data.unknownAuthority} without a score</span>}
                </div>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={profile.data?.authority ?? []} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap={6}>
                    <XAxis dataKey="bucket" {...axisProps(c.axis)} tickMargin={6} />
                    <Tooltip cursor={{ fill: c.grid }} content={(p) => <ChartTooltip {...p} formatLabel={(l) => `Authority ${l}`} />} />
                    <Bar dataKey="count" name="Domains" fill={c.s1} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Link to="/app/opportunities" className="mx-5 mt-auto mb-5 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary-soft p-3.5 text-[12.5px] transition-colors hover:bg-primary-soft-2">
                <Sparkles className="size-4 shrink-0 text-primary" />
                <span className="flex-1 text-fg-2">
                  <span className="font-medium text-fg">Find new link opportunities</span> from competitor gaps
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
                  <p className="mt-0.5 text-[12.5px] text-fg-3">{formatNumber(total)} links match</p>
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
                      className={cn('h-7 shrink-0 rounded-full border px-3 text-[12.5px] font-medium transition-all', on ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg')}
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
            {list.isLoading ? (
              <TableSkeleton rows={8} cols={7} />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<Link2 />}
                title="No backlinks match these filters"
                description="Nothing in your link profile fits this combination. Widen the authority range or remove the status filter."
                action={
                  <Button size="sm" onClick={() => (setActive([]), setQ(''))}>
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <div className={cn('transition-opacity', list.isPlaceholderData && 'opacity-60')}>
                <Table minWidth={1060}>
                  <THead>
                    <TH>Source</TH>
                    <TH>Target</TH>
                    <TH>Anchor Text</TH>
                    <TH sortable sorted={sort.key === 'authority' && sort.dir} onSort={() => toggleSort('authority')}>
                      Authority
                    </TH>
                    <TH>Type</TH>
                    <TH>Status</TH>
                    <TH sortable sorted={sort.key === 'firstSeen' && sort.dir} onSort={() => toggleSort('firstSeen')}>
                      First Seen
                    </TH>
                    <TH sortable sorted={sort.key === 'lastSeen' && sort.dir} onSort={() => toggleSort('lastSeen')}>
                      Last Seen
                    </TH>
                    <TH className="w-10" />
                  </THead>
                  <tbody>
                    {rows.map((b) => (
                      <BacklinkRow key={b.id} b={b} />
                    ))}
                  </tbody>
                </Table>
                <div className="border-t border-line">
                  <Pagination page={page} pageSize={10} total={total} onChange={setPage} />
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {project && <ImportModal open={importing} onClose={() => setImporting(false)} projectId={project.id} domain={project.domain} />}
    </>
  )
}

function BacklinkRow({ b }: { b: Backlink }) {
  const recheck = useAction((s) => s.recheckBacklink, {
    invalidate: ['backlinks', 'projects'],
    success: (r) => ({ title: r.backlink.status === 'active' ? 'Link verified' : 'Checked', description: r.backlink.lastError ?? `${r.backlink.sourceDomain} links to you (${r.backlink.type}).` }),
  })
  const remove = useAction((s) => s.deleteBacklink, { invalidate: ['backlinks', 'projects'], success: () => ({ title: 'Backlink removed from tracking' }) })
  let path = b.sourceUrl
  let target = b.target ?? b.expectedTarget ?? ''
  try {
    path = new URL(b.sourceUrl).pathname + new URL(b.sourceUrl).search
    if (target) target = new URL(target).pathname
  } catch {
    /* keep raw */
  }
  return (
    <TR className={b.status === 'lost' || b.status === 'broken' ? 'opacity-80' : ''}>
      <TD className="max-w-[250px]">
        <div className="flex items-center gap-2.5">
          <DomainIcon domain={b.sourceDomain} />
          <div className="min-w-0">
            <div className="truncate font-medium text-fg">{b.sourceDomain}</div>
            <a href={b.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-[12px] text-fg-4 hover:text-primary-ink">
              <span className="truncate">{path}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          </div>
        </div>
      </TD>
      <TD className="max-w-[180px] truncate font-mono text-[12.5px]">{target || <span className="font-sans text-fg-4">Any page</span>}</TD>
      <TD className="max-w-[170px] truncate">{b.anchor ? <Tip content={b.anchor}><span className="truncate">“{b.anchor}”</span></Tip> : <span className="text-fg-4">—</span>}</TD>
      <TD>
        <AuthorityPill value={b.authority} />
      </TD>
      <TD>
        <LinkTypeBadge type={b.type} />
      </TD>
      <TD>
        <span className="inline-flex items-center gap-1.5">
          <LinkStatusBadge status={b.status} isNew={b.isNew} />
          {b.lastError && b.status !== 'active' && (
            <Tip content={b.lastError}>
              <Info className="size-3.5 text-fg-4" />
            </Tip>
          )}
          {b.pageNoindex && b.status === 'active' && (
            <Tip content="The linking page is noindex — Google may ignore this link.">
              <Info className="size-3.5 text-warning" />
            </Tip>
          )}
        </span>
      </TD>
      <TD className="tnum">{b.firstSeen ? formatDate(b.firstSeen) : <span className="text-fg-4">—</span>}</TD>
      <TD className={cn('tnum', (b.status === 'lost' || b.status === 'broken') && 'text-error-ink')}>
        {b.lastSeen ? formatDate(b.lastSeen) : b.lastChecked ? <span className="text-fg-4">Not found · {timeAgo(b.lastChecked)}</span> : <span className="text-fg-4">Queued</span>}
      </TD>
      <TD className="w-10">
        <Dropdown
          align="right"
          width={200}
          trigger={({ toggle }) => (
            <button onClick={toggle} aria-label="Backlink actions" className="rounded-md p-1 text-fg-4 opacity-60 transition group-hover:opacity-100 hover:bg-surface-3 hover:text-fg">
              <MoreHorizontal className="size-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<RefreshCw />} onClick={() => (recheck.mutate([b.id]), close())}>
                Verify now
              </MenuItem>
              <MenuItem icon={<ExternalLink />} onClick={() => (window.open(b.sourceUrl, '_blank', 'noopener'), close())}>
                Open linking page
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 />} danger onClick={() => (remove.mutate([b.id]), close())}>
                Stop tracking
              </MenuItem>
            </>
          )}
        </Dropdown>
      </TD>
    </TR>
  )
}

function ImportModal({ open, onClose, projectId, domain }: { open: boolean; onClose: () => void; projectId: string; domain: string }) {
  const [text, setText] = useState('')
  const imp = useAction((s) => s.importBacklinks, {
    invalidate: ['backlinks', 'projects'],
    success: (r) => ({
      title: `${formatNumber(r.created.length)} backlinks added`,
      description: [r.skipped.length && `${r.skipped.length} skipped (duplicates, internal or over limit)`, r.domainOnly && `${r.domainOnly} domain-only rows ignored`, 'verification starts within a minute'].filter(Boolean).join(' · '),
    }),
  })
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add backlinks"
      description={`Paste the pages that link to ${domain}, or upload an export. Each one is verified on the linking page itself.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!text.trim()}
            loading={imp.isPending}
            onClick={() =>
              imp.mutateAsync([projectId, text]).then(
                () => {
                  setText('')
                  onClose()
                },
                () => undefined,
              )
            }
          >
            Import
          </Button>
        </>
      }
    >
      <div className="mb-3 grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-3">
        {[
          ['Search Console', 'Links → Latest links → Export'],
          ['Ahrefs / Semrush / Moz', 'Backlink export (CSV)'],
          ['Plain list', 'One linking page URL per line'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
            <div className="font-medium text-fg">{t}</div>
            <div className="text-fg-4">{d}</div>
          </div>
        ))}
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={9}
        placeholder={'https://blog.example.org/best-tools\nhttps://news.example.net/article-mentioning-you'}
        className="w-full resize-none rounded-lg border border-line bg-surface p-3 font-mono text-[12.5px] text-fg shadow-xs placeholder:text-fg-4 focus:border-primary focus:ring-3 focus:ring-[var(--ring)] focus:outline-none"
      />
      <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-primary-ink hover:underline">
        <Upload className="size-3.5" />
        Upload CSV
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) setText(await f.text())
          }}
        />
      </label>
    </Modal>
  )
}
