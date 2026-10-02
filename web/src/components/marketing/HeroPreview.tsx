import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from 'recharts'
import { CheckCircle2, Eye, CircleDashed, XCircle, LayoutDashboard, ScanSearch, Link2, ShieldCheck, Swords, Bell } from 'lucide-react'
import { useChartColors } from '@/lib/chartColors'
import { indexSeries, lastDays } from '@/data/series'
import { LogoMark } from '@/components/ui/Logo'
import { Sparkline } from '@/components/ui/Sparkline'
import { formatShortDate } from '@/utils/format'

const kpis = [
  { label: 'Indexed URLs', value: '1,284', delta: '+12.4%', trend: [11, 12, 12, 13, 14, 14, 15, 17, 18] },
  { label: 'Backlinks', value: '8,421', delta: '+8.2%', trend: [10, 11, 11, 12, 12, 13, 14, 14, 15] },
  { label: 'Ref. Domains', value: '642', delta: '+5.7%', trend: [8, 8, 9, 9, 10, 10, 11, 11, 12] },
  { label: 'SEO Issues', value: '23', delta: '−18.4%', trend: [16, 15, 15, 14, 13, 13, 12, 11, 10] },
]

const rows = [
  { path: '/blog/technical-seo-guide', status: 'Indexed', icon: CheckCircle2, tone: 'text-success-ink bg-success-soft' },
  { path: '/blog/google-indexing-guide', status: 'Indexed', icon: CheckCircle2, tone: 'text-success-ink bg-success-soft' },
  { path: '/tag/link-building?page=4', status: 'Crawled – Not Indexed', icon: Eye, tone: 'text-warning-ink bg-warning-soft' },
  { path: '/events/seo-summit-2026', status: 'Discovered', icon: CircleDashed, tone: 'text-fg-2 bg-neutral-soft' },
  { path: '/old-pricing', status: 'Error 404', icon: XCircle, tone: 'text-error-ink bg-error-soft' },
]

/** A faithful, compact rendering of the real dashboard — no screenshots. */
export function HeroPreview() {
  const c = useChartColors()
  const data = lastDays(indexSeries, 60)
  return (
    <div className="relative rounded-2xl border border-line bg-surface/60 p-1.5 shadow-pop backdrop-blur">
      <div className="overflow-hidden rounded-xl border border-line bg-bg">
        {/* window chrome */}
        <div className="flex h-9 items-center gap-2 border-b border-line bg-surface px-3">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <div className="mx-auto flex h-5 w-60 items-center justify-center rounded-md bg-surface-3 text-[10.5px] text-fg-4">app.indexora.com/dashboard</div>
        </div>
        <div className="flex">
          <div className="hidden w-40 shrink-0 border-r border-line p-2.5 md:block">
            <div className="mb-3 flex items-center gap-1.5 px-1.5">
              <LogoMark size={16} />
              <span className="text-[11.5px] font-semibold text-fg">Indexora</span>
            </div>
            {[
              [LayoutDashboard, 'Dashboard', true],
              [ScanSearch, 'Indexing'],
              [Link2, 'Backlinks'],
              [ShieldCheck, 'SEO Audit'],
              [Swords, 'Competitors'],
              [Bell, 'Alerts'],
            ].map(([I, l, a]) => {
              const Icon = I as typeof Bell
              return (
                <div key={l as string} className={`mb-0.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-[11px] ${a ? 'bg-surface text-fg shadow-xs ring-1 ring-line' : 'text-fg-3'}`}>
                  <Icon className={`size-3 ${a ? 'text-primary' : ''}`} />
                  {l as string}
                </div>
              )
            })}
          </div>
          <div className="min-w-0 flex-1 p-3 sm:p-4">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <div className="text-[13px] font-semibold text-fg sm:text-[14px]">Good morning, Ömer</div>
                <div className="text-[10.5px] text-fg-3">Here’s what’s happening across your websites.</div>
              </div>
              <div className="hidden items-center gap-1.5 sm:flex">
                <span className="rounded-md border border-line bg-surface px-2 py-1 text-[10px] text-fg-2">All Projects</span>
                <span className="rounded-md border border-line bg-surface px-2 py-1 text-[10px] text-fg-2">Last 30 days</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {kpis.map((k, i) => (
                <div key={k.label} className="rounded-lg border border-line bg-surface p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-fg-3">{k.label}</span>
                    <span className="tnum rounded bg-success-soft px-1 text-[9.5px] font-medium text-success-ink">{k.delta}</span>
                  </div>
                  <div className="mt-1.5 flex items-end justify-between gap-1">
                    <span className="tnum text-[17px] leading-none font-semibold text-fg">{k.value}</span>
                    <Sparkline data={k.trend} width={48} height={18} color={i === 3 ? 'var(--primary)' : 'var(--primary)'} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-5">
              <div className="rounded-lg border border-line bg-surface p-2.5 lg:col-span-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-fg">Indexing Performance</span>
                  <div className="flex gap-0.5 rounded-md bg-surface-3 p-0.5 text-[9px]">
                    {['7D', '30D', '90D', '1Y'].map((r) => (
                      <span key={r} className={`rounded px-1.5 py-0.5 ${r === '90D' ? 'bg-surface text-fg shadow-xs' : 'text-fg-4'}`}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={128}>
                  <AreaChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="hp" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={c.s1} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={c.s1} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={c.grid} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: c.axis, fontSize: 9 }} tickFormatter={(d) => formatShortDate(d)} minTickGap={40} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: c.axis, fontSize: 9 }} domain={['dataMin - 30', 'dataMax + 10']} tickFormatter={(v) => Math.round(v).toLocaleString('en-US')} />
                    <Area type="monotone" dataKey="indexed" stroke={c.s1} strokeWidth={1.75} fill="url(#hp)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-lg border border-line bg-surface p-2.5 lg:col-span-2">
                <div className="mb-1.5 text-[11px] font-semibold text-fg">URL Status</div>
                <div className="space-y-1">
                  {rows.map((r) => (
                    <div key={r.path} className="flex items-center justify-between gap-2 rounded-md px-1 py-1 text-[10px]">
                      <span className="truncate font-mono text-fg-2">{r.path}</span>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-medium ${r.tone}`}>
                        <r.icon className="size-2.5" />
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
