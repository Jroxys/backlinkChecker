import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowRight,
  FileCheck2,
  FolderKanban,
  Globe2,
  Link2,
  Play,
  ShieldAlert,
  Clock3,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import { currentUser } from '@/lib/user'
import { useChartColors } from '@/lib/chartColors'
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad'
import { greeting, formatNumber, timeAgo, formatShortDate } from '@/utils/format'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Dropdown'
import { DatePicker, rangeFromPreset, type DateRange } from '@/components/ui/DatePicker'
import { MetricCard } from '@/components/ui/MetricCard'
import { MetricCardSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { MiniScore } from '@/components/ui/ScoreRing'
import { DomainIcon } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { ChartTooltip, Legend, axisProps } from '@/components/charts/ChartParts'
import { IndexingChart } from '@/components/domain/IndexingChart'
import { UrlTable } from '@/components/domain/UrlTable'
import { AlertIcon } from '@/components/AlertIcon'
import { projects } from '@/data/projects'
import { urls } from '@/data/urls'
import { alerts } from '@/data/alerts'
import { backlinkSeries, indexSeries, lastDays } from '@/data/series'
import { nightlyTimeline } from '@/data/automations'

const projectOptions = [
  { value: 'all', label: 'All Projects', hint: String(projects.length) },
  ...projects.map((p) => ({ value: p.id, label: p.domain })),
]

export function Dashboard() {
  const [project, setProject] = useState('all')
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset('30d'))
  const loading = useSimulatedLoad(700, [project, range.preset, range.from.getTime()])
  const toast = useToast()
  const c = useChartColors()

  const idx = lastDays(indexSeries, 30).map((p) => p.indexed)
  const bl = lastDays(backlinkSeries, 30)
  const movement = useMemo(
    () =>
      lastDays(backlinkSeries, 14).map((p) => ({
        date: p.date,
        gained: p.gained,
        lost: -p.lost,
      })),
    [],
  )
  const gained14 = movement.reduce((a, x) => a + x.gained, 0)
  const lost14 = -movement.reduce((a, x) => a + x.lost, 0)

  return (
    <>
      {/* Greeting */}
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2.5 flex flex-wrap items-center gap-3">
            <StatusIndicator state="online" pulse label="Monitoring 5 projects" />
            <span className="hidden h-3 w-px bg-line sm:block" />
            <span className="hidden text-[12.5px] text-fg-3 sm:inline">Last scan completed {timeAgo('2026-10-02T03:00:00Z')}</span>
          </div>
          <h1 className="heading text-[24px] leading-tight font-semibold text-fg sm:text-[28px]">
            {greeting()}, {currentUser.firstName}
          </h1>
          <p className="mt-1.5 text-[14px] text-fg-3">Here’s what’s happening across your websites.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={project} options={projectOptions} onChange={setProject} icon={<FolderKanban />} width={260} />
          <DatePicker value={range} onChange={setRange} />
          <Button
            variant="primary"
            leftIcon={<Play />}
            onClick={() =>
              toast({ title: 'Scan started', description: 'Crawling 5 projects. You’ll be notified when results are ready.', tone: 'info' })
            }
          >
            Run scan
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard
              accent
              label="Indexed URLs"
              icon={<FileCheck2 />}
              value={1284}
              delta={12.4}
              trend={idx}
              hint="URLs Google reports as “Submitted and indexed” or “Indexed, not submitted in sitemap”."
              footer={
                <span>
                  <span className="tnum font-medium text-fg-2">84.2%</span> of 1,525 known URLs
                </span>
              }
            />
            <MetricCard
              label="Backlinks"
              icon={<Link2 />}
              value={8421}
              delta={8.2}
              trend={bl.map((p) => p.total)}
              footer={
                <span>
                  <span className="tnum font-medium text-success-ink">+214</span> new ·{' '}
                  <span className="tnum font-medium text-error-ink">−61</span> lost this period
                </span>
              }
              style={{ animationDelay: '40ms' }}
            />
            <MetricCard
              label="Referring Domains"
              icon={<Globe2 />}
              value={642}
              delta={5.7}
              trend={bl.map((p) => p.refDomains)}
              footer={
                <span>
                  <span className="tnum font-medium text-fg-2">71%</span> dofollow · avg. authority{' '}
                  <span className="tnum font-medium text-fg-2">54</span>
                </span>
              }
              style={{ animationDelay: '80ms' }}
            />
            <MetricCard
              label="SEO Issues"
              icon={<ShieldAlert />}
              value={23}
              delta={-18.4}
              invert
              trend={[34, 33, 33, 31, 31, 30, 29, 29, 28, 27, 27, 25, 24, 24, 23]}
              footer={
                <span>
                  <span className="tnum font-medium text-error-ink">7 errors</span> ·{' '}
                  <span className="tnum font-medium text-fg-2">16 warnings</span>
                </span>
              }
              style={{ animationDelay: '120ms' }}
            />
          </>
        )}
      </div>

      {/* Indexing chart + coverage */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <IndexingChart loading={loading} />
        </Card>
        <CoverageCard loading={loading} />
      </div>

      {/* URL table */}
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
          <UrlTable data={urls} loading={loading} pageSize={8} />
        </div>
      </Card>

      {/* Bottom row */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
          <div className="px-5 pt-4">
            <Legend
              items={[
                { key: 'g', label: 'Gained', color: c.s1, value: `+${gained14}` },
                { key: 'l', label: 'Lost', color: c.s4, value: `−${lost14}` },
              ]}
            />
          </div>
          <div className="px-2 pt-2 pb-3">
            {loading ? (
              <ChartSkeleton height={190} />
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={movement} stackOffset="sign" margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap={4}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="date" {...axisProps(c.axis)} tickFormatter={(d) => formatShortDate(d)} minTickGap={24} />
                  <YAxis {...axisProps(c.axis)} width={32} tickFormatter={(v) => String(Math.abs(v))} />
                  <Tooltip
                    cursor={{ fill: c.grid }}
                    content={(p) => (
                      <ChartTooltip {...p} formatLabel={(l) => formatShortDate(l)} valueFormatter={(v) => formatNumber(Math.abs(v))} />
                    )}
                  />
                  <Bar dataKey="gained" name="Gained" stackId="a" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="lost" name="Lost" stackId="a" fill={c.s4} radius={[0, 0, 4, 4]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

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
          <div className="mt-2 divide-y divide-line-soft px-2 pb-2">
            {alerts.slice(0, 5).map((a) => (
              <Link
                key={a.id}
                to={a.href}
                className="group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-surface-2"
              >
                <AlertIcon alert={a} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-medium text-fg">{a.title}</p>
                    {!a.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-fg-3">
                    {a.project} · {timeAgo(a.time)}
                  </p>
                </div>
                <ArrowRight className="mt-1 size-3.5 shrink-0 text-fg-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader
            title="Last night’s run"
            description="Automations completed on schedule"
            actions={<StatusIndicator state="online" label="All passed" />}
          />
          <ol className="relative mt-4 space-y-0 px-5 pb-5">
            {nightlyTimeline.map((t, i) => (
              <li key={t.time} className="relative flex gap-3.5 pb-4 last:pb-0">
                {i < nightlyTimeline.length - 1 && (
                  <span className="absolute top-6 bottom-0 left-[9px] w-px bg-gradient-to-b from-primary/40 to-line" />
                )}
                <span className="relative z-[1] mt-0.5 flex size-[19px] shrink-0 items-center justify-center rounded-full bg-primary-soft ring-4 ring-surface">
                  <CheckCircle2 className="size-3.5 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-fg">{t.title}</p>
                    <span className="tnum font-mono text-[11.5px] text-fg-4">{t.time}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-fg-3">{t.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* Projects health */}
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
            <Link
              key={p.id}
              to="/app/projects"
              className="group flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-2 sm:border-b sm:border-line-soft lg:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <DomainIcon domain={p.domain} size={18} />
                  <span className="truncate text-[13px] font-medium text-fg">{p.domain}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[12px] text-fg-3">
                  <StatusIndicator
                    state={p.status === 'healthy' ? 'online' : p.status === 'warning' ? 'warning' : p.status === 'critical' ? 'error' : 'running'}
                    pulse={p.status === 'scanning'}
                  />
                  <span className="tnum">{formatNumber(p.indexedUrls)} indexed</span>
                </div>
              </div>
              <MiniScore score={p.seoScore} />
            </Link>
          ))}
        </div>
      </Card>

      <div className="mt-6 flex items-center justify-center gap-2 text-[12px] text-fg-4">
        <Clock3 className="size-3.5" /> Data refreshed {timeAgo('2026-10-02T09:00:00Z')} · Next automated check at 14:15
      </div>
    </>
  )
}

function CoverageCard({ loading }: { loading: boolean }) {
  const c = useChartColors()
  const rows = [
    { label: 'Indexed', value: 1284, color: c.s1, note: 'Eligible to appear in search' },
    { label: 'Crawled – not indexed', value: 142, color: c.s2, note: 'Quality or duplication signal' },
    { label: 'Discovered – not indexed', value: 87, color: c.s3, note: 'Waiting for Googlebot' },
    { label: 'Errors', value: 12, color: c.s4, note: '4xx/5xx or redirect errors' },
  ]
  const total = rows.reduce((a, r) => a + r.value, 0)
  return (
    <Card className="flex flex-col">
      <CardHeader title="Index coverage" description={`${formatNumber(total)} URLs known to Google`} />
      {loading ? (
        <div className="space-y-4 p-5">
          <ChartSkeleton height={40} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col p-5">
          <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
            {rows.map((r) => (
              <div
                key={r.label}
                className="h-full transition-[width] duration-700 first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(r.value / total) * 100}%`, background: r.color }}
              />
            ))}
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
          <div className="mt-auto pt-5">
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-soft p-3.5">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="text-[12.5px] leading-relaxed text-fg-2">
                <span className="font-medium text-fg">142 pages crawled but not indexed.</span> 61 of them are tag archives with under 300
                words — consolidating them could recover crawl budget.
                <Link to="/app/indexing" className="mt-1.5 flex items-center gap-1 font-medium text-primary-ink hover:underline">
                  Review URLs <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
