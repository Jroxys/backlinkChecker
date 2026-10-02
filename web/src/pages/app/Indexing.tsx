import { useMemo, useState } from 'react'
import { FileSearch, Map, Send, Upload, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import type { IndexStatus } from '@/types'
import { cn } from '@/lib/cn'
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Label, ProgressBar } from '@/components/ui/Controls'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { IndexingChart } from '@/components/domain/IndexingChart'
import { UrlTable } from '@/components/domain/UrlTable'
import { urls, statusMeta } from '@/data/urls'
import { formatNumber, timeAgo } from '@/utils/format'

const tiles: { status: IndexStatus; value: number; delta: string; deltaGood: boolean }[] = [
  { status: 'indexed', value: 1284, delta: '+142 this month', deltaGood: true },
  { status: 'crawled', value: 142, delta: '−9 this month', deltaGood: true },
  { status: 'discovered', value: 87, delta: '+12 this month', deltaGood: false },
  { status: 'blocked', value: 0, delta: '', deltaGood: true },
  { status: 'error', value: 12, delta: '−3 this month', deltaGood: true },
]

const sitemaps = [
  { path: '/sitemap-blog.xml', urls: 412, indexed: 388, status: 'ok' as const, read: '2026-10-02T09:00:00Z' },
  { path: '/sitemap-docs.xml', urls: 641, indexed: 552, status: 'ok' as const, read: '2026-10-02T09:00:00Z' },
  { path: '/sitemap-pages.xml', urls: 96, indexed: 81, status: 'warning' as const, read: '2026-10-02T09:00:00Z', note: '3 non-indexable URLs listed' },
  { path: '/sitemap-products.xml', urls: 376, indexed: 263, status: 'ok' as const, read: '2026-10-02T09:00:00Z' },
]

const reasons = [
  { reason: 'Crawled – currently not indexed', count: 142, tip: 'Thin or near-duplicate content. Consolidate or improve.' },
  { reason: 'Discovered – currently not indexed', count: 87, tip: 'Low internal link depth. Link from hub pages.' },
  { reason: 'Alternate page with proper canonical', count: 64, tip: 'Expected. No action needed.' },
  { reason: 'Excluded by noindex tag', count: 31, tip: 'Verify these are intentional.' },
  { reason: 'Not found (404)', count: 9, tip: 'Remove from sitemaps or redirect.' },
  { reason: 'Server error (5xx)', count: 3, tip: 'Investigate immediately.' },
]

export function Indexing() {
  const loading = useSimulatedLoad(600)
  const [filter, setFilter] = useState<IndexStatus | null>(null)
  const [inspect, setInspect] = useState(false)
  const [inspectUrl, setInspectUrl] = useState('https://northwindlabs.com/blog/')
  const toast = useToast()
  const counts = useMemo(() => {
    const c: Partial<Record<IndexStatus, number>> = {}
    urls.forEach((u) => (c[u.status] = (c[u.status] ?? 0) + 1))
    return c
  }, [])
  const maxReason = Math.max(...reasons.map((r) => r.count))

  return (
    <>
      <PageHeader
        title="Indexing"
        description="Live Google index coverage for northwindlabs.com, checked every 6 hours via the URL Inspection API."
        actions={
          <>
            <Button leftIcon={<Upload />} onClick={() => toast({ title: 'Sitemap submitted', description: 'sitemap-blog.xml will be re-read within the hour.' })}>
              Submit sitemap
            </Button>
            <Button variant="primary" leftIcon={<FileSearch />} onClick={() => setInspect(true)}>
              Inspect URL
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((t) => {
          const active = filter === t.status
          const m = statusMeta[t.status]
          return (
            <button
              key={t.status}
              onClick={() => setFilter(active ? null : t.status)}
              className={cn(
                'group rounded-xl border bg-surface p-4 text-left shadow-xs transition-all duration-200',
                active ? 'border-primary ring-3 ring-[var(--ring)]' : 'border-line hover:border-line-strong hover:shadow-card',
              )}
            >
              <div className="text-[12px] font-medium text-fg-3">{m.label}</div>
              <div className="tnum mt-2 text-[24px] leading-none font-semibold text-fg">{formatNumber(t.value)}</div>
              <div className="mt-2.5 flex items-center justify-between text-[11.5px]">
                <span className={t.delta ? (t.deltaGood ? 'text-success-ink' : 'text-error-ink') : 'text-fg-4'}>{t.delta || 'No change'}</span>
                <span className="text-fg-4 opacity-0 transition-opacity group-hover:opacity-100">{active ? 'Clear' : 'Filter'}</span>
              </div>
            </button>
          )
        })}
      </div>

      <Card className="mt-4">
        <IndexingChart loading={loading} height={320} />
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Why pages aren’t indexed" description="Grouped by Google’s exclusion reason" />
          <div className="space-y-3.5 p-5">
            {reasons.map((r) => (
              <div key={r.reason}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-medium text-fg">{r.reason}</span>
                  <span className="tnum font-semibold text-fg">{r.count}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-primary/80" style={{ width: `${(r.count / maxReason) * 100}%` }} />
                </div>
                <p className="mt-1 text-[12px] text-fg-4">{r.tip}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Sitemaps"
            description="4 sitemaps · 1,525 submitted URLs"
            icon={<Map />}
            actions={<Badge tone="success" dot>Read 14m ago</Badge>}
          />
          <div className="mt-3 divide-y divide-line-soft border-t border-line-soft">
            {sitemaps.map((s) => {
              const pct = (s.indexed / s.urls) * 100
              return (
                <div key={s.path} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {s.status === 'ok' ? (
                        <CheckCircle2 className="size-4 shrink-0 text-success" />
                      ) : (
                        <AlertTriangle className="size-4 shrink-0 text-warning" />
                      )}
                      <span className="truncate font-mono text-[12.5px] text-fg">{s.path}</span>
                    </div>
                    <span className="tnum shrink-0 text-[12.5px] text-fg-3">
                      <span className="font-semibold text-fg">{formatNumber(s.indexed)}</span> / {formatNumber(s.urls)} indexed
                    </span>
                  </div>
                  <ProgressBar value={pct} className="mt-2.5" />
                  <div className="mt-1.5 flex justify-between text-[11.5px] text-fg-4">
                    <span>{s.note ?? `Last read ${timeAgo(s.read)}`}</span>
                    <span className="tnum">{pct.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader
          title="URL inspection"
          description={`${urls.length} priority URLs monitored · ${counts.indexed ?? 0} indexed`}
          actions={
            counts.error ? (
              <Badge tone="error" icon={<XCircle />}>
                {counts.error} errors need attention
              </Badge>
            ) : undefined
          }
        />
        <div className="mt-1">
          <UrlTable key={filter ?? 'all'} data={urls} loading={loading} initialStatus={filter ? [filter] : undefined} />
        </div>
      </Card>

      <Modal
        open={inspect}
        onClose={() => setInspect(false)}
        title="Inspect a URL"
        description="Runs a live URL Inspection API check and adds the URL to monitoring."
        footer={
          <>
            <Button variant="ghost" onClick={() => setInspect(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              leftIcon={<Send />}
              onClick={() => {
                setInspect(false)
                toast({ title: 'Inspection started', description: inspectUrl, tone: 'info' })
              }}
            >
              Inspect now
            </Button>
          </>
        }
      >
        <Label hint="Must belong to a verified property">URL</Label>
        <Input value={inspectUrl} onChange={(e) => setInspectUrl(e.target.value)} autoFocus />
        <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3 text-[12.5px] text-fg-3">
          You have <span className="tnum font-medium text-fg">1,588</span> live inspections left today (2,000 / day per property).
        </div>
      </Modal>
    </>
  )
}
