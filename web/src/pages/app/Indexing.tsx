import { useState } from 'react'
import { FileSearch, Map, Plus, CheckCircle2, AlertTriangle, XCircle, Clock3, ExternalLink } from 'lucide-react'
import type { IndexStatus } from '@/api/types'
import { useAction, useAudit, useSitemaps, useUrls } from '@/api/hooks'
import { cn } from '@/lib/cn'
import { useProject } from '@/lib/project'
import { statusMeta } from '@/lib/status'
import { useNavigate } from '@/lib/router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Label, ProgressBar } from '@/components/ui/Controls'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { IndexingChart } from '@/components/domain/IndexingChart'
import { UrlTable } from '@/components/domain/UrlTable'
import { formatNumber, timeAgo } from '@/utils/format'

const tileOrder: IndexStatus[] = ['indexed', 'crawled', 'discovered', 'blocked', 'error']

export function Indexing() {
  const { project } = useProject()
  const [filter, setFilter] = useState<IndexStatus | null>(null)
  const [addUrls, setAddUrls] = useState(false)
  const [addSitemap, setAddSitemap] = useState(false)
  const counts = useUrls(project?.id, { page: 1, pageSize: 1 }).data?.counts
  const audit = useAudit(project?.id)
  const sitemaps = useSitemaps(project?.id)
  const reasons = (audit.data?.checks ?? []).filter((c) => (c.category === 'indexing' || c.category === 'technical') && c.affected > 0).sort((a, b) => b.affected - a.affected)
  const maxReason = Math.max(1, ...reasons.map((r) => r.affected))
  const notConnected = !project?.gscProperty

  return (
    <>
      <PageHeader
        title="Indexing"
        description={
          project
            ? `Index coverage for ${project.domain}. ${notConnected ? 'Indexability is checked by our crawler; connect Search Console to add Google’s own verdict.' : 'Google’s verdict comes from the URL Inspection API, checked daily.'}`
            : ''
        }
        actions={
          <>
            <Button leftIcon={<Map />} onClick={() => setAddSitemap(true)}>
              Add sitemap
            </Button>
            <Button variant="primary" leftIcon={<FileSearch />} onClick={() => setAddUrls(true)}>
              Monitor URLs
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tileOrder.map((st) => {
          const active = filter === st
          const n = counts?.[st] ?? 0
          return (
            <button
              key={st}
              onClick={() => setFilter(active ? null : st)}
              className={cn(
                'group rounded-xl border bg-surface p-4 text-left shadow-xs transition-all duration-200',
                active ? 'border-primary ring-3 ring-[var(--ring)]' : 'border-line hover:border-line-strong hover:shadow-card',
              )}
            >
              <div className="text-[12px] font-medium text-fg-3">{statusMeta[st].label}</div>
              {counts ? <div className="tnum mt-2 text-[24px] leading-none font-semibold text-fg">{formatNumber(n)}</div> : <Skeleton className="mt-2 h-6 w-16" />}
              <div className="mt-2.5 flex items-center justify-between text-[11.5px]">
                <span className="text-fg-4">{counts?.unknown ? `${formatNumber(counts.unknown)} not yet inspected` : 'URLs'}</span>
                <span className="text-fg-4 opacity-0 transition-opacity group-hover:opacity-100">{active ? 'Clear' : 'Filter'}</span>
              </div>
            </button>
          )
        })}
      </div>

      <Card className="mt-4">
        <IndexingChart projectId={project?.id} height={320} />
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Why pages aren’t indexable" description="From our crawler and Search Console, grouped by cause" />
          {audit.isLoading ? (
            <div className="space-y-4 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : reasons.length === 0 ? (
            <EmptyState className="py-10" icon={<CheckCircle2 />} title="No indexing blockers found" description="Every checked URL is reachable, indexable and consistent with its canonical. We’ll alert you if that changes." />
          ) : (
            <div className="space-y-4 p-5">
              {reasons.slice(0, 7).map((r) => (
                <div key={r.id}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="flex items-center gap-2 font-medium text-fg">
                      {r.severity === 'error' ? <XCircle className="size-3.5 text-error" /> : r.severity === 'warning' ? <AlertTriangle className="size-3.5 text-warning" /> : <Clock3 className="size-3.5 text-fg-4" />}
                      {r.title}
                    </span>
                    <span className="tnum font-semibold text-fg">{formatNumber(r.affected)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-primary/80" style={{ width: `${(r.affected / maxReason) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[12px] text-fg-4">{r.fix}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
        <SitemapsCard projectId={project?.id} data={sitemaps.data} loading={sitemaps.isLoading} onAdd={() => setAddSitemap(true)} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Monitored URLs" description="Click a URL for its full inspection and history" />
        <div className="mt-1">
          <UrlTable key={filter ?? 'all'} projectId={project?.id} initialStatus={filter ? [filter] : undefined} onAddUrls={() => setAddUrls(true)} />
        </div>
      </Card>

      {project && <AddUrlsModal open={addUrls} onClose={() => setAddUrls(false)} projectId={project.id} domain={project.domain} />}
      {project && <AddSitemapModal open={addSitemap} onClose={() => setAddSitemap(false)} projectId={project.id} domain={project.domain} />}
    </>
  )
}

function SitemapsCard({ data, loading, onAdd }: { projectId?: string; data?: { sitemaps: { id: string; url: string; status: string; url_count: number; last_error: string | null; last_fetched_at: string | null }[]; coverage: { total: number; indexed: number } | null }; loading: boolean; onAdd: () => void }) {
  const list = data?.sitemaps ?? []
  const total = list.reduce((a, s) => a + s.url_count, 0)
  const cov = data?.coverage
  return (
    <Card>
      <CardHeader
        title="Sitemaps"
        description={list.length ? `${list.length} sitemap${list.length > 1 ? 's' : ''} · ${formatNumber(total)} URLs listed` : 'Read daily; new URLs are monitored automatically'}
        icon={<Map />}
        actions={cov && cov.total ? <Badge tone="primary">{Math.round(((cov.indexed ?? 0) / cov.total) * 100)}% indexed</Badge> : undefined}
      />
      {loading ? (
        <div className="space-y-3 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState className="py-10" icon={<Map />} title="No sitemap found yet" description="We look in robots.txt and at /sitemap.xml. If yours lives elsewhere, add it and we’ll read it right away." action={<Button size="sm" leftIcon={<Plus />} onClick={onAdd}>Add sitemap</Button>} />
      ) : (
        <div className="mt-3 divide-y divide-line-soft border-t border-line-soft">
          {list.map((s) => {
            let path = s.url
            try {
              path = new URL(s.url).pathname
            } catch {
              /* keep */
            }
            return (
              <div key={s.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {s.status === 'ok' ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : s.status === 'error' ? <XCircle className="size-4 shrink-0 text-error" /> : <Clock3 className="size-4 shrink-0 text-fg-4" />}
                    <a href={s.url} target="_blank" rel="noreferrer" className="truncate font-mono text-[12.5px] text-fg hover:text-primary-ink">
                      {path}
                    </a>
                  </div>
                  <span className="tnum shrink-0 text-[12.5px] text-fg-3">{s.status === 'pending' ? 'Reading…' : `${formatNumber(s.url_count)} URLs`}</span>
                </div>
                {s.status === 'error' ? (
                  <p className="mt-1.5 text-[12px] text-error-ink">{s.last_error}</p>
                ) : (
                  <p className="mt-1 text-[11.5px] text-fg-4">{s.last_fetched_at ? `Read ${timeAgo(s.last_fetched_at)}` : 'Queued'}</p>
                )}
              </div>
            )
          })}
          {cov && cov.total > 0 && (
            <div className="px-5 py-3.5">
              <div className="mb-1.5 flex justify-between text-[12px] text-fg-3">
                <span>Sitemap URLs indexed by Google</span>
                <span className="tnum font-medium text-fg">
                  {formatNumber(cov.indexed ?? 0)} / {formatNumber(cov.total)}
                </span>
              </div>
              <ProgressBar value={((cov.indexed ?? 0) / cov.total) * 100} />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function AddUrlsModal({ open, onClose, projectId, domain }: { open: boolean; onClose: () => void; projectId: string; domain: string }) {
  const [text, setText] = useState('')
  const nav = useNavigate()
  const add = useAction((s) => s.addUrls, {
    invalidate: ['urls', 'projects'],
    success: (r) => ({ title: `${r.created.length} URL${r.created.length === 1 ? '' : 's'} added`, description: r.skipped.length ? `${r.skipped.length} skipped (duplicates, other domains or plan limit).` : 'First checks run within a minute.' }),
  })
  const urls = text
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Monitor URLs"
      description={`Paste URLs on ${domain}, one per line. Sitemap URLs are added automatically.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!urls.length}
            loading={add.isPending}
            onClick={async () => {
              const r = await add.mutateAsync([projectId, urls]).catch(() => null)
              if (r) {
                setText('')
                onClose()
                if (r.created.length === 1) nav(`/app/indexing/${r.created[0]}`)
              }
            }}
          >
            Add {urls.length || ''} URL{urls.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={`https://${domain}/pricing\nhttps://${domain}/blog/launch-post`}
        className="w-full resize-none rounded-lg border border-line bg-surface p-3 font-mono text-[12.5px] text-fg shadow-xs placeholder:text-fg-4 focus:border-primary focus:ring-3 focus:ring-[var(--ring)] focus:outline-none"
      />
      <p className="mt-2 text-[12px] text-fg-4">
        Want Google to recrawl a page? Use “Request indexing” in{' '}
        <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary-ink hover:underline">
          Search Console <ExternalLink className="size-3" />
        </a>{' '}
        — Google offers no API for it, and we won’t pretend otherwise.
      </p>
    </Modal>
  )
}

function AddSitemapModal({ open, onClose, projectId, domain }: { open: boolean; onClose: () => void; projectId: string; domain: string }) {
  const [url, setUrl] = useState(`https://${domain}/sitemap.xml`)
  const add = useAction((s) => s.addSitemap, { invalidate: ['sitemaps'], success: () => ({ title: 'Sitemap added', description: 'Reading it now — new URLs will appear in a minute.' }) })
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a sitemap"
      description="We read it now and then daily. New URLs it lists are monitored automatically."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={add.isPending} onClick={() => add.mutateAsync([projectId, url]).then(onClose, () => undefined)}>
            Add sitemap
          </Button>
        </>
      }
    >
      <Label>Sitemap URL</Label>
      <Input value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
    </Modal>
  )
}
