import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, Check, CheckCircle2, ChevronRight, Clock, Copy, ExternalLink, FileText, Link2, RefreshCw, X, AlertTriangle, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/router'
import { useProject } from '@/lib/project'
import { statusMeta } from '@/lib/status'
import { useAction, useUrl } from '@/api/hooks'
import { ApiError } from '@/api/client'
import type { UrlItem } from '@/api/types'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { EmptyState } from '@/components/ui/EmptyState'
import { DomainIcon } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { Table, THead, TH, TR, TD } from '@/components/ui/Table'
import { IndexStatusBadge, HttpBadge, LinkTypeBadge, AuthorityPill, LinkStatusBadge } from '@/components/domain/StatusBadge'
import { formatDate, formatNumber, timeAgo } from '@/utils/format'

type Tab = 'overview' | 'google' | 'links' | 'history'

/** Deep link to this URL in Search Console's URL Inspection — the official way to request indexing. */
export function gscInspectLink(property: string | null | undefined, url: string) {
  if (!property) return 'https://search.google.com/search-console'
  return `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(property)}&id=${encodeURIComponent(url)}`
}

export function UrlDetail() {
  const { id = '' } = useParams()
  const q = useUrl(id)
  const { project } = useProject()
  const [tab, setTab] = useState<Tab>('overview')
  const toast = useToast()
  const recheck = useAction((s) => s.recheckUrl, {
    invalidate: ['url', 'urls', 'projects', 'audit'],
    success: (r) => ({ title: 'Re-checked', description: r.changes.length ? r.changes.map((c) => c.detail).join(' · ') : 'No changes since the last check.' }),
  })

  if (q.error instanceof ApiError && q.error.status === 404)
    return (
      <Card>
        <EmptyState
          icon={<FileText />}
          title="This URL isn’t being monitored"
          description="It may have been removed from monitoring or the link is outdated."
          action={
            <Link to="/app/indexing">
              <Button variant="primary">Go to Indexing</Button>
            </Link>
          }
        />
      </Card>
    )

  const u = q.data?.url
  if (!u)
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-96 max-w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )

  const checks = [
    { label: 'HTTP status', ok: u.http === 200, value: <HttpBadge code={u.http} /> },
    { label: 'Indexable', ok: !!u.indexable, value: u.indexable === null ? '—' : u.indexable ? 'Yes' : 'No' },
    { label: 'Canonical', ok: u.canonical === 'self', value: u.canonical === 'self' ? 'Self' : u.canonical === 'other' ? 'Other URL' : u.canonical === 'missing' ? 'Missing' : '—' },
    { label: 'Robots (Googlebot)', ok: u.robots === 'allowed', value: u.robots === 'allowed' ? 'Allowed' : u.robots === 'noindex' ? 'noindex' : u.robots === 'blocked' ? 'Blocked' : '—' },
    { label: 'In sitemap', ok: u.inSitemap, value: u.inSitemap ? 'Yes' : 'No' },
    { label: 'Response time', ok: (u.loadMs ?? 0) < 2500, value: u.loadMs ? `${(u.loadMs / 1000).toFixed(2)}s` : '—' },
  ]
  const health = Math.round((checks.filter((c) => c.ok).length / checks.length) * 90 + (u.status === 'indexed' ? 10 : 0))
  const backlinks = q.data?.backlinks ?? []
  const events = q.data?.events ?? []
  const gsc = gscInspectLink(project?.gscProperty, u.url)

  return (
    <>
      <nav className="mb-4 flex items-center gap-1.5 text-[12.5px] text-fg-3">
        <Link to="/app/indexing" className="inline-flex items-center gap-1 hover:text-fg">
          <ArrowLeft className="size-3.5" /> Indexing
        </Link>
        <ChevronRight className="size-3 text-fg-4" />
        <span className="truncate">{project?.domain}</span>
      </nav>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="heading truncate font-mono text-[20px] font-semibold text-fg sm:text-[24px]">{u.path}</h1>
            <IndexStatusBadge status={u.status} />
          </div>
          <p className="mt-1.5 text-[13.5px] text-fg-3">{u.title ?? 'No title found'}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-fg-3">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" /> {u.lastChecked ? `Checked ${timeAgo(u.lastChecked)}` : 'First check queued'}
            </span>
            <button
              className="inline-flex items-center gap-1.5 hover:text-fg"
              onClick={() => {
                navigator.clipboard?.writeText(u.url).catch(() => {})
                toast({ title: 'URL copied to clipboard' })
              }}
            >
              <Copy className="size-3.5" /> Copy URL
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={u.url} target="_blank" rel="noreferrer">
            <Button leftIcon={<ExternalLink />}>Open live</Button>
          </a>
          <Button leftIcon={<RefreshCw />} loading={recheck.isPending} onClick={() => recheck.mutate([u.id])}>
            Re-check now
          </Button>
          <a href={gsc} target="_blank" rel="noreferrer">
            <Button variant="primary" leftIcon={<Search />}>
              Inspect in Search Console
            </Button>
          </a>
        </div>
      </div>

      <Tabs<Tab>
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'google', label: 'Google' },
          { value: 'links', label: 'Backlinks', count: backlinks.length },
          { value: 'history', label: 'History', count: events.length },
        ]}
      />

      <div key={tab} className="animate-rise">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:row-span-2">
              <CardHeader title="URL Health" description="Crawlability, indexability and Google’s verdict" />
              <div className="flex flex-col items-center px-5 pt-6 pb-2">
                <ScoreRing score={u.lastChecked ? health : 0} label="Health" size={180} />
                <p className="mt-3 text-center text-[12.5px] text-fg-3">
                  {!u.lastChecked ? 'Waiting for the first check.' : health >= 85 ? 'This URL is in good shape.' : health >= 60 ? 'A few things are holding this URL back.' : 'This URL has blocking issues.'}
                </p>
              </div>
              <div className="mt-4 divide-y divide-line-soft border-t border-line-soft">
                {checks.map((c) => (
                  <div key={c.label} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                    <span className="flex items-center gap-2.5 text-fg-2">
                      <span className={cn('flex size-4.5 items-center justify-center rounded-full', c.ok ? 'bg-success-soft text-success-ink' : 'bg-error-soft text-error-ink')}>
                        {c.ok ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                      </span>
                      {c.label}
                    </span>
                    <span className="font-medium text-fg">{c.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:col-span-2">
              <Fact label="HTTP Status" value={u.http ? String(u.http) : '—'} good={u.http ? u.http === 200 : undefined} />
              <Fact label="Indexable" value={u.indexable === null ? '—' : u.indexable ? 'Yes' : 'No'} good={u.indexable ?? undefined} />
              <Fact label="Canonical" value={u.canonical === 'self' ? 'Self' : u.canonical === 'other' ? 'Other' : u.canonical === 'missing' ? 'Missing' : '—'} good={u.canonical ? u.canonical === 'self' : undefined} />
              <Fact label="Robots" value={u.robots === 'allowed' ? 'Allowed' : u.robots === 'noindex' ? 'noindex' : u.robots === 'blocked' ? 'Blocked' : '—'} good={u.robots ? u.robots === 'allowed' : undefined} />
              <Fact label="Sitemap" value={u.inSitemap ? 'Included' : 'Not listed'} good={u.inSitemap} />
              <Fact label="Words" value={u.wordCount !== null ? formatNumber(u.wordCount) : '—'} />
              <Fact label="Response" value={u.loadMs ? `${(u.loadMs / 1000).toFixed(2)}s` : '—'} />
              <Fact label="Backlinks" value={formatNumber(backlinks.length)} />
            </div>

            <NextStep u={u} gscLink={gsc} />
          </div>
        )}

        {tab === 'google' && (
          <Card>
            <CardHeader title="Google’s view" description={u.indexCheckedAt ? `URL Inspection API · ${timeAgo(u.indexCheckedAt)}` : 'Not inspected yet'} />
            {u.status === 'unknown' && !u.indexCheckedAt ? (
              <EmptyState
                icon={<Search />}
                title="Connect Search Console to see Google’s verdict"
                description="We check indexability ourselves, but only Google can say whether a page is actually indexed."
                action={
                  <Link to="/app/settings?tab=integrations">
                    <Button size="sm" variant="primary">
                      Connect Search Console
                    </Button>
                  </Link>
                }
              />
            ) : (
              <dl className="mt-3 divide-y divide-line-soft border-t border-line-soft text-[13px]">
                {[
                  ['Coverage state', u.coverageState ?? statusMeta[u.status].label],
                  ['Last crawled by Google', u.lastCrawl ? formatDate(u.lastCrawl) : 'Never'],
                  ['Your canonical', u.canonicalUrl ?? 'None declared'],
                  ['Google-selected canonical', u.googleCanonical ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-5 py-3">
                    <dt className="text-fg-3">{k}</dt>
                    <dd className="truncate text-right font-medium text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        )}

        {tab === 'google' && q.data?.search && (
          <Card className="mt-4 overflow-hidden">
            <CardHeader
              title="Search queries"
              description={
                q.data.search.range
                  ? `Where this is your best-ranking page · ${formatDate(q.data.search.range.start)} – ${formatDate(q.data.search.range.end)}`
                  : 'Where this is your best-ranking page'
              }
            />
            {q.data.search.queries.length === 0 ? (
              <p className="px-5 pt-3 pb-5 text-[13px] text-fg-3">No queries where this page is your top result in the last 28 days. Pages need impressions before they show up here.</p>
            ) : (
              <table className="mt-3 w-full text-[13px]">
                <thead>
                  <tr className="border-y border-line-soft text-left text-[12px] text-fg-3">
                    <th className="px-5 py-2 font-medium">Query</th>
                    <th className="px-3 py-2 text-right font-medium">Position</th>
                    <th className="px-3 py-2 text-right font-medium">Clicks</th>
                    <th className="px-5 py-2 text-right font-medium">Impressions</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.search.queries.map((r) => (
                    <tr key={r.query} className="border-b border-line-soft last:border-0">
                      <td className="px-5 py-2.5 text-fg">{r.query}</td>
                      <td className="tnum px-3 py-2.5 text-right text-fg-2">{r.position.toFixed(1)}</td>
                      <td className="tnum px-3 py-2.5 text-right text-fg-2">{formatNumber(r.clicks)}</td>
                      <td className="tnum px-5 py-2.5 text-right text-fg-2">{formatNumber(r.impressions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {tab === 'links' && (
          <Card className="overflow-hidden">
            <CardHeader title="Backlinks to this URL" description="Verified links pointing here" icon={<Link2 />} />
            {backlinks.length === 0 ? (
              <EmptyState
                icon={<Link2 />}
                title="No backlinks to this URL yet"
                description="Links pointing here appear after they’re imported or discovered and verified."
                action={
                  <Link to="/app/backlinks">
                    <Button size="sm">Manage backlinks</Button>
                  </Link>
                }
              />
            ) : (
              <div className="mt-3">
                <Table minWidth={720}>
                  <THead>
                    <TH>Source</TH>
                    <TH>Anchor</TH>
                    <TH>Authority</TH>
                    <TH>Type</TH>
                    <TH>Status</TH>
                    <TH>First seen</TH>
                  </THead>
                  <tbody>
                    {backlinks.map((b) => (
                      <TR key={b.id}>
                        <TD>
                          <a href={b.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                            <DomainIcon domain={b.sourceDomain} />
                            <span className="font-medium text-fg hover:text-primary-ink">{b.sourceDomain}</span>
                          </a>
                        </TD>
                        <TD>{b.anchor ? `“${b.anchor}”` : '—'}</TD>
                        <TD>
                          <AuthorityPill value={b.authority} />
                        </TD>
                        <TD>
                          <LinkTypeBadge type={b.rel} />
                        </TD>
                        <TD>
                          <LinkStatusBadge status={b.status} />
                        </TD>
                        <TD className="tnum">{b.firstSeen ? formatDate(b.firstSeen) : '—'}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>
        )}

        {tab === 'history' && (
          <Card>
            <CardHeader title="History" description="Every change Indexora detected on this URL" />
            {events.length === 0 ? (
              <EmptyState icon={<Clock />} title="No history yet" description="Changes to status code, indexability, canonical or Google’s verdict will be recorded here." />
            ) : (
              <ol className="p-5">
                {events.map((e, i) => {
                  const bad = /not_found|server_error|non_indexable|deindexed|warning/.test(e.kind)
                  const good = !bad && /indexed$|became_indexable|success/.test(e.kind)
                  return (
                    <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < events.length - 1 && <span className="absolute top-5 bottom-0 left-[7px] w-px bg-line" />}
                      <span className={cn('relative z-[1] mt-1 size-[15px] shrink-0 rounded-full border-[3px] border-surface ring-1', bad ? 'bg-warning ring-warning/30' : good ? 'bg-success ring-success/30' : 'bg-primary ring-primary/30')} />
                      <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-2">
                        <p className="text-[13.5px] font-medium text-fg">{e.detail}</p>
                        <span className="tnum text-[12px] text-fg-4">{formatDate(e.at)}</span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </Card>
        )}
      </div>
    </>
  )
}

function NextStep({ u, gscLink }: { u: UrlItem; gscLink: string }) {
  let text: ReactNode = null
  if (u.http && u.http >= 500) text = 'The server returns an error. Fix it first — Google drops pages that keep failing.'
  else if (u.http && u.http >= 400) text = 'This page is gone. Redirect it to the closest live page or remove it from sitemaps and internal links.'
  else if (u.http && u.http >= 300) text = 'This URL redirects. Point sitemaps and internal links at the final URL instead.'
  else if (u.robots === 'blocked') text = 'robots.txt blocks Googlebot here. Remove the Disallow rule if this page should rank.'
  else if (u.robots === 'noindex') text = 'A noindex directive keeps this page out of search. Remove it if that’s not intentional.'
  else if (u.canonical === 'other') text = `This page canonicalises to ${u.canonicalUrl}. Make it self-referencing if it should rank on its own.`
  else if (u.status === 'crawled') text = 'Google crawled this page and passed. Strengthen its unique content and link to it from relevant indexed pages.'
  else if (u.status === 'discovered') text = 'Google knows this URL but hasn’t crawled it. Add internal links from strong pages, then request indexing in Search Console.'
  if (!text) return null
  return (
    <Card className="border-warning/30 xl:col-span-2">
      <div className="flex items-start gap-3 p-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-ink">
          <AlertTriangle className="size-4" />
        </span>
        <div>
          <h3 className="text-[14px] font-semibold text-fg">Recommended next step</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{text}</p>
          <a href={gscLink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary-ink hover:underline">
            After fixing, request indexing in Search Console <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </Card>
  )
}

function Fact({ label, value, good }: { label: string; value: ReactNode; good?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
      <div className="text-[12px] font-medium text-fg-3">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <span className="tnum truncate text-[20px] leading-none font-semibold text-fg">{value}</span>
        {good !== undefined && (good ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <AlertTriangle className="size-4 shrink-0 text-warning" />)}
      </div>
    </div>
  )
}
