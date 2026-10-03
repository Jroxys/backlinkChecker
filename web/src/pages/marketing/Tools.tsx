import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Check, CheckCircle2, Link2, ScanSearch, X, AlertTriangle, XCircle } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Controls'
import { Badge } from '@/components/ui/Badge'
import { Container, Footer, Nav } from './Landing'
import { usePageTitle } from '@/hooks/usePageTitle'

const tools = [
  { slug: 'backlink-checker', title: 'Free Backlink Checker', short: 'Does this page link to me?', icon: Link2, desc: 'Check whether a page links to your site, with the exact anchor text and whether the link is dofollow, nofollow, UGC or sponsored.' },
  { slug: 'indexability-checker', title: 'Free Indexability Checker', short: 'Can Google index this URL?', icon: ScanSearch, desc: 'Check a URL the way Googlebot sees it: status code, redirects, robots.txt rules, noindex and canonical — with a plain-English verdict.' },
]

export function Tools() {
  const { slug } = useParams()
  const tool = tools.find((t) => t.slug === slug)
  usePageTitle(tool ? `${tool.title} — ${tool.short} | Indexora` : 'Free SEO tools — Indexora')
  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black_30%,transparent_75%)]" />
        <Container className="relative max-w-3xl py-16 sm:py-20">
          {!tool ? (
            <>
              <h1 className="display text-center text-[40px] leading-tight font-semibold text-fg sm:text-[52px]">Free SEO tools</h1>
              <p className="mx-auto mt-4 max-w-xl text-center text-[16px] text-fg-3">No signup. Real checks, run live by the same crawler that powers Indexora.</p>
              <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {tools.map((t) => (
                  <Link key={t.slug} to={`/tools/${t.slug}`} className="group rounded-2xl border border-line bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card">
                    <span className="flex size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary-soft text-primary">
                      <t.icon className="size-5" />
                    </span>
                    <h2 className="mt-4 text-[17px] font-semibold text-fg">{t.title}</h2>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-3">{t.desc}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-primary-ink">
                      Open tool <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <Link to="/tools" className="text-[13px] font-medium text-fg-3 hover:text-fg">
                ← Free tools
              </Link>
              <h1 className="display mt-3 text-[36px] leading-tight font-semibold text-fg sm:text-[46px]">{tool.title}</h1>
              <p className="mt-3 max-w-xl text-[16px] text-fg-3">{tool.desc}</p>
              <div className="mt-8">{tool.slug === 'backlink-checker' ? <BacklinkChecker /> : <IndexabilityChecker />}</div>
              <Upsell slug={tool.slug} />
            </>
          )}
        </Container>
      </section>
      <Footer />
    </div>
  )
}

function useRun<T>() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<T>) => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await fn())
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }
  return { busy, result, error, run }
}

interface LinkResult {
  ok: boolean
  problem?: string
  http: number | null
  found?: boolean
  href?: string | null
  anchor?: string | null
  rel?: string | null
  linksToDomain?: number
  pageNoindex?: boolean
  pageTitle?: string
}

function BacklinkChecker() {
  const [pageUrl, setPageUrl] = useState('')
  const [target, setTarget] = useState('')
  const { busy, result, error, run } = useRun<LinkResult>()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(() => api.post<LinkResult>('/api/tools/backlink-check', { pageUrl, target }))
  }
  return (
    <>
      <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tool-1">Page that should link to you</Label>
            <Input id="tool-1" required value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://blog.example.org/best-tools" />
          </div>
          <div>
            <Label htmlFor="tool-2" hint="Domain or exact URL">Your site</Label>
            <Input id="tool-2" required value={target} onChange={(e) => setTarget(e.target.value)} placeholder="yoursite.com" />
          </div>
        </div>
        <Button type="submit" variant="primary" size="lg" className="mt-5 w-full sm:w-auto" loading={busy}>
          Check backlink
        </Button>
      </form>
      {error && <ErrorBox text={error} />}
      {result &&
        (!result.ok ? (
          <ErrorBox text={result.problem ?? 'The page could not be checked.'} />
        ) : (
          <ResultCard good={!!result.found} title={result.found ? 'Yes — this page links to you' : 'No link to your site found'} subtitle={result.pageTitle || undefined}>
            {result.found ? (
              <Facts
                rows={[
                  ['Anchor text', result.anchor ? `“${result.anchor}”` : '(empty)'],
                  ['Link type', <Badge key="t" tone={result.rel === 'dofollow' ? 'success' : 'outline'}>{result.rel}</Badge>],
                  ['Links to', <span key="h" className="font-mono text-[12.5px] break-all">{result.href}</span>],
                  ['Linking page indexable', result.pageNoindex ? 'No — the page is noindex, so the link carries little weight' : 'Yes'],
                ]}
              />
            ) : (
              <p className="text-[13.5px] text-fg-2">
                {result.linksToDomain ? `The page links to your domain ${result.linksToDomain} time(s), but not to the exact URL you entered.` : 'We read the page and found no link to your domain. If it was there before, it may have been removed — or it’s added later by JavaScript.'}
              </p>
            )}
          </ResultCard>
        ))}
    </>
  )
}

interface IndexResult {
  ok: boolean
  problem?: string
  indexable?: boolean
  http?: number
  finalUrl?: string
  googlebotAllowed?: boolean
  noindex?: boolean
  canonical?: string | null
  title?: string
  words?: number
  responseMs?: number
  reasons?: string[]
}

function IndexabilityChecker() {
  const [url, setUrl] = useState('')
  const { busy, result, error, run } = useRun<IndexResult>()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(() => api.post<IndexResult>('/api/tools/indexability', { url }))
  }
  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-end sm:p-6">
        <div className="flex-1">
          <Label htmlFor="tool-3">URL to check</Label>
          <Input id="tool-3" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yoursite.com/important-page" />
        </div>
        <Button type="submit" variant="primary" size="lg" loading={busy}>
          Check URL
        </Button>
      </form>
      {error && <ErrorBox text={error} />}
      {result &&
        (!result.ok ? (
          <ErrorBox text={result.problem ?? 'The URL could not be checked.'} />
        ) : (
          <ResultCard good={!!result.indexable} title={result.indexable ? 'Google can index this URL' : 'Google can’t index this URL as it is'} subtitle={result.title || undefined}>
            <Facts
              rows={[
                ['HTTP status', String(result.http)],
                ['robots.txt (Googlebot)', result.googlebotAllowed ? <Ok key="r" /> : <No key="r" text="Blocked" />],
                ['noindex', result.noindex ? <No key="n" text="Present" /> : <Ok key="n" text="None" />],
                ['Canonical', result.canonical ?? 'Not declared'],
                ['Response time', `${((result.responseMs ?? 0) / 1000).toFixed(2)}s`],
                ['Words on page', String(result.words ?? 0)],
              ]}
            />
            {!!result.reasons?.length && (
              <ul className="mt-4 space-y-2">
                {result.reasons.map((r) => (
                  <li key={r} className="flex gap-2 text-[13px] text-fg-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                    {r}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[12.5px] text-fg-4">This checks indexability. Whether Google has actually indexed the page is only visible in Search Console — Indexora reads it for you daily.</p>
          </ResultCard>
        ))}
    </>
  )
}

const Ok = ({ text = 'Allowed' }: { text?: string }) => (
  <span className="inline-flex items-center gap-1 text-success-ink">
    <Check className="size-3.5" /> {text}
  </span>
)
const No = ({ text }: { text: string }) => (
  <span className="inline-flex items-center gap-1 text-error-ink">
    <X className="size-3.5" /> {text}
  </span>
)

function ResultCard({ good, title, subtitle, children }: { good: boolean; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className={cn('mt-5 animate-rise rounded-2xl border bg-surface p-5 sm:p-6', good ? 'border-success/30' : 'border-error/30')}>
      <div className="flex items-start gap-3">
        {good ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-error" />}
        <div>
          <h2 className="text-[17px] font-semibold text-fg">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-fg-3">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line-soft rounded-lg border border-line text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4 px-3.5 py-2.5">
          <dt className="text-fg-3">{k}</dt>
          <dd className="text-right font-medium text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-error/25 bg-error-soft px-4 py-3 text-[13.5px] text-error-ink">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      {text}
    </div>
  )
}

function Upsell({ slug }: { slug: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-primary/25 bg-primary-soft p-6">
      <h2 className="text-[17px] font-semibold text-fg">{slug === 'backlink-checker' ? 'Don’t check your links by hand every week.' : 'Don’t wait for traffic to drop to find out.'}</h2>
      <p className="mt-1.5 text-[14px] text-fg-2">
        {slug === 'backlink-checker'
          ? 'Indexora re-checks every backlink daily and emails you the moment one disappears or turns nofollow.'
          : 'Indexora checks every URL in your sitemap and asks Google for its index status daily — and tells you when something changes.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/signup">
          <Button variant="primary" rightIcon={<ArrowRight />}>
            Start free — no card
          </Button>
        </Link>
        <Link to="/demo">
          <Button variant="secondary">Explore the demo</Button>
        </Link>
      </div>
    </div>
  )
}
