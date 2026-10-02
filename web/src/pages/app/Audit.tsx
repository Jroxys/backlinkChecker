import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CheckCircle2, ChevronDown, Cog, FileText, Gauge, Link2, Play, ScanSearch, Braces, XCircle, Download, Wrench } from 'lucide-react'
import type { AuditCategoryKey } from '@/types'
import { cn } from '@/lib/cn'
import { useChartColors } from '@/lib/chartColors'
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { Segmented } from '@/components/ui/Tabs'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { ChartTooltip, axisProps } from '@/components/charts/ChartParts'
import { auditCategories, auditChecks, scoreHistory, vitals } from '@/data/audit'

const catIcon: Record<AuditCategoryKey, typeof Cog> = {
  technical: Cog,
  content: FileText,
  performance: Gauge,
  indexing: ScanSearch,
  links: Link2,
  structured: Braces,
}

export function Audit() {
  const loading = useSimulatedLoad(700)
  const c = useChartColors()
  const toast = useToast()
  const [cat, setCat] = useState<AuditCategoryKey | 'all'>('all')
  const [sev, setSev] = useState<'issues' | 'passed'>('issues')
  const [open, setOpen] = useState<string | null>('c1')

  const totals = auditCategories.reduce((a, x) => ({ passed: a.passed + x.passed, warnings: a.warnings + x.warnings, errors: a.errors + x.errors }), {
    passed: 0,
    warnings: 0,
    errors: 0,
  })

  const checks = auditChecks
    .filter((x) => (cat === 'all' || x.category === cat) && (sev === 'passed' ? x.severity === 'passed' : x.severity !== 'passed'))
    .sort((a, b) => (a.severity === b.severity ? b.affected - a.affected : a.severity === 'error' ? -1 : 1))

  return (
    <>
      <PageHeader
        title="SEO Audit"
        description="142 checks across 1,525 URLs. Last full crawl Sep 28 · 2m 41s · next run Monday 02:00."
        actions={
          <>
            <Button leftIcon={<Download />} onClick={() => toast({ title: 'Generating PDF', description: 'Technical SEO Report will be ready in a moment.', tone: 'info' })}>
              Export PDF
            </Button>
            <Button variant="primary" leftIcon={<Play />} onClick={() => toast({ title: 'Audit started', description: 'Crawling northwindlabs.com — about 3 minutes.', tone: 'info' })}>
              Run audit
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]" />
          <div className="relative flex flex-col items-center px-5 pt-6 pb-5">
            {loading ? <Skeleton className="size-[188px] rounded-full" /> : <ScoreRing score={87} size={188} sublabel="+4 since last audit" />}
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
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Score over time" description="Monthly audit score · trending up for 3 consecutive audits" />
          <div className="px-2 pt-4 pb-2 sm:px-3">
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={scoreHistory} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sh" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={c.s1} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={c.s1} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="date" {...axisProps(c.axis)} />
                <YAxis {...axisProps(c.axis)} width={40} domain={[60, 100]} ticks={[60, 80, 100]} />
                <Tooltip cursor={{ stroke: c.cursor, strokeDasharray: '3 3' }} content={(p) => <ChartTooltip {...p} />} />
                <Area type="monotone" dataKey="score" name="SEO score" stroke={c.s1} strokeWidth={2} fill="url(#sh)" dot={{ r: 3, fill: c.s1, stroke: c.surface, strokeWidth: 2 }} activeDot={{ r: 5, strokeWidth: 2, stroke: c.surface }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 divide-x divide-line-soft border-t border-line-soft">
            {vitals.map((v) => (
              <div key={v.name} className="px-5 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-fg-3">{v.name}</span>
                  <Badge size="xs" tone="success">Good</Badge>
                </div>
                <div className="tnum mt-1.5 text-[18px] font-semibold text-fg">{v.value}</div>
                <div className="mt-0.5 text-[11.5px] text-fg-4">
                  {v.good}% of loads {v.target}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {auditCategories.map((a) => {
          const Icon = catIcon[a.key]
          const total = a.passed + a.warnings + a.errors
          const active = cat === a.key
          return (
            <button
              key={a.key}
              onClick={() => setCat(active ? 'all' : a.key)}
              className={cn(
                'group rounded-xl border bg-surface p-4 text-left shadow-xs transition-all duration-200',
                active ? 'border-primary ring-3 ring-[var(--ring)]' : 'border-line hover:border-line-strong hover:shadow-card',
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-2">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <div className="text-[13.5px] font-semibold text-fg">{a.name}</div>
                    <div className="text-[12px] text-fg-4">{a.description}</div>
                  </div>
                </div>
                <span className="tnum text-[20px] font-semibold text-fg">{a.score}</span>
              </div>
              <div className="mt-4 flex h-1.5 gap-[2px] overflow-hidden rounded-full">
                <div className="bg-success" style={{ width: `${(a.passed / total) * 100}%` }} />
                <div className="bg-warning" style={{ width: `${(a.warnings / total) * 100}%` }} />
                <div className="bg-error" style={{ width: `${(a.errors / total) * 100}%` }} />
              </div>
              <div className="tnum mt-2.5 flex gap-4 text-[12px] text-fg-3">
                <span><span className="font-semibold text-fg">{a.passed}</span> passed</span>
                <span><span className="font-semibold text-fg">{a.warnings}</span> warnings</span>
                <span><span className={cn('font-semibold', a.errors ? 'text-error-ink' : 'text-fg')}>{a.errors}</span> errors</span>
              </div>
            </button>
          )
        })}
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4.5 pb-4">
          <div>
            <h3 className="heading text-[14px] font-semibold text-fg">
              {cat === 'all' ? 'All checks' : auditCategories.find((x) => x.key === cat)!.name + ' checks'}
            </h3>
            <p className="mt-0.5 text-[12.5px] text-fg-3">Sorted by impact. Fix errors first — they block indexing or rankings.</p>
          </div>
          <Segmented
            value={sev}
            onChange={setSev}
            items={[
              { value: 'issues', label: 'Issues' },
              { value: 'passed', label: 'Passed' },
            ]}
          />
        </div>
        <div className="divide-y divide-line-soft border-t border-line">
          {checks.length === 0 && (
            <div className="flex items-center justify-center gap-2 px-5 py-10 text-[13px] text-fg-3">
              <CheckCircle2 className="size-4 text-success" /> No {sev === 'issues' ? 'issues' : 'passed checks'} in this category.
            </div>
          )}
          {checks.map((x) => {
            const isOpen = open === x.id
            return (
              <div key={x.id}>
                <button onClick={() => setOpen(isOpen ? null : x.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-2">
                  {x.severity === 'error' ? (
                    <XCircle className="size-4 shrink-0 text-error" />
                  ) : x.severity === 'warning' ? (
                    <AlertTriangle className="size-4 shrink-0 text-warning" />
                  ) : (
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                  )}
                  <span className="flex-1 text-[13.5px] font-medium text-fg">{x.title}</span>
                  <Badge size="xs" tone="outline" className="hidden sm:inline-flex">
                    {auditCategories.find((a) => a.key === x.category)!.name}
                  </Badge>
                  {x.severity !== 'passed' && (
                    <span className="tnum w-20 text-right text-[12.5px] text-fg-3">
                      <span className="font-semibold text-fg">{x.affected}</span> URL{x.affected > 1 ? 's' : ''}
                    </span>
                  )}
                  <ChevronDown className={cn('size-4 text-fg-4 transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <div className="animate-fade-in px-5 pb-4 pl-12">
                    <p className="text-[13px] text-fg-2">{x.description}</p>
                    {x.fix && (
                      <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-line bg-surface-2 p-3">
                        <Wrench className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <div className="text-[12.5px] text-fg-2">
                          <span className="font-medium text-fg">How to fix: </span>
                          {x.fix}
                        </div>
                      </div>
                    )}
                    {x.severity !== 'passed' && (
                      <div className="mt-3 flex gap-2">
                        <Button size="xs" variant="secondary">View affected URLs</Button>
                        <Button size="xs" variant="ghost" onClick={() => toast({ title: 'Marked as ignored', description: x.title })}>
                          Ignore
                        </Button>
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
  )
}
