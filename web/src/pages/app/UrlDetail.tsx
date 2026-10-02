import { useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Link } from '@/lib/router'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Gauge,
  Link2,
  RefreshCw,
  Send,
  X,
  AlertTriangle,
  Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { rng } from '@/lib/random'
import { useChartColors } from '@/lib/chartColors'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { EmptyState } from '@/components/ui/EmptyState'
import { DomainIcon } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { Table, THead, TH, TR, TD } from '@/components/ui/Table'
import { ChartTooltip, Legend, axisProps } from '@/components/charts/ChartParts'
import { IndexStatusBadge, HttpBadge, LinkTypeBadge, AuthorityPill } from '@/components/domain/StatusBadge'
import { getUrl, urlHistory, urls, statusMeta } from '@/data/urls'
import { backlinks } from '@/data/backlinks'
import { formatDate, formatNumber, formatShortDate, timeAgo } from '@/utils/format'

type Tab = 'overview' | 'technical' | 'indexing' | 'links' | 'content' | 'history'

export function UrlDetail() {
  const { id = '' } = useParams()
  const url = getUrl(id)
  const [tab, setTab] = useState<Tab>('overview')
  const toast = useToast()

  if (!url)
    return (
      <Card>
        <EmptyState
          icon={<FileText />}
          title="This URL isn’t being monitored"
          description="It may have been removed from monitoring or the link is outdated. Search for it from the Indexing page."
          action={
            <Link to="/app/indexing">
              <Button variant="primary">Go to Indexing</Button>
            </Link>
          }
        />
      </Card>
    )

  const checks = [
    { label: 'HTTP status', ok: url.http === 200, value: <HttpBadge code={url.http} /> },
    { label: 'Indexable', ok: url.indexable, value: url.indexable ? 'Yes' : 'No' },
    { label: 'Canonical', ok: url.canonical === 'self', value: url.canonical === 'self' ? 'Self' : url.canonical === 'other' ? 'Other URL' : 'Missing' },
    { label: 'Robots', ok: url.robots === 'allowed', value: url.robots === 'allowed' ? 'Allowed' : url.robots === 'noindex' ? 'noindex' : 'Blocked' },
    { label: 'Sitemap', ok: url.inSitemap, value: url.inSitemap ? 'Included' : 'Not included' },
    { label: 'Load time', ok: url.loadTime < 2.5, value: `${url.loadTime.toFixed(2)}s` },
  ]
  const health = Math.round(
    (checks.filter((c) => c.ok).length / checks.length) * 82 +
      Math.min(10, url.internalLinks / 3) +
      Math.min(8, url.backlinks / 2) -
      (url.status === 'indexed' ? 0 : 10),
  )

  const inbound = backlinks.filter((b) => b.target === url.path)
  const prevNext = urls.findIndex((u) => u.id === url.id)

  return (
    <>
      <nav className="mb-4 flex items-center gap-1.5 text-[12.5px] text-fg-3">
        <Link to="/app/indexing" className="inline-flex items-center gap-1 hover:text-fg">
          <ArrowLeft className="size-3.5" /> Indexing
        </Link>
        <ChevronRight className="size-3 text-fg-4" />
        <span className="truncate">{url.domain}</span>
      </nav>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="heading truncate font-mono text-[20px] font-semibold text-fg sm:text-[24px]">{url.path}</h1>
            <IndexStatusBadge status={url.status} />
          </div>
          <p className="mt-1.5 text-[13.5px] text-fg-3">{url.title}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-fg-3">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" /> Checked {timeAgo(url.lastChecked)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="size-3.5" /> Googlebot Smartphone
            </span>
            <button
              className="inline-flex items-center gap-1.5 hover:text-fg"
              onClick={() => {
                navigator.clipboard?.writeText(`https://${url.domain}${url.path}`).catch(() => {})
                toast({ title: 'URL copied to clipboard' })
              }}
            >
              <Copy className="size-3.5" /> Copy URL
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`https://${url.domain}${url.path}`} target="_blank" rel="noreferrer">
            <Button leftIcon={<ExternalLink />}>Open live</Button>
          </a>
          <Button leftIcon={<RefreshCw />} onClick={() => toast({ title: 'Re-inspection queued', description: url.path, tone: 'info' })}>
            Re-inspect
          </Button>
          <Button variant="primary" leftIcon={<Send />} onClick={() => toast({ title: 'Indexing requested', description: 'Google typically recrawls within 24–72 hours.' })}>
            Request indexing
          </Button>
        </div>
      </div>

      <Tabs<Tab>
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'technical', label: 'Technical SEO' },
          { value: 'indexing', label: 'Indexing' },
          { value: 'links', label: 'Links', count: url.internalLinks + url.externalLinks + url.backlinks },
          { value: 'content', label: 'Content' },
          { value: 'history', label: 'History' },
        ]}
      />

      <div key={tab} className="animate-rise">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:row-span-2">
              <CardHeader title="URL Health" description="Composite of crawlability, indexability, links and speed" />
              <div className="flex flex-col items-center px-5 pt-6 pb-2">
                <ScoreRing score={Math.max(0, Math.min(100, health))} label="Health" size={180} />
                <p className="mt-3 text-center text-[12.5px] text-fg-3">
                  {health >= 85 ? 'This URL is in excellent shape.' : health >= 65 ? 'A few things are holding this URL back.' : 'This URL has blocking issues.'}
                </p>
              </div>
              <div className="mt-4 divide-y divide-line-soft border-t border-line-soft">
                {checks.map((c) => (
                  <div key={c.label} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                    <span className="flex items-center gap-2.5 text-fg-2">
                      <span
                        className={cn(
                          'flex size-4.5 items-center justify-center rounded-full',
                          c.ok ? 'bg-success-soft text-success-ink' : 'bg-error-soft text-error-ink',
                        )}
                      >
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
              <Fact label="HTTP Status" value={String(url.http)} good={url.http === 200} />
              <Fact label="Indexable" value={url.indexable ? 'Yes' : 'No'} good={url.indexable} />
              <Fact label="Canonical" value={url.canonical === 'self' ? 'Self' : url.canonical === 'other' ? 'Other' : 'Missing'} good={url.canonical === 'self'} />
              <Fact label="Robots" value={url.robots === 'allowed' ? 'Allowed' : 'Blocked'} good={url.robots === 'allowed'} />
              <Fact label="Sitemap" value={url.inSitemap ? 'Included' : 'Missing'} good={url.inSitemap} />
              <Fact label="Internal Links" value={formatNumber(url.internalLinks)} />
              <Fact label="External Links" value={formatNumber(url.externalLinks)} />
              <Fact label="Backlinks" value={formatNumber(url.backlinks)} />
            </div>

            <Card className="xl:col-span-2">
              <SearchPerformance id={url.id} indexed={url.status === 'indexed'} clicks={url.clicks} impressions={url.impressions} />
            </Card>

            {url.status !== 'indexed' && (
              <Card className="border-warning/30 xl:col-span-3">
                <div className="flex items-start gap-3 p-5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-ink">
                    <AlertTriangle className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-[14px] font-semibold text-fg">Why isn’t this URL indexed?</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{statusMeta[url.status].help}</p>
                    <p className="mt-2 text-[13px] text-fg-3">
                      <span className="font-medium text-fg">Recommended next step: </span>
                      {url.canonical === 'other'
                        ? `This page canonicalises to ${url.canonicalTarget}. If that is intended, no action is needed; otherwise make the canonical self-referencing.`
                        : url.status === 'error'
                          ? 'Fix the server response, then request indexing.'
                          : url.status === 'discovered'
                            ? 'Add 2–3 internal links from high-authority pages to signal importance.'
                            : 'Strengthen unique content and internal links, then request indexing.'}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === 'technical' && (
          <Card className="overflow-hidden">
            <CardHeader title="Technical checks" description="Results from the latest crawl of this URL" />
            <div className="mt-3 divide-y divide-line-soft border-t border-line-soft">
              {[
                ['Response code', `${url.http} ${url.http === 200 ? 'OK' : url.http === 404 ? 'Not Found' : 'Server Error'}`, url.http === 200],
                ['Redirect chain', 'None', true],
                ['HTTPS', 'Valid certificate · HSTS enabled', true],
                ['Mobile friendly', 'Responsive viewport detected', true],
                ['Time to first byte', `${Math.round(url.loadTime * 180)} ms`, url.loadTime < 2],
                ['Largest Contentful Paint', `${url.loadTime.toFixed(2)} s`, url.loadTime < 2.5],
                ['Page size', `${Math.round(120 + url.wordCount / 30)} KB (HTML)`, true],
                ['Crawl depth', `${url.depth} click${url.depth > 1 ? 's' : ''} from homepage`, url.depth <= 3],
                ['hreflang', 'Not applicable', true],
                ['Structured data', url.path.startsWith('/blog') ? 'Article, BreadcrumbList' : 'BreadcrumbList', true],
              ].map(([k, v, ok]) => (
                <div key={String(k)} className="flex items-center justify-between gap-4 px-5 py-3 text-[13px]">
                  <span className="flex items-center gap-2.5 text-fg-2">
                    {ok ? <CheckCircle2 className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warning" />}
                    {k}
                  </span>
                  <span className="text-right font-medium text-fg">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'indexing' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Google index result" description="URL Inspection API · live data" />
              <dl className="mt-3 divide-y divide-line-soft border-t border-line-soft text-[13px]">
                {[
                  ['Coverage state', url.status === 'indexed' ? 'Submitted and indexed' : statusMeta[url.status].label],
                  ['Crawled as', 'Googlebot smartphone'],
                  ['Last crawl', url.lastCrawl ? formatDate(url.lastCrawl) : 'Never'],
                  ['Page fetch', url.http === 200 ? 'Successful' : 'Failed'],
                  ['Indexing allowed', url.robots === 'noindex' ? 'No: “noindex” detected' : 'Yes'],
                  ['Crawl allowed', url.robots === 'blocked' ? 'No: blocked by robots.txt' : 'Yes'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-5 py-3">
                    <dt className="text-fg-3">{k}</dt>
                    <dd className="text-right font-medium text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card>
              <CardHeader title="Canonicalisation & discovery" description="How Google found and consolidated this URL" />
              <dl className="mt-3 divide-y divide-line-soft border-t border-line-soft text-[13px]">
                {[
                  ['User-declared canonical', url.canonical === 'missing' ? 'None' : url.canonical === 'other' ? url.canonicalTarget! : url.path],
                  ['Google-selected canonical', url.canonical === 'other' ? url.canonicalTarget! : url.path],
                  ['Sitemaps', url.inSitemap ? (url.path.startsWith('/docs') ? 'sitemap-docs.xml' : 'sitemap-blog.xml') : 'Not in any sitemap'],
                  ['Referring page', '/blog'],
                  ['First discovered', formatDate('2026-07-10T00:00:00Z')],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-5 py-3">
                    <dt className="text-fg-3">{k}</dt>
                    <dd className="truncate text-right font-mono text-[12.5px] font-medium text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
        )}

        {tab === 'links' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Fact label="Internal inlinks" value={formatNumber(url.internalLinks)} />
              <Fact label="External outlinks" value={formatNumber(url.externalLinks)} />
              <Fact label="Backlinks" value={formatNumber(url.backlinks)} />
            </div>
            <Card className="overflow-hidden">
              <CardHeader title="Backlinks to this URL" description="Referring pages discovered by Indexora" icon={<Link2 />} />
              {inbound.length === 0 ? (
                <EmptyState
                  icon={<Link2 />}
                  title="No backlinks detected for this URL yet"
                  description="Links pointing here will appear after the next backlink scan. Promote the page or check Opportunities for prospects."
                  action={
                    <Link to="/app/opportunities">
                      <Button size="sm">Find opportunities</Button>
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
                      <TH>First seen</TH>
                    </THead>
                    <tbody>
                      {inbound.map((b) => (
                        <TR key={b.id}>
                          <TD>
                            <span className="flex items-center gap-2">
                              <DomainIcon domain={b.sourceDomain} />
                              <span className="font-medium text-fg">{b.sourceDomain}</span>
                            </span>
                          </TD>
                          <TD>“{b.anchor}”</TD>
                          <TD>
                            <AuthorityPill value={b.authority} />
                          </TD>
                          <TD>
                            <LinkTypeBadge type={b.type} />
                          </TD>
                          <TD className="tnum">{formatDate(b.firstSeen)}</TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card>
            <Card>
              <CardHeader title="Top internal inlinks" description="Pages on your site linking here" />
              <div className="mt-3 divide-y divide-line-soft border-t border-line-soft">
                {urls
                  .filter((u) => u.id !== url.id && u.status === 'indexed')
                  .slice(prevNext % 7, (prevNext % 7) + 5)
                  .map((u) => (
                    <Link key={u.id} to={`/app/indexing/${u.id}`} className="flex items-center justify-between px-5 py-3 text-[13px] hover:bg-surface-2">
                      <span className="font-mono text-fg">{u.path}</span>
                      <ArrowUpRight className="size-3.5 text-fg-4" />
                    </Link>
                  ))}
              </div>
            </Card>
          </div>
        )}

        {tab === 'content' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="On-page elements" />
              <div className="space-y-5 p-5">
                <Element label="Title" value={url.title} count={url.title.length} limit={60} />
                <Element
                  label="Meta description"
                  value="A step-by-step, no-fluff guide to doing SEO in 2026 — technical foundations, content, links and measurement, with checklists you can use today."
                  count={148}
                  limit={160}
                />
                <Element label="H1" value={url.title.split(' — ')[0].split(':')[0]} />
                <div>
                  <div className="mb-2 text-[12px] font-medium text-fg-3">Heading outline</div>
                  <div className="space-y-1.5 rounded-lg border border-line bg-surface-2 p-3.5 font-mono text-[12.5px] text-fg-2">
                    <div><span className="text-primary-ink">H2</span> Why SEO still compounds</div>
                    <div className="pl-4"><span className="text-fg-4">H3</span> How search engines discover pages</div>
                    <div className="pl-4"><span className="text-fg-4">H3</span> Indexing vs. ranking</div>
                    <div><span className="text-primary-ink">H2</span> Technical foundations</div>
                    <div><span className="text-primary-ink">H2</span> Content that earns links</div>
                    <div><span className="text-primary-ink">H2</span> Measuring what matters</div>
                  </div>
                </div>
              </div>
            </Card>
            <div className="grid grid-cols-2 content-start gap-3 lg:grid-cols-1">
              <Fact label="Word count" value={formatNumber(url.wordCount)} />
              <Fact label="Reading time" value={`${Math.max(1, Math.round(url.wordCount / 230))} min`} />
              <Fact label="Images" value={String(Math.round(url.wordCount / 380))} />
              <Fact label="Readability" value="Grade 8" good />
            </div>
          </div>
        )}

        {tab === 'history' && (
          <Card>
            <CardHeader title="History" description="Every change Indexora detected on this URL" />
            <ol className="p-5">
              {urlHistory(url.id).map((e, i, xs) => (
                <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < xs.length - 1 && <span className="absolute top-5 bottom-0 left-[7px] w-px bg-line" />}
                  <span
                    className={cn(
                      'relative z-[1] mt-1 size-[15px] shrink-0 rounded-full border-[3px] border-surface ring-1',
                      e.tone === 'success' && 'bg-success ring-success/30',
                      e.tone === 'warning' && 'bg-warning ring-warning/30',
                      e.tone === 'primary' && 'bg-primary ring-primary/30',
                      e.tone === 'neutral' && 'bg-fg-4 ring-line',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[13.5px] font-medium text-fg">{e.title}</p>
                      <span className="tnum text-[12px] text-fg-4">{formatDate(e.date)}</span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-fg-3">{e.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>
    </>
  )
}

function Fact({ label, value, good }: { label: string; value: ReactNode; good?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
      <div className="text-[12px] font-medium text-fg-3">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <span className="tnum text-[20px] leading-none font-semibold text-fg">{value}</span>
        {good !== undefined &&
          (good ? <CheckCircle2 className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warning" />)}
      </div>
    </div>
  )
}

function Element({ label, value, count, limit }: { label: string; value: string; count?: number; limit?: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12px]">
        <span className="font-medium text-fg-3">{label}</span>
        {count !== undefined && limit && (
          <Badge size="xs" tone={count <= limit ? 'success' : 'warning'}>
            {count} / {limit} chars
          </Badge>
        )}
      </div>
      <p className="text-[14px] text-fg">{value}</p>
    </div>
  )
}

function SearchPerformance({ id, indexed, clicks, impressions }: { id: string; indexed: boolean; clicks: number; impressions: number }) {
  const c = useChartColors()
  const data = useMemo(() => {
    const r = rng(id.charCodeAt(1) * 17)
    return Array.from({ length: 28 }, (_, i) => {
      const d = new Date('2026-10-02T00:00:00Z')
      d.setUTCDate(d.getUTCDate() - (27 - i))
      const base = (clicks / 28) * (0.75 + (i / 27) * 0.5)
      return { date: d.toISOString().slice(0, 10), clicks: Math.max(0, Math.round(base * (0.7 + r() * 0.6))) }
    })
  }, [id, clicks])
  return (
    <>
      <CardHeader
        title="Search performance"
        description="Clicks from Google Search · last 28 days"
        icon={<Gauge />}
        actions={
          <Legend
            items={[
              { key: 'c', label: 'Clicks', color: c.s1, value: formatNumber(clicks) },
              { key: 'i', label: 'Impressions', color: c.muted, value: formatNumber(impressions) },
            ]}
          />
        }
      />
      {indexed ? (
        <div className="px-2 pt-3 pb-3">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sp" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={c.s1} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={c.s1} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="date" {...axisProps(c.axis)} tickFormatter={(d) => formatShortDate(d)} minTickGap={30} />
              <YAxis {...axisProps(c.axis)} width={36} />
              <Tooltip cursor={{ stroke: c.cursor, strokeDasharray: '3 3' }} content={(p) => <ChartTooltip {...p} formatLabel={(l) => formatShortDate(l)} />} />
              <Area type="monotone" dataKey="clicks" name="Clicks" stroke={c.s1} strokeWidth={2} fill="url(#sp)" activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          className="py-10"
          icon={<Gauge />}
          title="No search traffic yet"
          description="This URL isn’t indexed, so it can’t receive clicks from Google. Performance data will appear once it’s indexed."
        />
      )}
    </>
  )
}
