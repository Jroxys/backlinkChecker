import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartColors } from '@/lib/chartColors'
import { useHistory } from '@/api/hooks'
import type { HistoryPoint } from '@/api/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { LineChart as LineIcon } from 'lucide-react'
import { ChartTooltip, Legend, axisProps, niceDomain } from '@/components/charts/ChartParts'
import { Segmented } from '@/components/ui/Tabs'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import { Delta } from '@/components/ui/Delta'
import { formatNumber, formatShortDate } from '@/utils/format'

export type Range = '7D' | '30D' | '90D' | '1Y'
const days: Record<Range, number> = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 }

const series = [
  { key: 'indexed', label: 'Indexed', color: 's1' },
  { key: 'crawled', label: 'Crawled', color: 's2' },
  { key: 'discovered', label: 'Discovered', color: 's3' },
  { key: 'not_indexed', label: 'Not Indexed', color: 's4' },
] as const

type Key = 'indexed' | 'crawled' | 'discovered' | 'not_indexed'

export function IndexingChart({ projectId, height = 300 }: { projectId: string | undefined; height?: number }) {
  const [range, setRange] = useState<Range>('30D')
  const [hidden, setHidden] = useState<string[]>([])
  const c = useChartColors()
  const q = useHistory(projectId, days[range])
  const loading = q.isLoading

  const data = useMemo(() => {
    const xs = q.data ?? []
    if (range !== '1Y') return xs
    const out: HistoryPoint[] = []
    for (let i = xs.length % 7; i < xs.length; i += 7) out.push(xs[Math.min(xs.length - 1, i + 6)])
    return out
  }, [q.data, range])

  const first = data[0]
  const last = data[data.length - 1]
  const pct = (k: Key) => (first && last && first[k] ? ((last[k] - first[k]) / first[k]) * 100 : 0)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4.5">
        <div>
          <h3 className="heading text-[14px] font-semibold text-fg">Indexing Performance</h3>
          <p className="mt-0.5 text-[12.5px] text-fg-3">URL coverage reported by Google across all monitored URLs</p>
        </div>
        <Segmented
          items={(['7D', '30D', '90D', '1Y'] as Range[]).map((r) => ({ value: r, label: r }))}
          value={range}
          onChange={setRange}
        />
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden border-y border-line-soft bg-line-soft mt-4 sm:grid-cols-4">
        {series.map((s) => {
          const off = hidden.includes(s.key)
          return (
            <button
              key={s.key}
              onClick={() => setHidden((h) => (h.includes(s.key) ? h.filter((x) => x !== s.key) : [...h, s.key]))}
              className="group bg-surface px-5 py-3 text-left transition-colors hover:bg-surface-2"
              aria-pressed={!off}
            >
              <div className="flex items-center gap-2 text-[12px] text-fg-3">
                <span className="size-2 rounded-[3px] transition-opacity" style={{ background: c[s.color], opacity: off ? 0.3 : 1 }} />
                <span className={off ? 'line-through' : ''}>{s.label}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="tnum text-[18px] font-semibold text-fg">{last ? formatNumber(last[s.key]) : '—'}</span>
                <Delta value={pct(s.key)} invert={s.key !== 'indexed'} className="!px-1 !py-0 !text-[11px]" />
              </div>
            </button>
          )
        })}
      </div>

      <div className="px-2 pt-4 pb-3 sm:px-3">
        {loading ? (
          <ChartSkeleton height={height} />
        ) : data.length < 2 ? (
          <EmptyState
            className="py-12"
            icon={<LineIcon />}
            title="Your trend line starts tomorrow"
            description="We take a snapshot of index coverage every day. After the second snapshot you’ll see how indexing moves over time."
          />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.round(height * 0.62)}>
              <AreaChart data={data} syncId="indexing" margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ix-indexed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.s1} stopOpacity={0.26} />
                    <stop offset="100%" stopColor={c.s1} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="date" hide />
                <YAxis
                  {...axisProps(c.axis)}
                  width={52}
                  domain={niceDomain(range === '1Y' ? 100 : 25)}
                  tickFormatter={(v) => formatNumber(Math.round(v))}
                  tickCount={5}
                />
                <Tooltip
                  cursor={{ stroke: c.cursor, strokeWidth: 1, strokeDasharray: '3 3' }}
                  content={(p) => <ChartTooltip {...p} formatLabel={(l) => formatShortDate(l) + (range === '1Y' ? ' (week)' : '')} />}
                />
                {!hidden.includes('indexed') && (
                  <Area
                    type="monotone"
                    dataKey="indexed"
                    name="Indexed"
                    stroke={c.s1}
                    strokeWidth={2}
                    fill="url(#ix-indexed)"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }}
                    animationDuration={700}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-2 px-3 pt-2 pb-1 text-[11px] font-medium text-fg-4">
              <span className="h-px flex-1 bg-line-soft" />
              Not indexed breakdown
              <span className="h-px flex-1 bg-line-soft" />
            </div>
            <ResponsiveContainer width="100%" height={Math.round(height * 0.38)}>
              <LineChart data={data} syncId="indexing" margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="date" {...axisProps(c.axis)} tickFormatter={(d) => formatShortDate(d)} minTickGap={36} />
                <YAxis {...axisProps(c.axis)} width={52} tickCount={3} />
                <Tooltip
                  cursor={{ stroke: c.cursor, strokeWidth: 1, strokeDasharray: '3 3' }}
                  content={(p) => <ChartTooltip {...p} formatLabel={(l) => formatShortDate(l) + (range === '1Y' ? ' (week)' : '')} />}
                />
                {series.slice(1).map((s) =>
                  hidden.includes(s.key) ? null : (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={c[s.color]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }}
                      animationDuration={700}
                    />
                  ),
                )}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
        <Legend
          className="px-3 pt-2 sm:hidden"
          items={series.map((s) => ({ key: s.key, label: s.label, color: c[s.color] }))}
          hidden={hidden}
        />
      </div>
    </div>
  )
}
