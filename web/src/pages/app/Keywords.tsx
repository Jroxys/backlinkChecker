import { useMemo, useState } from 'react'
import { Link } from '@/lib/router'
import { ArrowDown, ArrowUp, Minus, Plus, KeyRound, Trophy, Target, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { MetricCard } from '@/components/ui/MetricCard'
import { MetricCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { SearchInput } from '@/components/ui/Controls'
import { Table, THead, TH, TR, TD } from '@/components/ui/Table'
import { Sparkline } from '@/components/ui/Sparkline'
import { useToast } from '@/components/ui/Toast'
import { keywords } from '@/data/keywords'
import { urls } from '@/data/urls'
import { formatNumber } from '@/utils/format'

export function Keywords() {
  const loading = useSimulatedLoad(600)
  const toast = useToast()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: 'position' | 'volume' | 'change'; dir: 'asc' | 'desc' }>({ key: 'position', dir: 'asc' })

  const rows = useMemo(
    () =>
      keywords
        .filter((k) => k.keyword.includes(q.toLowerCase()))
        .sort((a, b) => (a[sort.key] - b[sort.key]) * (sort.dir === 'asc' ? 1 : -1)),
    [q, sort],
  )
  const toggle = (key: typeof sort.key) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 'asc' ? 'desc' : 'asc') : key === 'position' ? 'asc' : 'desc' }))

  const buckets = [
    { label: '1–3', n: keywords.filter((k) => k.position <= 3).length },
    { label: '4–10', n: keywords.filter((k) => k.position > 3 && k.position <= 10).length },
    { label: '11–20', n: keywords.filter((k) => k.position > 10 && k.position <= 20).length },
    { label: '21+', n: keywords.filter((k) => k.position > 20).length },
  ]
  const avg = keywords.reduce((a, k) => a + k.position, 0) / keywords.length
  const urlId = (path: string) => urls.find((u) => u.path === path)?.id

  return (
    <>
      <PageHeader
        title="Keywords"
        description="Daily rank tracking on Google (United States · desktop & mobile). Connected to your indexed URLs."
        actions={
          <Button variant="primary" leftIcon={<Plus />} onClick={() => toast({ title: 'Add keywords', description: 'Paste up to 500 keywords, one per line.', tone: 'info' })}>
            Add keywords
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard accent label="Tracked keywords" icon={<KeyRound />} value={keywords.length} />
            <MetricCard label="Average position" icon={<Target />} value={avg.toFixed(1)} delta={-9.6} invert trend={[9.8, 9.6, 9.5, 9.1, 8.9, 8.8, 8.6, 8.4, 8.2, 8.1, 7.9, avg]} />
            <MetricCard label="Top 3 rankings" icon={<Trophy />} value={buckets[0].n} delta={25} />
            <MetricCard label="Estimated clicks / mo" icon={<TrendingUp />} value={18420} delta={14.2} trend={[12.1, 12.8, 13.4, 13.1, 14.6, 15.2, 15.9, 16.4, 17.0, 17.6, 18.0, 18.4]} />
          </>
        )}
      </div>

      <Card className="mt-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="heading text-[14px] font-semibold text-fg">Position distribution</h3>
          <span className="text-[12px] text-fg-3">{keywords.length} keywords</span>
        </div>
        <div className="flex h-8 gap-[2px] overflow-hidden rounded-lg">
          {buckets.map((b, i) => (
            <div
              key={b.label}
              className="flex items-center justify-center text-[11.5px] font-semibold text-white"
              style={{ width: `${(b.n / keywords.length) * 100}%`, background: `color-mix(in srgb, var(--primary) ${100 - i * 24}%, var(--surface-3))`, display: b.n ? 'flex' : 'none' }}
            >
              {b.n}
            </div>
          ))}
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

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Rankings" description="Updated today at 06:00" actions={<SearchInput value={q} onChange={setQ} placeholder="Filter keywords…" className="w-56" />} />
        <div className="mt-4">
          {loading ? (
            <TableSkeleton rows={8} cols={6} />
          ) : (
            <Table minWidth={940}>
              <THead>
                <TH>Keyword</TH>
                <TH sortable sorted={sort.key === 'position' && sort.dir} onSort={() => toggle('position')} align="right">
                  Position
                </TH>
                <TH sortable sorted={sort.key === 'change' && sort.dir} onSort={() => toggle('change')}>
                  Change
                </TH>
                <TH>12 weeks</TH>
                <TH sortable sorted={sort.key === 'volume' && sort.dir} onSort={() => toggle('volume')} align="right">
                  Volume
                </TH>
                <TH>Difficulty</TH>
                <TH>Intent</TH>
                <TH>Ranking URL</TH>
              </THead>
              <tbody>
                {rows.map((k) => (
                  <TR key={k.id}>
                    <TD className="font-medium text-fg">{k.keyword}</TD>
                    <TD align="right" className="tnum text-[14px] font-semibold text-fg">
                      {k.position}
                    </TD>
                    <TD>
                      <span
                        className={cn(
                          'tnum inline-flex items-center gap-0.5 text-[12.5px] font-medium',
                          k.change > 0 ? 'text-success-ink' : k.change < 0 ? 'text-error-ink' : 'text-fg-4',
                        )}
                      >
                        {k.change > 0 ? <ArrowUp className="size-3" /> : k.change < 0 ? <ArrowDown className="size-3" /> : <Minus className="size-3" />}
                        {Math.abs(k.change) || ''}
                      </span>
                    </TD>
                    <TD>
                      {/* Inverted so “up” always means a better ranking */}
                      <Sparkline data={k.trend.map((p) => -p)} width={84} height={24} fill={false} color={k.change >= 0 ? 'var(--primary)' : 'var(--error)'} />
                    </TD>
                    <TD align="right" className="tnum">
                      {formatNumber(k.volume)}
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-2">
                        <span className="tnum w-5 text-fg">{k.difficulty}</span>
                        <span className="h-1 w-14 overflow-hidden rounded-full bg-surface-3">
                          <span className="block h-full rounded-full bg-fg-3" style={{ width: `${k.difficulty}%` }} />
                        </span>
                      </span>
                    </TD>
                    <TD>
                      <Badge size="xs" tone={k.intent === 'Commercial' || k.intent === 'Transactional' ? 'primary' : 'neutral'}>
                        {k.intent}
                      </Badge>
                    </TD>
                    <TD className="font-mono text-[12.5px]">
                      {urlId(k.url) ? (
                        <Link to={`/app/indexing/${urlId(k.url)}`} className="hover:text-primary-ink hover:underline">
                          {k.url}
                        </Link>
                      ) : (
                        k.url
                      )}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>
    </>
  )
}
