import { cn } from '@/lib/cn'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, FileCheck2, Globe2, Link2, Play, ShieldAlert, Sparkles, ShieldCheck, Upload, CheckCircle2, Clock3, BellRing } from 'lucide-react'
import { Link } from '@/lib/router'
import { useChartColors } from '@/lib/chartColors'
import { useProject } from '@/lib/project'
import { useAction, useAlerts, useHistory, useMe } from '@/api/hooks'
import type { HistoryPoint, Project } from '@/api/types'
import { greeting, formatNumber, timeAgo, formatShortDate } from '@/utils/format'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Dropdown'
import { MetricCard } from '@/components/ui/MetricCard'
import { MetricCardSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { MiniScore } from '@/components/ui/ScoreRing'
import { DomainIcon } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChartTooltip, Legend, axisProps } from '@/components/charts/ChartParts'
import { IndexingChart } from '@/components/domain/IndexingChart'
import { UrlTable } from '@/components/domain/UrlTable'
import { AlertIcon } from '@/components/AlertIcon'

/** % change between the first and last point of a series (undefined when there's no baseline). */
function change(xs: number[]) {
  if (xs.length < 2 || !xs[0]) return undefined
  return ((xs[xs.length - 1] - xs[0]) / xs[0]) * 100
}

/** A simple 0–100 health score from indexability and link health. */
export function healthScore(p: Project) {
  const s = p.stats
  if (!s || !s.urls) return 0
  const indexable = s.indexable / Math.max(1, s.urls)
  const lostRatio = s.trackedBacklinks ? s.lost30d / Math.max(1, s.backlinks + s.lost30d) : 0
  return Math.max(0, Math.min(100, Math.round(indexable * 85 + (1 - lostRatio) * 15)))
}

export function Dashboard() {
  const me = useMe()
  const { project, projects, setProjectId, loading: projectsLoading } = useProject()
  const history = useHistory(project?.id, 30)
  const scan = useAction((s) => s.scanProject, {
    invalidate: ['projects', 'urls', 'backlinks'],
    success: (r) => ({ title: 'Scan started', description: `${formatNumber(r.queued.urls)} URLs and ${formatNumber(r.queued.backlinks)} backlinks queued. Results arrive over the next minutes.` }),
  })
  const loading = projectsLoading || history.isLoading
  const h = history.data ?? []
  const s = project?.stats
  const firstName = me.data?.user.name.split(' ')[0] ?? ''

  return (
    <>
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2.5 flex flex-wrap items-center gap-3">
            <StatusIndicator state="online" pulse label={`Monitoring ${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`} />
            {project?.lastScan && (
              <>
                <span className="hidden h-3 w-px bg-line sm:block" />
                <span className="hidden text-[12.5px] text-fg-3 sm:inline">Last check {timeAgo(project.lastScan)}</span>
              </>
            )}
          </div>
          <h1 className="heading text-[24px] leading-tight font-semibold text-fg sm:text-[28px]">
            {greeting()}
            {firstName && `, ${firstName}`}
          </h1>
          <p className="mt-1.5 text-[14px] text-fg-3">Here’s what’s happening across your websites.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {projects.length > 1 && (
            <Select value={project?.id ?? ''} options={projects.map((p) => ({ value: p.id, label: p.domain }))} onChange={setProjectId} icon={<Globe2 />} width={260} />
          )}
          <Button variant="primary" leftIcon={<Play />} loading={scan.isPending} disabled={!project} onClick={() => project && scan.mutate([project.id])}>
            Run scan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading || !s ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard
              accent
              label="Indexed URLs"
              icon={<FileCheck2 />}
              value={s.indexed}
              delta={change(h.map((x) => x.indexed))}
              trend={h.length > 1 ? h.map((x) => x.indexed) : undefined}
              hint="URLs Google reports as indexed via Search Console URL Inspection."
              footer={
                s.unknown === s.urls ? (
                  <span>Connect Search Console to see Google’s index status</span>
                ) : (
                  <span>
                    <span className="tnum font-medium text-fg-2">{s.urls ? ((s.indexed / s.urls) * 100).toFixed(1) : 0}%</span> of {formatNumber(s.urls)} monitored URLs
                  </span>
                )
              }
            />
            <MetricCard
              label="Backlinks"
              icon={<Link2 />}
              value={s.backlinks}
              delta={change(h.map((x) => x.backlinks))}
              trend={h.length > 1 ? h.map((x) => x.backlinks) : undefined}
              hint="Links verified present on the linking page at the last check."
              footer={
                <span>
                  <span className={cn('tnum font-medium', s.gained30d ? 'text-success-ink' : 'text-fg-3')}>{s.gained30d ? '+' : ''}{formatNumber(s.gained30d)}</span> new · <span className={cn('tnum font-medium', s.lost30d ? 'text-error-ink' : 'text-fg-3')}>{formatNumber(s.lost30d)}</span> lost in 30 days
                </span>
              }
              style={{ animationDelay: '40ms' }}
            />
            <MetricCard
              label="Referring Domains"
              icon={<Globe2 />}
              value={s.refDomains}
              delta={change(h.map((x) => x.ref_domains))}
              trend={h.length > 1 ? h.map((x) => x.ref_domains) : undefined}
              footer={
                <span>
                  <span className="tnum font-medium text-fg-2">{s.backlinks ? Math.round((s.dofollow / s.backlinks) * 100) : 0}%</span> dofollow
                  {s.pendingBacklinks > 0 && <> · {formatNumber(s.pendingBacklinks)} verifying</>}
                </span>
              }
              style={{ animationDelay: '80ms' }}
            />
            <MetricCard
              label="Indexability issues"
              icon={<ShieldAlert />}
              value={s.issues}
              delta={change(h.map((x) => x.issues))}
              invert
              trend={h.length > 1 ? h.map((x) => x.issues) : undefined}
              hint="Monitored URLs Google can't index: errors, redirects, noindex, robots.txt blocks or canonicals pointing elsewhere."
              footer={
                <Link to="/app/audit" className="inline-flex items-center gap-1 hover:text-fg">
                  See what to fix <ArrowRight className="size-3" />
                </Link>
              }
              style={{ animationDelay: '120ms' }}
            />
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <IndexingChart projectId={project?.id} />
        </Card>
        <CoverageCard project={project} loading={loading} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader
          title="URL Status"
          description="Every monitored URL with its latest index inspection"
          actions={
            <Link to="/app/indexing" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary-ink hover:underline">
              Open indexing <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <div className="mt-1">
          <UrlTable projectId={project?.id} pageSize={8} />
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <MovementCard history={h} loading={loading} tracked={s?.trackedBacklinks ?? 0} />
        <AlertsCard />
        <MonitoringCard project={project} />
      </div>

      {projects.length > 1 && (
        <Card className="mt-4">
          <CardHeader
            title="Projects"
            description="Health across every monitored website"
            actions={
              <Link to="/app/projects" className="text-[12.5px] font-medium text-primary-ink hover:underline">
                Manage projects
              </Link>
            }
          />
          <div className="mt-3 grid grid-cols-1 divide-y divide-line-soft border-t border-line-soft sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setProjectId(p.id)}
                className="group flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2 sm:border-b sm:border-line-soft lg:border-b-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <DomainIcon domain={p.domain} size={18} />
                    <span className="truncate text-[13px] font-medium text-fg">{p.domain}</span>
                  </div>
                  <div className="mt-1.5 text-[12px] text-fg-3">
                    <span className="tnum">{formatNumber(p.stats?.indexed ?? 0)} indexed</span>
                  </div>
                </div>
                <MiniScore score={healthScore(p)} />
              </button>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}

function CoverageCard({ project, loading }: { project: Project | undefined; loading: boolean }) {
  const c = useChartColors()
  const s = project?.stats
  const rows = s
    ? [
        { label: 'Indexed', value: s.indexed, color: c.s1, note: 'Eligible to appear in search' },
        { label: 'Crawled – not indexed', value: s.crawled, color: c.s2, note: 'Quality or duplication signal' },
        { label: 'Discovered – not indexed', value: s.discovered, color: c.s3, note: 'Waiting for Googlebot' },
        { label: 'Errors & excluded', value: s.notIndexed, color: c.s4, note: '4xx/5xx, noindex or robots.txt' },
      ]
    : []
  const total = rows.reduce((a, r) => a + r.value, 0)
  const crawled = s?.crawled ?? 0
  return (
    <Card className="flex flex-col">
      <CardHeader title="Index coverage" description={s ? `${formatNumber(total)} of ${formatNumber(s.urls)} URLs inspected by Google` : '—'} />
      {loading || !s ? (
        <div className="p-5">
          <ChartSkeleton height={40} />
        </div>
      ) : total === 0 ? (
        <EmptyState
          className="py-10"
          icon={<ShieldCheck />}
          title="Waiting for Google’s view"
          description={s.urls ? 'Connect Search Console so we can ask Google which of your URLs are indexed.' : 'We’re reading your sitemap. URLs appear here within a few minutes.'}
          action={
            s.urls ? (
              <Link to="/app/settings?tab=integrations">
                <Button size="sm" variant="primary">
                  Connect Search Console
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-1 flex-col p-5">
          <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
            {rows.map((r) => (r.value ? <div key={r.label} className="h-full transition-[width] duration-700" style={{ width: `${(r.value / total) * 100}%`, background: r.color }} /> : null))}
          </div>
          <div className="mt-5 space-y-3.5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-2 shrink-0 rounded-[3px]" style={{ background: r.color }} />
                  <div>
                    <p className="text-[13px] font-medium text-fg">{r.label}</p>
                    <p className="text-[12px] text-fg-4">{r.note}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="tnum text-[13.5px] font-semibold text-fg">{formatNumber(r.value)}</p>
                  <p className="tnum text-[11.5px] text-fg-4">{((r.value / total) * 100).toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
          {crawled > 0 && (
            <div className="mt-auto pt-5">
              <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-soft p-3.5">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="text-[12.5px] leading-relaxed text-fg-2">
                  <span className="font-medium text-fg">
                    {formatNumber(crawled)} {crawled === 1 ? 'page was' : 'pages were'} crawled but not indexed.
                  </span>{' '}
                  Google saw them and passed. Thin or near-duplicate pages are the usual cause — improve, merge or noindex them.
                  <Link to="/app/indexing" className="mt-1.5 flex items-center gap-1 font-medium text-primary-ink hover:underline">
                    Review URLs <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function MovementCard({ history, loading, tracked }: { history: HistoryPoint[]; loading: boolean; tracked: number }) {
  const c = useChartColors()
  const movement = useMemo(() => history.slice(-14).map((p) => ({ date: p.date, gained: p.gained, lost: -p.lost })), [history])
  const gained = movement.reduce((a, x) => a + x.gained, 0)
  const lost = -movement.reduce((a, x) => a + x.lost, 0)
  return (
    <Card>
      <CardHeader
        title="Backlink movement"
        description="Gained vs. lost per day · last 14 days"
        actions={
          <Link to="/app/backlinks" className="text-[12.5px] font-medium text-primary-ink hover:underline">
            Details
          </Link>
        }
      />
      {loading ? (
        <div className="p-5">
          <ChartSkeleton height={190} />
        </div>
      ) : movement.length < 2 ? (
        <EmptyState
          className="py-10"
          icon={<Link2 />}
          title={tracked ? 'History starts tomorrow' : 'No backlinks tracked yet'}
          description={tracked ? `We’re verifying your ${formatNumber(tracked)} links. Daily gains and losses appear here from the second day on.` : 'Import your existing links and we’ll chart every gain and loss from tomorrow on.'}
          action={
            tracked ? undefined : (
              <Link to="/app/backlinks">
                <Button size="sm" leftIcon={<Upload />}>
                  Import backlinks
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="px-5 pt-4">
            <Legend
              items={[
                { key: 'g', label: 'Gained', color: c.s1, value: `+${gained}` },
                { key: 'l', label: 'Lost', color: c.s4, value: `−${lost}` },
              ]}
            />
          </div>
          <div className="px-2 pt-2 pb-3">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={movement} stackOffset="sign" margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap={4}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="date" {...axisProps(c.axis)} tickFormatter={(d) => formatShortDate(d)} minTickGap={24} />
                <YAxis {...axisProps(c.axis)} width={32} tickFormatter={(v) => String(Math.abs(v))} allowDecimals={false} />
                <Tooltip cursor={{ fill: c.grid }} content={(p) => <ChartTooltip {...p} formatLabel={(l) => formatShortDate(l)} valueFormatter={(v) => formatNumber(Math.abs(v))} />} />
                <Bar dataKey="gained" name="Gained" stackId="a" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={14} />
                <Bar dataKey="lost" name="Lost" stackId="a" fill={c.s4} radius={[0, 0, 4, 4]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  )
}

function AlertsCard() {
  const q = useAlerts()
  const alerts = q.data?.alerts ?? []
  return (
    <Card>
      <CardHeader
        title="Needs your attention"
        description="Latest alerts across all projects"
        actions={
          <Link to="/app/alerts" className="text-[12.5px] font-medium text-primary-ink hover:underline">
            All alerts
          </Link>
        }
      />
      {alerts.length === 0 && !q.isLoading ? (
        <EmptyState className="py-10" icon={<BellRing />} title="All quiet" description="When a link disappears or a page drops out of the index, you’ll see it here — and in your inbox." />
      ) : (
        <div className="mt-2 divide-y divide-line-soft px-2 pb-2">
          {alerts.slice(0, 5).map((a) => (
            <Link key={a.id} to={a.href ?? '/app/alerts'} className="group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-surface-2">
              <AlertIcon alert={a} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13px] font-medium text-fg">{a.title}</p>
                  {!a.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                </div>
                <p className="mt-0.5 truncate text-[12px] text-fg-3">
                  {a.project ?? 'Account'} · {timeAgo(a.time)}
                </p>
              </div>
              <ArrowRight className="mt-1 size-3.5 shrink-0 text-fg-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

/** What Indexora is doing for this project right now. */
function MonitoringCard({ project }: { project: Project | undefined }) {
  const me = useMe().data
  const s = project?.stats
  const plan = me?.plan
  const items = [
    {
      ok: !!s?.urls,
      title: 'URL monitoring',
      detail: s?.urls ? `${formatNumber(s.urls)} URLs · checked every ${plan?.limits.urlCheckHours ?? 24}h` : 'Reading your sitemaps…',
      cta: null as null | { label: string; to: string },
    },
    {
      ok: !!project?.gscProperty,
      title: 'Google index status',
      detail: project?.gscProperty ? `${project.gscProperty} · inspected daily` : 'Search Console not connected',
      cta: project?.gscProperty ? null : { label: 'Connect', to: '/app/settings?tab=integrations' },
    },
    {
      ok: !!s?.trackedBacklinks,
      title: 'Backlink verification',
      detail: s?.trackedBacklinks
        ? `${formatNumber(s.trackedBacklinks)} links · re-verified every ${plan?.limits.backlinkCheckHours === 168 ? 'week' : `${plan?.limits.backlinkCheckHours ?? 24}h`}`
        : 'No backlinks imported yet',
      cta: s?.trackedBacklinks ? null : { label: 'Import', to: '/app/backlinks' },
    },
    {
      ok: Boolean(plan?.limits.discovery),
      title: 'New backlink discovery',
      detail: plan?.limits.discovery ? `Weekly on ${plan.name}` : 'Included from the Pro plan',
      cta: plan?.limits.discovery ? null : { label: 'Upgrade', to: '/app/settings?tab=billing' },
    },
  ]
  return (
    <Card className="lg:col-span-2 xl:col-span-1">
      <CardHeader title="Monitoring status" description={project ? `What runs automatically for ${project.domain}` : '—'} />
      <ol className="mt-4 space-y-4 px-5 pb-5">
        {items.map((t) => (
          <li key={t.title} className="flex gap-3">
            {t.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <Clock3 className="mt-0.5 size-4 shrink-0 text-fg-4" />}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-fg">{t.title}</p>
              <p className="mt-0.5 truncate text-[12px] text-fg-3">{t.detail}</p>
            </div>
            {t.cta && (
              <Link to={t.cta.to} className="shrink-0 text-[12.5px] font-medium text-primary-ink hover:underline">
                {t.cta.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}
