import { CoreWebVitals } from '@/components/domain/CoreWebVitals'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CheckCircle2, ChevronDown, Cog, FileText, Gauge, Link2, Play, ScanSearch, XCircle, Wrench, Info, ExternalLink } from 'lucide-react'
import type { AuditCategoryKey } from '@/api/types'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/router'
import { useChartColors } from '@/lib/chartColors'
import { useProject } from '@/lib/project'
import { useAction, useAudit, useHistory } from '@/api/hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { Segmented } from '@/components/ui/Tabs'
import { Skeleton, ChartSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChartTooltip, axisProps } from '@/components/charts/ChartParts'
import { formatNumber, formatShortDate } from '@/utils/format'

const catIcon: Record<AuditCategoryKey, typeof Cog> = {
  technical: Cog,
  content: FileText,
  performance: Gauge,
  indexing: ScanSearch,
  links: Link2,
}

export function Audit() {
  const { project } = useProject()
  const q = useAudit(project?.id)
  const history = useHistory(project?.id, 90)
  const c = useChartColors()
  const [cat, setCat] = useState<AuditCategoryKey | 'all'>('all')
  const [view, setView] = useState<'issues' | 'passed'>('issues')
  const [open, setOpen] = useState<string | null>(null)
  const scan = useAction((s) => s.scanProject, { invalidate: ['audit', 'projects', 'urls'], success: () => ({ title: 'Re-crawl started', description: 'The audit updates as each URL is re-checked.' }) })

  const a = q.data
  const issues = (a?.checks ?? []).filter((x) => (cat === 'all' || x.category === cat) && (view === 'passed' ? x.affected === 0 : x.affected > 0))
  const rank = { error: 0, warning: 1, notice: 2 }
  issues.sort((x, y) => rank[x.severity] - rank[y.severity] || y.affected - x.affected)
  const totals = { passed: (a?.checks ?? []).filter((x) => !x.affected).length, warnings: (a?.checks ?? []).filter((x) => x.affected && x.severity !== 'error').length, errors: (a?.checks ?? []).filter((x) => x.affected && x.severity === 'error').length }
  const trend = (history.data ?? []).map((h) => ({ date: h.date, issues: h.issues, share: h.urls ? Math.round((h.indexable / h.urls) * 100) : 0 }))

  return (
    <>
      <PageHeader
        title="SEO Audit"
        description={a ? `${formatNumber(a.urlsChecked)} URLs and ${formatNumber(a.linksChecked)} backlinks checked against ${a.checks.length} rules. Every finding links to the exact URLs it affects.` : 'Rule-based checks over every URL we monitor.'}
        actions={
          <Button variant="primary" leftIcon={<Play />} loading={scan.isPending} disabled={!project} onClick={() => project && scan.mutate([project.id])}>
            Re-crawl now
          </Button>
        }
      />

      {q.isLoading || !a ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        </div>
      ) : a.score === null ? (
        <Card>
          <EmptyState icon={<ScanSearch />} title="The first crawl is still running" description="We’re reading your sitemaps and checking each URL. Your audit appears as soon as the first URLs have been checked — usually within a few minutes." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="relative overflow-hidden">
              <div className="bg-dots pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]" />
              <div className="relative flex flex-col items-center px-5 pt-6 pb-5">
                <ScoreRing score={a.score} size={188} label="Audit score" />
                <div className="mt-5 grid w-full grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface">
                  {[
                    { label: 'Passed', value: totals.passed, icon: <CheckCircle2 className="size-3.5 text-success" /> },
                    { label: 'Warnings', value: totals.warnings, icon: <AlertTriangle className="size-3.5 text-warning" /> },
                    { label: 'Errors', value: totals.errors, icon: <XCircle className="size-3.5 text-error" /> },
                  ].map((x) => (
                    <div key={x.label} className="px-3 py-2.5 text-center">
                      <div className="tnum text-[18px] font-semibold text-fg">{x.value}</div>
                      <div className="mt-0.5 flex items-center justify-center gap-1 text-[11.5px] text-fg-3">
                        {x.icon}
                        {x.label}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-fg-4">
                  <Info className="mt-0.5 size-3 shrink-0" /> Each rule subtracts points in proportion to the share of URLs it affects.
                </p>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title="Indexability over time" description="Share of monitored URLs that Google can index" />
              <div className="px-2 pt-4 pb-3 sm:px-3">
                {history.isLoading ? (
                  <ChartSkeleton height={220} />
                ) : trend.length < 2 ? (
                  <EmptyState className="py-12" icon={<Gauge />} title="Trend appears after day two" description="We snapshot indexability daily so you can see whether fixes are working." />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ish" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor={c.s1} stopOpacity={0.22} />
                          <stop offset="100%" stopColor={c.s1} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={c.grid} />
                      <XAxis dataKey="date" {...axisProps(c.axis)} tickFormatter={(d) => formatShortDate(d)} minTickGap={40} />
                      <YAxis {...axisProps(c.axis)} width={40} domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip cursor={{ stroke: c.cursor, strokeDasharray: '3 3' }} content={(p) => <ChartTooltip {...p} formatLabel={(l) => formatShortDate(l)} valueFormatter={(v) => `${v}%`} />} />
                      <Area type="monotone" dataKey="share" name="Indexable" stroke={c.s1} strokeWidth={2} fill="url(#ish)" activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          {project && <CoreWebVitals projectId={project.id} />}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {a.categories.map((k) => {
              const Icon = catIcon[k.key]
              const total = Math.max(1, k.passed + k.warnings + k.errors)
              const active = cat === k.key
              return (
                <button
                  key={k.key}
                  onClick={() => setCat(active ? 'all' : k.key)}
                  className={cn('group rounded-xl border bg-surface p-4 text-left shadow-xs transition-all duration-200', active ? 'border-primary ring-3 ring-[var(--ring)]' : 'border-line hover:border-line-strong hover:shadow-card')}
                >
                  <div className="flex items-start justify-between">
                    <span className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-2">
                      <Icon className="size-4" />
                    </span>
                    <span className="tnum text-[20px] font-semibold text-fg">{k.score}</span>
                  </div>
                  <div className="mt-2.5 text-[13.5px] font-semibold text-fg">{k.name}</div>
                  <div className="line-clamp-2 min-h-[32px] text-[12px] text-fg-4">{k.description}</div>
                  <div className="mt-3 flex h-1.5 gap-[2px] overflow-hidden rounded-full">
                    <div className="bg-success" style={{ width: `${(k.passed / total) * 100}%` }} />
                    <div className="bg-warning" style={{ width: `${(k.warnings / total) * 100}%` }} />
                    <div className="bg-error" style={{ width: `${(k.errors / total) * 100}%` }} />
                  </div>
                  <div className="tnum mt-2 flex gap-3 text-[11.5px] text-fg-3">
                    <span>{k.passed} ok</span>
                    <span>{k.warnings} warn</span>
                    <span className={k.errors ? 'text-error-ink' : ''}>{k.errors} err</span>
                  </div>
                </button>
              )
            })}
          </div>

          <Card className="mt-4 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4.5 pb-4">
              <div>
                <h3 className="heading text-[14px] font-semibold text-fg">{cat === 'all' ? 'All checks' : `${a.categories.find((x) => x.key === cat)?.name} checks`}</h3>
                <p className="mt-0.5 text-[12.5px] text-fg-3">Sorted by impact. Fix errors first — they block indexing or waste link equity.</p>
              </div>
              <Segmented
                value={view}
                onChange={setView}
                items={[
                  { value: 'issues', label: 'Issues' },
                  { value: 'passed', label: 'Passed' },
                ]}
              />
            </div>
            <div className="divide-y divide-line-soft border-t border-line">
              {issues.length === 0 && (
                <div className="flex items-center justify-center gap-2 px-5 py-10 text-[13px] text-fg-3">
                  <CheckCircle2 className="size-4 text-success" /> {view === 'issues' ? 'No issues here. Nice.' : 'No passed checks in this category.'}
                </div>
              )}
              {issues.map((x) => {
                const isOpen = open === x.id
                return (
                  <div key={x.id}>
                    <button onClick={() => setOpen(isOpen ? null : x.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-2">
                      {x.affected === 0 ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : x.severity === 'error' ? <XCircle className="size-4 shrink-0 text-error" /> : x.severity === 'warning' ? <AlertTriangle className="size-4 shrink-0 text-warning" /> : <Info className="size-4 shrink-0 text-fg-4" />}
                      <span className="flex-1 text-[13.5px] font-medium text-fg">{x.title}</span>
                      <Badge size="xs" tone="outline" className="hidden sm:inline-flex">
                        {a.categories.find((k) => k.key === x.category)?.name}
                      </Badge>
                      {x.affected > 0 && (
                        <span className="tnum w-24 text-right text-[12.5px] text-fg-3">
                          <span className="font-semibold text-fg">{formatNumber(x.affected)}</span> {x.category === 'links' ? (x.affected === 1 ? 'link' : 'links') : x.affected === 1 ? 'URL' : 'URLs'}
                        </span>
                      )}
                      <ChevronDown className={cn('size-4 text-fg-4 transition-transform', isOpen && 'rotate-180')} />
                    </button>
                    {isOpen && (
                      <div className="animate-fade-in px-5 pb-4 sm:pl-12">
                        <p className="text-[13px] text-fg-2">{x.description}</p>
                        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-line bg-surface-2 p-3">
                          <Wrench className="mt-0.5 size-3.5 shrink-0 text-primary" />
                          <div className="text-[12.5px] text-fg-2">
                            <span className="font-medium text-fg">How to fix: </span>
                            {x.fix}
                          </div>
                        </div>
                        {x.samples.length > 0 && (
                          <div className="mt-3">
                            <div className="mb-1.5 text-[11.5px] font-medium text-fg-4">Affected {x.affected > x.samples.length ? `(first ${x.samples.length})` : ''}</div>
                            <ul className="divide-y divide-line-soft rounded-lg border border-line">
                              {x.samples.map((s) => {
                                let path = s.url
                                try {
                                  const u = new URL(s.url)
                                  path = x.category === 'links' ? u.hostname + u.pathname : u.pathname + u.search
                                } catch {
                                  /* keep */
                                }
                                return (
                                  <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
                                    {x.category === 'links' ? (
                                      <a href={s.url} target="_blank" rel="noreferrer" className="truncate font-mono text-fg-2 hover:text-primary-ink">
                                        {path}
                                      </a>
                                    ) : (
                                      <Link to={`/app/indexing/${s.id}`} className="truncate font-mono text-fg-2 hover:text-primary-ink">
                                        {path}
                                      </Link>
                                    )}
                                    <ExternalLink className="size-3 shrink-0 text-fg-4" />
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}
    </>
  )
}
