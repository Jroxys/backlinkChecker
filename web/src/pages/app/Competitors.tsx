import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, Crown, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useChartColors } from '@/lib/chartColors'
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DomainIcon } from '@/components/ui/Avatar'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { ChartTooltip, Legend, axisProps } from '@/components/charts/ChartParts'
import { competitors, linkGap, refDomainTrend } from '@/data/competitors'
import { formatNumber } from '@/utils/format'

const metrics: { key: keyof (typeof competitors)[number]; label: string; lowerIsBetter?: boolean }[] = [
  { key: 'refDomains', label: 'Referring Domains' },
  { key: 'backlinks', label: 'Backlinks' },
  { key: 'indexed', label: 'Indexed Pages' },
  { key: 'issues', label: 'SEO Issues', lowerIsBetter: true },
  { key: 'newBacklinks', label: 'New Backlinks (30d)' },
  { key: 'lostBacklinks', label: 'Lost Backlinks (30d)', lowerIsBetter: true },
  { key: 'keywords', label: 'Ranking Keywords' },
]

export function Competitors() {
  const loading = useSimulatedLoad(650)
  const c = useChartColors()
  const toast = useToast()
  const colors = [c.s1, c.s2, c.s3, c.s4]
  const keys = ['you', 'a', 'b', 'c'] as const
  const totalGap = linkGap.shared + linkGap.onlyYou + linkGap.onlyCompetitors

  return (
    <>
      <PageHeader
        title="Competitors"
        description="How northwindlabs.com compares to the 3 competitors you track. Data refreshed weekly on Mondays."
        actions={
          <Button variant="primary" leftIcon={<Plus />} onClick={() => toast({ title: 'Add a competitor', description: 'You can track up to 5 competitors per project on Growth.', tone: 'info' })}>
            Add competitor
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {competitors.map((x, i) => (
          <Card key={x.domain} className={cn('relative overflow-hidden p-4', x.you && 'border-primary/40')}>
            <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: colors[i] }} />
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-medium text-fg-3">{x.label}</span>
              {x.you && <Badge tone="primary" size="xs">You</Badge>}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <DomainIcon domain={x.domain} size={22} />
              <span className="truncate text-[14px] font-semibold text-fg">{x.domain}</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="tnum text-[22px] leading-none font-semibold text-fg">{x.authority}</span>
              <span className="text-[12px] text-fg-3">domain authority</span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Head-to-head" description="Best value in each row is marked. Bars are relative to the leader." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="border-y border-line bg-surface-2">
                <th className="h-9 px-5 text-left text-[11.5px] font-medium text-fg-3">Metric</th>
                {competitors.map((x, i) => (
                  <th key={x.domain} className="h-9 px-4 text-left text-[11.5px] font-medium text-fg-3">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-[3px]" style={{ background: colors[i] }} />
                      {x.you ? 'Your website' : x.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const vals = competitors.map((x) => x[m.key] as number)
                const best = m.lowerIsBetter ? Math.min(...vals) : Math.max(...vals)
                const max = Math.max(...vals)
                return (
                  <tr key={m.key} className="border-b border-line-soft last:border-0 hover:bg-surface-2">
                    <td className="px-5 py-3.5 font-medium text-fg-2">{m.label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('tnum font-semibold', v === best ? 'text-fg' : 'text-fg-2')}>{formatNumber(v)}</span>
                          {v === best && <Crown className="size-3.5 text-primary" />}
                        </div>
                        <div className="mt-1.5 h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-surface-3">
                          <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: colors[i], opacity: competitors[i].you ? 1 : 0.65 }} />
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Backlink gap" description="Referring domains split by who they link to" />
          <div className="p-5">
            <div className="flex h-12 gap-[2px] overflow-hidden rounded-xl">
              <div className="flex items-center justify-center bg-primary text-[12px] font-semibold text-white" style={{ width: `${(linkGap.onlyYou / totalGap) * 100}%` }}>
                {linkGap.onlyYou}
              </div>
              <div className="flex items-center justify-center bg-primary-light text-[12px] font-semibold text-white" style={{ width: `${(linkGap.shared / totalGap) * 100}%` }}>
                {linkGap.shared}
              </div>
              <div
                className="flex items-center justify-center text-[12px] font-semibold text-fg-2"
                style={{
                  width: `${(linkGap.onlyCompetitors / totalGap) * 100}%`,
                  background: 'repeating-linear-gradient(135deg, var(--surface-3) 0 6px, var(--line) 6px 8px)',
                }}
              >
                {formatNumber(linkGap.onlyCompetitors)} gap domains
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-fg-3">
              <span className="flex items-center gap-2"><span className="size-2 rounded-[3px] bg-primary" />Only link to you</span>
              <span className="flex items-center gap-2"><span className="size-2 rounded-[3px] bg-primary-light" />Shared with competitors</span>
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-[3px]" style={{ background: 'repeating-linear-gradient(135deg, var(--surface-3) 0 2px, var(--line-strong) 2px 3px)' }} />
                Link to competitors only
              </span>
            </div>

            <div className="mt-6 mb-1 text-[12px] font-medium text-fg-3">Referring domains by authority band</div>
            <Legend className="mb-2" items={competitors.map((x, i) => ({ key: keys[i], label: x.domain, color: colors[i] }))} />
            {loading ? (
              <ChartSkeleton height={220} />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={linkGap.gapByAuthority} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%" barGap={2}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="bucket" {...axisProps(c.axis)} />
                  <YAxis {...axisProps(c.axis)} width={36} />
                  <Tooltip cursor={{ fill: c.grid }} content={(p) => <ChartTooltip {...p} formatLabel={(l) => `Authority ${l}`} />} />
                  {keys.map((k, i) => (
                    <Bar key={k} dataKey={k} name={competitors[i].domain} fill={colors[i]} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="flex flex-col xl:col-span-2">
          <CardHeader title="Biggest gaps" description="High-authority domains linking to competitors, not you" />
          <div className="mt-3 divide-y divide-line-soft border-t border-line-soft">
            {linkGap.topGapDomains.map((d) => (
              <div key={d.domain} className="flex items-center gap-3 px-5 py-3">
                <DomainIcon domain={d.domain} size={22} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-fg">{d.domain}</div>
                  <div className="text-[11.5px] text-fg-4">Links to competitor {d.linksTo.join(', ')}</div>
                </div>
                <span className="tnum text-[13px] font-semibold text-fg">{d.authority}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto p-5">
            <Link to="/app/opportunities">
              <Button variant="soft" className="w-full" leftIcon={<Sparkles />} rightIcon={<ArrowRight />}>
                Turn gaps into opportunities
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Referring domain growth" description="Last 12 months" />
        <div className="px-5 pt-3">
          <Legend items={competitors.map((x, i) => ({ key: keys[i], label: x.domain, color: colors[i], value: formatNumber(x.refDomains) }))} />
        </div>
        <div className="px-2 pt-3 pb-3 sm:px-3">
          {loading ? (
            <ChartSkeleton height={260} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={refDomainTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="month" {...axisProps(c.axis)} />
                <YAxis {...axisProps(c.axis)} width={48} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip cursor={{ stroke: c.cursor, strokeDasharray: '3 3' }} content={(p) => <ChartTooltip {...p} />} />
                {keys.map((k, i) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={competitors[i].domain}
                    stroke={colors[i]}
                    strokeWidth={i === 0 ? 2.5 : 1.75}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </>
  )
}
