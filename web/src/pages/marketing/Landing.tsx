import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileBarChart2,
  Link2,
  Moon,
  ScanSearch,
  ShieldCheck,
  Sun,
  Swords,
  Workflow,
  CheckCircle2,
  Eye,
  CircleDashed,
  XCircle,
  Menu,
  X,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/theme'
import { useChartColors } from '@/lib/chartColors'
import { Logo, LogoMark } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Segmented } from '@/components/ui/Tabs'
import { DomainIcon } from '@/components/ui/Avatar'
import { ChartTooltip, axisProps } from '@/components/charts/ChartParts'
import { HeroPreview } from '@/components/marketing/HeroPreview'
import { LinkStatusBadge, LinkTypeBadge, AuthorityPill } from '@/components/domain/StatusBadge'
import { indexSeries, lastDays } from '@/data/series'
import { formatShortDate } from '@/utils/format'
import { usePageTitle } from '@/hooks/usePageTitle'

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1200px] px-4 sm:px-6', className)}>{children}</div>
}

function SectionHeading({ eyebrow, title, description, center }: { eyebrow: string; title: ReactNode; description?: string; center?: boolean }) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      <div className={cn('mb-3 inline-flex items-center gap-2 text-[12.5px] font-semibold text-primary-ink', center && 'justify-center')}>
        <span className="h-px w-5 bg-primary/50" />
        {eyebrow}
      </div>
      <h2 className="display text-[30px] leading-[1.1] font-semibold text-fg sm:text-[40px]">{title}</h2>
      {description && <p className="mt-4 text-[16px] leading-relaxed text-fg-3">{description}</p>}
    </div>
  )
}

export function Landing() {
  usePageTitle('Indexora — Know exactly what Google sees')
  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <Hero />
      <Trust />
      <Features />
      <ProductPreview />
      <AutomationSection />
      <BacklinkSection />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  )
}

/* ------------------------------------------------------------------ Nav */

export function Nav() {
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const links = [
    ['Product', '#product'],
    ['Features', '#features'],
    ['Automations', '#automations'],
    ['Pricing', '#pricing'],
    ['FAQ', '#faq'],
    ['Free tools', '/tools'],
  ]
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <Container className="flex h-15 items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" aria-label="Indexora home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map(([l, h]) => (
              <a key={h} href={h.startsWith('#') ? '/' + h : h} className="rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg">
                {l}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} aria-label="Toggle theme" className="rounded-lg p-2 text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <Link to="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link to="/signup">
            <Button variant="primary" size="sm">
              Start Free
            </Button>
          </Link>
          <button className="rounded-lg p-2 text-fg-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </Container>
      {open && (
        <div className="animate-fade-in border-t border-line bg-bg px-4 py-3 md:hidden">
          {links.map(([l, h]) => (
            <a key={h} href={h.startsWith('#') ? '/' + h : h} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-[14px] font-medium text-fg-2 hover:bg-surface-3">
              {l}
            </a>
          ))}
        </div>
      )}
    </header>
  )
}

/* ----------------------------------------------------------------- Hero */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute top-[-280px] left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.22),transparent)] dark:bg-[radial-gradient(closest-side,rgba(99,102,241,0.28),transparent)]" />
      <Container className="relative pt-16 pb-20 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <a
            href="#automations"
            className="mb-7 inline-flex animate-rise items-center gap-2 rounded-full border border-line bg-surface/80 py-1 pr-3 pl-1 text-[12.5px] text-fg-2 shadow-xs backdrop-blur transition-colors hover:border-line-strong"
          >
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11.5px] font-semibold text-primary-ink">New</span>
            Real-time URL Inspection monitoring
            <ArrowRight className="size-3.5 text-fg-4" />
          </a>
          <h1 className="display animate-rise text-[44px] leading-[1.02] font-semibold text-fg [animation-delay:60ms] sm:text-[64px] lg:text-[72px]">
            Know exactly
            <br />
            what{' '}
            <span className="bg-gradient-to-br from-[#818CF8] via-[#6366F1] to-[#4F46E5] bg-clip-text text-transparent">Google sees.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl animate-rise text-[17px] leading-relaxed text-fg-3 [animation-delay:120ms] sm:text-[18px]">
            Monitor indexing, backlinks, technical SEO and search visibility from one intelligent platform.
          </p>
          <div className="mt-9 flex animate-rise flex-col items-center justify-center gap-3 [animation-delay:180ms] sm:flex-row">
            <Link to="/signup">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight />}>
                Start Free
              </Button>
            </Link>
            <Link to="/demo">
              <Button variant="secondary" size="lg">
                Explore Demo
              </Button>
            </Link>
          </div>
          <div className="mt-5 flex animate-rise flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12.5px] text-fg-4 [animation-delay:220ms]">
            {['Free plan, no card', 'Read-only Search Console access', 'Founding price locked for life'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" />
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="relative mx-auto mt-16 max-w-[1080px] animate-rise [animation-delay:280ms]">
          <div className="pointer-events-none absolute -inset-x-10 -bottom-10 top-20 rounded-[40px] bg-[radial-gradient(closest-side,rgba(99,102,241,0.18),transparent)] blur-2xl" />
          <HeroPreview />
        </div>
      </Container>
    </section>
  )
}

/* ---------------------------------------------------------------- Trust */

const wordmarks: { name: string; glyph: ReactNode; className: string }[] = [
  { name: 'Northwind', glyph: <span className="size-3.5 rotate-45 rounded-[3px] border-2 border-current" />, className: 'font-semibold tracking-tight' },
  { name: 'lumencraft', glyph: <span className="size-3.5 rounded-full border-2 border-current" />, className: 'font-medium lowercase' },
  { name: 'FERN&PINE', glyph: null, className: 'font-bold tracking-[0.18em] text-[13px]' },
  { name: 'Kestrel', glyph: <span className="h-3.5 w-1.5 skew-x-[-18deg] bg-current" />, className: 'font-semibold italic' },
  { name: 'harbor', glyph: <span className="flex gap-0.5"><span className="size-1.5 rounded-full bg-current" /><span className="size-1.5 rounded-full bg-current" /></span>, className: 'font-semibold' },
  { name: 'Atlas/Dev', glyph: null, className: 'font-mono font-medium' },
]

function Trust() {
  return (
    <section className="border-y border-line bg-surface-2/60 py-12">
      <Container>
        <p className="text-center text-[13.5px] text-fg-3">Built for SEO teams, agencies and ambitious websites.</p>
        <div className="mt-8 grid grid-cols-2 items-center gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {wordmarks.map((w) => (
            <div key={w.name} className="flex items-center justify-center gap-2 text-[17px] text-fg-4 transition-colors hover:text-fg-2">
              {w.glyph}
              <span className={w.className}>{w.name}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------- Features */

function FeatureCard({ icon, title, text, children, className }: { icon: ReactNode; title: string; text: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card', className)}>
      <span className="flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary-soft text-primary [&_svg]:size-4">{icon}</span>
      <h3 className="heading mt-4 text-[16px] font-semibold text-fg">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-3">{text}</p>
      <div className="mt-5 flex-1">{children}</div>
    </div>
  )
}

function Features() {
  return (
    <section id="features" className="scroll-mt-16 py-24">
      <Container>
        <SectionHeading
          eyebrow="Platform"
          title="Everything that decides whether you rank — in one place."
          description="Six tightly connected modules that share one data model. A lost backlink, a dropped page and a robots.txt change are never separate stories."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={<ScanSearch />} title="Index Monitoring" text="Know the moment a page is indexed, dropped or stuck in “Discovered” — straight from Search Console, plus our own indexability checks.">
            <div className="space-y-1.5">
              {[
                ['/blog/technical-seo-guide', 'Indexed', 'success'],
                ['/docs/api', 'Indexed', 'success'],
                ['/tag/link-building?page=4', 'Crawled', 'warning'],
              ].map(([p, s, t]) => (
                <div key={p} className="flex items-center justify-between rounded-lg border border-line-soft bg-surface-2 px-2.5 py-1.5 text-[11.5px]">
                  <span className="truncate font-mono text-fg-2">{p}</span>
                  <Badge size="xs" tone={t as 'success' | 'warning'}>{s}</Badge>
                </div>
              ))}
            </div>
          </FeatureCard>
          <FeatureCard icon={<Link2 />} title="Backlink Intelligence" text="Every link re-verified daily — anchor, dofollow or nofollow, and whether the linking page is still indexable. Lost links alert you within a day.">
            <div className="space-y-1.5">
              {[
                ['web.dev', 'new', 92],
                ['smashingmagazine.com', 'active', 92],
                ['backlinko.com', 'lost', 82],
              ].map(([d, s, a]) => (
                <div key={d as string} className="flex items-center gap-2 rounded-lg border border-line-soft bg-surface-2 px-2.5 py-1.5 text-[11.5px]">
                  <DomainIcon domain={d as string} size={16} />
                  <span className="flex-1 truncate font-medium text-fg-2">{d}</span>
                  <span className="tnum text-fg-3">{a}</span>
                  <LinkStatusBadge status={s as 'new' | 'active' | 'lost'} />
                </div>
              ))}
            </div>
          </FeatureCard>
          <FeatureCard icon={<ShieldCheck />} title="Technical SEO" text="Status codes, redirects, noindex, canonicals, robots rules, titles and thin content on every monitored URL — prioritised by impact, with the fix spelled out.">
            <div className="flex items-center gap-4 rounded-lg border border-line-soft bg-surface-2 p-3">
              <div className="relative flex size-14 items-center justify-center">
                <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--surface-3)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${0.87 * 97.4} 97.4`} />
                </svg>
                <span className="tnum text-[15px] font-semibold text-fg">87</span>
              </div>
              <div className="tnum space-y-1 text-[11.5px]">
                <div className="flex items-center gap-1.5 text-fg-2"><CheckCircle2 className="size-3 text-success" /> 126 passed</div>
                <div className="flex items-center gap-1.5 text-fg-2"><Eye className="size-3 text-warning" /> 20 warnings</div>
                <div className="flex items-center gap-1.5 text-fg-2"><XCircle className="size-3 text-error" /> 7 errors</div>
              </div>
            </div>
          </FeatureCard>
          <FeatureCard icon={<Swords />} title="Competitor Tracking" text="See which domains link to your competitors but not you, and how your referring domain growth compares month over month.">
            <div className="space-y-2">
              {[
                ['you', 642, 'var(--primary)'],
                ['crawlwise.io', 918, 'var(--fg-4)'],
                ['rankpilot.com', 503, 'var(--fg-4)'],
              ].map(([d, v, col]) => (
                <div key={d as string} className="text-[11.5px]">
                  <div className="mb-1 flex justify-between text-fg-2">
                    <span className={d === 'you' ? 'font-semibold text-fg' : ''}>{d === 'you' ? 'Your website' : d}</span>
                    <span className="tnum">{v}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full" style={{ width: `${((v as number) / 918) * 100}%`, background: col as string }} />
                  </div>
                </div>
              ))}
            </div>
          </FeatureCard>
          <FeatureCard icon={<Workflow />} title="Automations" text="Schedule crawls, index checks, backlink scans and reports. Get a Slack message only when something actually changed.">
            <div className="flex items-center gap-1">
              {['02:00', '02:15', '02:30', '02:45', '03:00'].map((t, i) => (
                <div key={t} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full items-center">
                    <span className={cn('h-px flex-1', i === 0 ? 'bg-transparent' : 'bg-primary/40')} />
                    <span className="size-2.5 rounded-full border-2 border-primary bg-surface" />
                    <span className={cn('h-px flex-1', i === 4 ? 'bg-transparent' : 'bg-primary/40')} />
                  </div>
                  <span className="tnum font-mono text-[10px] text-fg-4">{t}</span>
                </div>
              ))}
            </div>
          </FeatureCard>
          <FeatureCard icon={<FileBarChart2 />} title="Reports" text="White-label PDF reports your clients will actually read — executive summary, trends, wins and next actions. Sent on schedule.">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex-1 rounded-md border border-line-soft bg-surface-2 p-2" style={{ transform: `translateY(${i * 4}px)` }}>
                  <div className="h-1.5 w-2/3 rounded-full bg-fg-4/50" />
                  <div className="mt-1.5 h-1 w-full rounded-full bg-line" />
                  <div className="mt-1 h-1 w-4/5 rounded-full bg-line" />
                  <div className="mt-2 flex h-5 items-end gap-0.5">
                    {[40, 55, 48, 70, 82].map((h, k) => (
                      <span key={k} className="flex-1 rounded-t-[2px] bg-primary/70" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FeatureCard>
        </div>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------ Product preview */

function ProductPreview() {
  const c = useChartColors()
  const data = lastDays(indexSeries, 90)
  const tiles = [
    { label: 'Indexed', value: '1,284', icon: CheckCircle2, color: 'text-success', note: '+142 in 30 days' },
    { label: 'Crawled', value: '142', icon: Eye, color: 'text-warning', note: 'Not indexed yet' },
    { label: 'Discovered', value: '87', icon: CircleDashed, color: 'text-fg-3', note: 'Awaiting crawl' },
    { label: 'Errors', value: '12', icon: XCircle, color: 'text-error', note: '4xx / 5xx' },
  ]
  return (
    <section id="product" className="scroll-mt-16 border-t border-line bg-surface-2/50 py-24">
      <Container>
        <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-2">
          <SectionHeading eyebrow="Indexing overview" title="See coverage the way Google reports it." />
          <p className="text-[16px] leading-relaxed text-fg-3 lg:pb-1">
            Indexora reads coverage straight from Google and keeps the history Search Console throws away — so you can see exactly when a page dropped, and why.
          </p>
        </div>
        <div className="mt-12 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="grid grid-cols-2 divide-line border-b border-line lg:grid-cols-4 lg:divide-x [&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-line lg:[&>*:nth-child(odd)]:border-r-0 [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-line lg:[&>*:nth-child(-n+2)]:border-b-0">
            {tiles.map((t) => (
              <div key={t.label} className="p-5 sm:p-6">
                <div className="flex items-center gap-2 text-[13px] font-medium text-fg-3">
                  <t.icon className={cn('size-4', t.color)} />
                  {t.label}
                </div>
                <div className="tnum display mt-3 text-[34px] leading-none font-semibold text-fg">{t.value}</div>
                <div className="mt-2 text-[12.5px] text-fg-4">{t.note}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3">
            <div className="p-3 pt-5 sm:p-5 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between px-2">
                <span className="text-[13.5px] font-semibold text-fg">Indexed URLs · 90 days</span>
                <Badge tone="success" dot>
                  Live
                </Badge>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pp" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={c.s1} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={c.s1} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="date" {...axisProps(c.axis)} tickFormatter={(d) => formatShortDate(d)} minTickGap={50} />
                  <YAxis {...axisProps(c.axis)} width={48} domain={['dataMin - 30', 'dataMax + 20']} tickFormatter={(v) => Math.round(v).toLocaleString('en-US')} />
                  <Tooltip cursor={{ stroke: c.cursor, strokeDasharray: '3 3' }} content={(p) => <ChartTooltip {...p} formatLabel={(l) => formatShortDate(l)} />} />
                  <Area type="monotone" dataKey="indexed" name="Indexed" stroke={c.s1} strokeWidth={2} fill="url(#pp)" activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="border-t border-line p-5 lg:border-t-0 lg:border-l">
              <div className="mb-4 text-[13.5px] font-semibold text-fg">What changed overnight</div>
              <ul className="space-y-4">
                {[
                  { icon: CheckCircle2, cls: 'text-success', t: '3 URLs became indexed', d: '/blog/crawl-budget-explained and 2 more' },
                  { icon: Eye, cls: 'text-warning', t: 'Canonical mismatch', d: 'Google chose a different canonical on 1 URL' },
                  { icon: XCircle, cls: 'text-error', t: '/docs/errors returns 500', d: 'Two consecutive failed crawls' },
                  { icon: Sparkles, cls: 'text-primary', t: '12 new URLs in sitemap', d: 'Queued for index monitoring' },
                ].map((x) => (
                  <li key={x.t} className="flex gap-3">
                    <x.icon className={cn('mt-0.5 size-4 shrink-0', x.cls)} />
                    <div>
                      <div className="text-[13px] font-medium text-fg">{x.t}</div>
                      <div className="text-[12.5px] text-fg-3">{x.d}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

/* ----------------------------------------------------------- Automation */

const timeline = [
  { time: '02:00', title: 'Site crawl', detail: '1,525 URLs · 2m 41s' },
  { time: '02:15', title: 'Index status check', detail: '312 priority URLs inspected' },
  { time: '02:30', title: 'Backlink scan', detail: '14 new · 5 lost' },
  { time: '02:45', title: 'Issue detection', detail: '2 new · 7 resolved' },
  { time: '03:00', title: 'Report generated', detail: 'Sent to 3 recipients' },
]

function AutomationSection() {
  return (
    // Always rendered with the dark token set — a deliberate night-time band.
    <section id="automations" className="dark scroll-mt-16">
      <div className="relative overflow-hidden bg-bg py-24 text-fg">
        <div className="bg-dots pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black,transparent)]" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.25),transparent)]" />
        <Container className="relative">
          <SectionHeading
            center
            eyebrow="Automations"
            title="Your SEO runs while you sleep."
            description="Every night Indexora crawls, inspects, compares and reports — then wakes you up only for what matters."
          />
          <div className="relative mt-16">
            <div className="absolute top-[22px] right-[10%] left-[10%] hidden h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent md:block" />
            <ol className="relative grid grid-cols-1 gap-4 md:grid-cols-5">
              {timeline.map((t, i) => (
                <li key={t.time} className="relative flex gap-4 md:flex-col md:items-center md:gap-0 md:text-center">
                  {i < timeline.length - 1 && <span className="absolute top-11 bottom-[-16px] left-[21px] w-px bg-primary/30 md:hidden" />}
                  <span className="relative z-[1] flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-surface shadow-[0_0_0_6px_var(--bg),0_0_24px_rgba(99,102,241,0.35)]">
                    <Check className="size-4 text-primary-light" />
                  </span>
                  <div className="md:mt-5">
                    <div className="tnum font-mono text-[13px] font-medium text-primary-light">{t.time}</div>
                    <div className="mt-1 text-[15px] font-semibold text-fg">{t.title}</div>
                    <div className="mt-1 text-[13px] text-fg-3">{t.detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-line bg-surface/80 p-4 shadow-pop backdrop-blur">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                <LogoMark size={20} className="[&_rect]:fill-transparent" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-fg">Indexora</span>
                  <span className="tnum font-mono text-[11.5px] text-fg-4">03:01</span>
                </div>
                <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">
                  Nightly run complete for <span className="font-medium text-fg">northwindlabs.com</span>. 3 pages newly indexed, 5 backlinks lost (1 high authority from{' '}
                  <span className="font-medium text-fg">backlinko.com</span>). Weekly report sent.
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-md border border-line bg-surface-3 px-2 py-1 text-[12px] font-medium text-fg-2">View lost links</span>
                  <span className="rounded-md border border-line bg-surface-3 px-2 py-1 text-[12px] font-medium text-fg-2">Open report</span>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ Backlinks */

const sampleLinks = [
  { domain: 'web.dev', authority: 92, anchor: 'Core Web Vitals in 2026', type: 'dofollow' as const, status: 'new' as const, first: 'Sep 29, 2026', last: 'Oct 2, 2026' },
  { domain: 'smashingmagazine.com', authority: 92, anchor: 'technical SEO guide', type: 'dofollow' as const, status: 'active' as const, first: 'Mar 14, 2026', last: 'Oct 2, 2026' },
  { domain: 'backlinko.com', authority: 82, anchor: 'Northwind Labs', type: 'dofollow' as const, status: 'lost' as const, first: 'Jan 8, 2026', last: 'Sep 30, 2026' },
  { domain: 'reddit.com', authority: 97, anchor: 'this indexing guide', type: 'ugc' as const, status: 'active' as const, first: 'Jun 2, 2026', last: 'Oct 1, 2026' },
  { domain: 'dev.to', authority: 88, anchor: 'their crawl budget write-up', type: 'nofollow' as const, status: 'new' as const, first: 'Sep 24, 2026', last: 'Oct 2, 2026' },
  { domain: 'sitepoint.com', authority: 86, anchor: 'northwindlabs.com', type: 'dofollow' as const, status: 'active' as const, first: 'Nov 19, 2025', last: 'Oct 2, 2026' },
]

function BacklinkSection() {
  return (
    <section className="py-24">
      <Container>
        <div className="grid grid-cols-1 gap-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-end">
            <SectionHeading
              eyebrow="Backlink intelligence"
              title="Every link. Verified daily."
              description="Indexora re-checks each referring page so you know the day a link appears — and the day it disappears."
            />
            <ul className="space-y-3 lg:pb-1">
              {[
                'New and lost link detection within 24 hours',
                'Dofollow, nofollow, UGC and sponsored classification',
                'Competitor gap analysis with outreach drafts',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-[14px] text-fg-2">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                    <Check className="size-3 text-primary" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <span className="text-[13.5px] font-semibold text-fg">Backlinks · northwindlabs.com</span>
              <div className="flex gap-1.5">
                <Badge size="xs" tone="success">+214 new</Badge>
                <Badge size="xs" tone="error">−61 lost</Badge>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-left text-[11.5px] text-fg-3">
                    {['Domain', 'Authority', 'Anchor', 'Type', 'Status', 'First Seen', 'Last Seen'].map((h) => (
                      <th key={h} className="h-9 px-4 font-medium first:pl-5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleLinks.map((l) => (
                    <tr key={l.domain} className="border-b border-line-soft last:border-0 hover:bg-surface-2">
                      <td className="h-12 px-4 pl-5">
                        <span className="flex items-center gap-2">
                          <DomainIcon domain={l.domain} />
                          <span className="font-medium text-fg">{l.domain}</span>
                        </span>
                      </td>
                      <td className="px-4">
                        <AuthorityPill value={l.authority} />
                      </td>
                      <td className="max-w-[180px] truncate px-4 text-fg-2">“{l.anchor}”</td>
                      <td className="px-4">
                        <LinkTypeBadge type={l.type} />
                      </td>
                      <td className="px-4">
                        <LinkStatusBadge status={l.status} />
                      </td>
                      <td className="tnum px-4 whitespace-nowrap text-fg-2">{l.first}</td>
                      <td className={cn('tnum px-4 pr-5 whitespace-nowrap', l.status === 'lost' ? 'text-error-ink' : 'text-fg-2')}>{l.last}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

/* -------------------------------------------------------------- Pricing */

// Mirrors server/src/plans.ts — keep in sync. Reasoning: docs/PRICING.md
const plans = [
  {
    name: 'Free',
    price: [0, 0],
    founding: null as number | null,
    desc: 'Watch one site and see if Indexora earns its place.',
    features: ['1 project', '100 monitored URLs', '100 tracked backlinks', 'Weekly backlink checks', 'Daily index & indexability checks', 'Email alerts'],
    cta: 'Start free',
  },
  {
    name: 'Starter',
    price: [12, 10],
    founding: 9,
    desc: 'For a single business site or a side project.',
    features: ['3 projects', '1,000 monitored URLs', '1,000 tracked backlinks', 'Daily backlink verification', 'Search Console index status', 'Slack alerts & monthly reports'],
    cta: 'Start 14-day trial',
  },
  {
    name: 'Pro',
    price: [29, 24],
    founding: 19,
    desc: 'For consultants and growing sites with real link building.',
    features: ['10 projects', '10,000 monitored URLs', '10,000 tracked backlinks', 'Weekly new-backlink discovery', 'Competitor backlink gap (3 per project)', 'Webhooks, API, 3 seats'],
    featured: true,
    cta: 'Start 14-day trial',
  },
  {
    name: 'Agency',
    price: [79, 66],
    founding: 49,
    desc: 'For agencies reporting to many clients.',
    features: ['50 projects', '50,000 monitored URLs', '50,000 tracked backlinks', 'URL checks every 6 hours', 'White-label client reports', '10 seats'],
    cta: 'Start 14-day trial',
  },
]

function Pricing() {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  return (
    <section id="pricing" className="scroll-mt-16 border-t border-line bg-surface-2/50 py-24">
      <Container>
        <SectionHeading
          center
          eyebrow="Pricing"
          title="Honest pricing for honest monitoring."
          description="Start free. Upgrade when Indexora has caught something worth paying for. Every plan includes every module — you only scale by sites, URLs and links."
        />
        <div className="mt-8 flex flex-col items-center gap-3">
          <Segmented
            value={cycle}
            onChange={setCycle}
            items={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: <span className="inline-flex items-center gap-1.5">Yearly <span className="text-[11px] text-primary-ink">2 months free</span></span> },
            ]}
          />
          {cycle === 'monthly' && (
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary-soft px-3 py-1 text-[12.5px] text-primary-ink">
              <Sparkles className="size-3.5" />
              Founding customers: the first 100 subscribers keep their launch price for life
            </p>
          )}
        </div>
        <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const showFounding = cycle === 'monthly' && p.founding !== null
            const price = showFounding ? p.founding! : cycle === 'monthly' ? p.price[0] : p.price[1]
            return (
              <div
                key={p.name}
                className={cn(
                  'relative flex flex-col rounded-2xl border bg-surface p-6',
                  p.featured ? 'border-primary shadow-[0_0_0_1px_var(--primary),0_24px_48px_-24px_rgba(79,70,229,0.45)]' : 'border-line',
                )}
              >
                {p.featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                    Recommended
                  </span>
                )}
                <h3 className="text-[16px] font-semibold text-fg">{p.name}</h3>
                <p className="mt-1 min-h-[40px] text-[13px] text-fg-3">{p.desc}</p>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="tnum display text-[40px] leading-none font-semibold text-fg">${price}</span>
                  <span className="text-[13px] text-fg-3">/ month</span>
                  {showFounding && <span className="tnum text-[13px] text-fg-4 line-through">${p.price[0]}</span>}
                </div>
                <p className="tnum mt-1.5 h-4 text-[12px] text-fg-4">
                  {p.price[0] === 0
                    ? 'Free forever · no card'
                    : showFounding
                      ? `Founding price, locked for life`
                      : cycle === 'yearly'
                        ? `Billed $${(p.price[0] * 10).toLocaleString('en-US')} yearly`
                        : 'Billed monthly'}
                </p>
                <Link to={p.price[0] === 0 ? '/signup' : `/signup?plan=${p.name.toLowerCase()}`} className="mt-6">
                  <Button variant={p.featured ? 'primary' : 'secondary'} className="w-full" size="lg">
                    {p.cta}
                  </Button>
                </Link>
                <ul className="mt-7 space-y-3 border-t border-line pt-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-fg-2">
                      <Check className={cn('mt-0.5 size-4 shrink-0', p.featured ? 'text-primary' : 'text-fg-3')} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-[13px] leading-relaxed text-fg-3">
          Prices in USD; VAT/sales tax is added at checkout where applicable. Trials need no card. If Indexora doesn’t catch a single
          issue or lost link in your first 30 days of a paid plan, email us for a full refund.
        </p>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------------ FAQ */

const faqs = [
  [
    'How does backlink monitoring actually work?',
    'You tell us which links you have — add them by hand, paste a list, or upload the “Latest links” export from Search Console (or an Ahrefs/Semrush export). Every day our crawler opens each linking page, finds your link and records the anchor, dofollow/nofollow/UGC/sponsored and whether the page is noindex. A link is only marked lost after it is missing on two checks in a row, so a cache hiccup never wakes you up.',
  ],
  [
    'Does Indexora find new backlinks automatically?',
    'On Pro and Agency, yes: once a week we pull newly discovered links to your domain from a commercial backlink index, then verify each one with our own crawler before it shows up as “new”. On Free and Starter you add or import links yourself — still verified daily.',
  ],
  [
    'Where does index status come from?',
    'From Google itself, through the Search Console URL Inspection API, using read-only access to the properties you connect. Alongside that we run our own checks — HTTP status, noindex, canonical and robots.txt rules for Googlebot — so you see why a page is or isn’t indexable.',
  ],
  [
    'Can Indexora force Google to index my pages?',
    'No — and you should be wary of any tool that claims to. Google offers no public API to request indexing for normal pages. We show you exactly what’s blocking a page and what to fix; the “Request indexing” button in Search Console remains the official route.',
  ],
  [
    'Will you build backlinks for me?',
    'No. Automated link building breaks Google’s spam policies and can get a site penalised. Indexora monitors and protects the links you earn, and points you to real opportunities — competitor gaps, unlinked mentions and broken links — with a drafted outreach email you send yourself.',
  ],
  [
    'Is my data safe?',
    'Search Console access is read-only, OAuth tokens are encrypted at rest, and passwords are hashed with scrypt. We never resell or share your data, and you can disconnect Google or delete your account at any time.',
  ],
]

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="scroll-mt-16 py-24">
      <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[340px_minmax(0,1fr)]">
        <SectionHeading eyebrow="FAQ" title="Questions, answered." description="Can’t find what you’re looking for? Our team replies within a few hours." />
        <div className="divide-y divide-line border-y border-line">
          {faqs.map(([q, a], i) => {
            const isOpen = open === i
            return (
              <div key={q}>
                <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 py-5 text-left">
                  <span className="text-[15px] font-medium text-fg">{q}</span>
                  <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border border-line transition-all duration-200', isOpen && 'rotate-180 border-primary/30 bg-primary-soft text-primary')}>
                    <ChevronDown className="size-4" />
                  </span>
                </button>
                <div className={cn('grid transition-[grid-template-rows] duration-300 ease-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <div className="overflow-hidden">
                    <p className="max-w-2xl pb-5 text-[14px] leading-relaxed text-fg-3">{a}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------ Final CTA */

function FinalCta() {
  return (
    <section className="pb-24">
      <Container>
        <div className="dark relative overflow-hidden rounded-3xl border border-line bg-bg px-6 py-16 text-center sm:px-12 sm:py-20">
          <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_70%_at_50%_100%,black,transparent)]" />
          <div className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.35),transparent)]" />
          <div className="relative">
            <LogoMark size={40} className="mx-auto" />
            <h2 className="display mt-6 text-[34px] leading-[1.1] font-semibold text-fg sm:text-[48px]">Stop guessing. Start monitoring.</h2>
            <p className="mx-auto mt-4 max-w-md text-[16px] text-fg-3">Connect Search Console and see your first index report in under a minute.</p>
            <Link to="/signup" className="mt-8 inline-block">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight />}>
                Start Free
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  )
}

/* --------------------------------------------------------------- Footer */

export function Footer() {
  const cols: [string, [string, string][]][] = [
    ['Product', [['Features', '/#features'], ['Pricing', '/#pricing'], ['Live demo', '/demo'], ['FAQ', '/#faq']]],
    ['Free tools', [['Backlink checker', '/tools/backlink-checker'], ['Indexability checker', '/tools/indexability-checker']]],
    ['Legal', [['Privacy', '/privacy'], ['Terms', '/terms']]],
  ]
  return (
    <footer className="border-t border-line py-14">
      <Container>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <Logo />
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-fg-3">Know exactly what Google sees: index status, indexability and every backlink, checked for you every day.</p>
          </div>
          {cols.map(([h, items]) => (
            <div key={h}>
              <div className="text-[12.5px] font-semibold text-fg">{h}</div>
              <ul className="mt-3 space-y-2">
                {items.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-[13px] text-fg-3 transition-colors hover:text-fg">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-line pt-6 text-[12.5px] text-fg-4">© {new Date().getFullYear()} Indexora. All rights reserved.</div>
      </Container>
    </footer>
  )
}
