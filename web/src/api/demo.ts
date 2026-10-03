import { ApiError } from './client'
import type { DataSource, UrlQuery, BacklinkQuery } from './source'
import type { Alert, AuditResult, Backlink, HistoryPoint, Me, Plan, Project, UrlItem } from './types'
import { projects as mockProjects } from '@/data/projects'
import { urls as mockUrls, urlHistory } from '@/data/urls'
import { backlinks as mockBacklinks, anchorDistribution, authorityBuckets } from '@/data/backlinks'
import { alerts as mockAlerts } from '@/data/alerts'
import { auditCategories, auditChecks } from '@/data/audit'
import { keywords as mockKeywords } from '@/data/keywords'
import { opportunities as mockOpps } from '@/data/opportunities'
import { indexSeries, backlinkSeries } from '@/data/series'
import { NOW } from '@/utils/format'

const wait = <T>(v: T, ms = 380) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms))

const demoOnly = () =>
  Promise.reject(new ApiError(403, 'demo', 'This is the interactive demo. Create a free account to monitor your own site.'))

// Kept in sync with server/src/plans.ts
const plans: Plan[] = [
  { id: 'free', name: 'Free', monthly: 0, yearly: 0, founding: 0, limits: { projects: 1, urls: 100, backlinks: 100, competitorsPerProject: 0, seats: 1, backlinkCheckHours: 168, urlCheckHours: 24, discovery: false }, features: { slack: false, webhooks: false, reports: false, whiteLabel: false, api: false } },
  { id: 'starter', name: 'Starter', monthly: 12, yearly: 120, founding: 9, limits: { projects: 3, urls: 1000, backlinks: 1000, competitorsPerProject: 1, seats: 1, backlinkCheckHours: 24, urlCheckHours: 24, discovery: false }, features: { slack: true, webhooks: false, reports: true, whiteLabel: false, api: false } },
  { id: 'pro', name: 'Pro', monthly: 29, yearly: 290, founding: 19, limits: { projects: 10, urls: 10000, backlinks: 10000, competitorsPerProject: 3, seats: 3, backlinkCheckHours: 24, urlCheckHours: 12, discovery: 'weekly' }, features: { slack: true, webhooks: true, reports: true, whiteLabel: false, api: true } },
  { id: 'agency', name: 'Agency', monthly: 79, yearly: 790, founding: 49, limits: { projects: 50, urls: 50000, backlinks: 50000, competitorsPerProject: 5, seats: 10, backlinkCheckHours: 24, urlCheckHours: 6, discovery: 'weekly' }, features: { slack: true, webhooks: true, reports: true, whiteLabel: true, api: true } },
]

const me: Me = {
  user: { id: 'demo', email: 'omer@northwind.studio', name: 'Ömer Kılıç', plan: 'pro', founding: true, createdAt: '2026-03-14T10:00:00Z' },
  plan: plans[2],
  usage: { projects: 5, urls: 8504, backlinks: 9612 },
  google: { connected: true, email: 'omer@northwind.studio', configured: true },
}

const projectList: Project[] = mockProjects.map((p) => ({
  id: p.id,
  name: p.name,
  domain: p.domain,
  gscProperty: `sc-domain:${p.domain}`,
  createdAt: '2026-03-14T10:00:00Z',
  lastScan: p.lastScan,
  indexTrend: p.indexTrend,
  stats: {
    urls: p.totalUrls,
    indexed: p.indexedUrls,
    crawled: Math.round((p.totalUrls - p.indexedUrls) * 0.58),
    discovered: Math.round((p.totalUrls - p.indexedUrls) * 0.36),
    notIndexed: Math.round((p.totalUrls - p.indexedUrls) * 0.06),
    unknown: 0,
    indexable: p.totalUrls - p.issues,
    issues: p.issues,
    backlinks: p.backlinks,
    refDomains: p.refDomains,
    gained30d: Math.round(p.backlinks * 0.025),
    lost30d: Math.round(p.backlinks * 0.007),
    dofollow: Math.round(p.backlinks * 0.71),
    pendingBacklinks: 0,
    trackedBacklinks: p.backlinks,
  },
}))

const urlItems: UrlItem[] = mockUrls.map((u) => ({
  id: u.id,
  url: `https://${u.domain}${u.path}`,
  path: u.path,
  title: u.title,
  status: u.status,
  coverageState:
    u.status === 'indexed' ? 'Submitted and indexed' : u.status === 'crawled' ? 'Crawled - currently not indexed' : u.status === 'discovered' ? 'Discovered - currently not indexed' : u.status === 'blocked' ? (u.robots === 'noindex' ? "Excluded by 'noindex' tag" : 'Blocked by robots.txt') : u.http === 404 ? 'Not found (404)' : 'Server error (5xx)',
  http: u.http,
  indexable: u.indexable,
  robots: u.robots,
  canonical: u.canonical,
  canonicalUrl: u.canonical === 'other' ? `https://${u.domain}${u.canonicalTarget}` : u.canonical === 'self' ? `https://${u.domain}${u.path}` : null,
  googleCanonical: u.canonical === 'other' ? `https://${u.domain}${u.canonicalTarget}` : `https://${u.domain}${u.path}`,
  inSitemap: u.inSitemap,
  wordCount: u.wordCount,
  loadMs: Math.round(u.loadTime * 1000),
  lastCrawl: u.lastCrawl,
  lastChecked: u.lastChecked,
  indexCheckedAt: u.lastChecked,
  source: 'sitemap',
}))

const backlinkItems: Backlink[] = mockBacklinks.map((b) => ({
  id: b.id,
  sourceUrl: b.sourceUrl,
  sourceDomain: b.sourceDomain,
  target: `https://northwindlabs.com${b.target}`,
  expectedTarget: null,
  anchor: b.anchor,
  type: b.type,
  status: b.status === 'new' ? 'active' : b.status,
  isNew: b.status === 'new',
  origin: b.status === 'new' ? 'discovery' : 'import',
  authority: b.authority,
  pageNoindex: false,
  http: b.status === 'lost' ? 200 : 200,
  lastError: b.status === 'lost' ? 'No link to northwindlabs.com found on page' : null,
  firstSeen: b.firstSeen + 'T08:00:00Z',
  lastSeen: b.lastSeen + 'T08:00:00Z',
  lastChecked: '2026-10-02T02:30:00Z',
  nextCheck: '2026-10-03T02:30:00Z',
}))

let alertItems: Alert[] = mockAlerts.map((a) => ({
  id: a.id,
  kind: a.kind,
  severity: a.severity,
  title: a.title,
  description: a.description,
  href: a.href,
  time: a.time,
  read: a.read,
  project: a.project,
}))

const history: HistoryPoint[] = indexSeries.map((p, i) => {
  const b = backlinkSeries[i]
  return {
    date: p.date,
    urls: p.indexed + p.crawled + p.discovered + p.notIndexed,
    indexed: p.indexed,
    crawled: p.crawled,
    discovered: p.discovered,
    not_indexed: p.notIndexed,
    indexable: p.indexed + p.crawled,
    backlinks: b.total,
    ref_domains: b.refDomains,
    gained: b.gained,
    lost: b.lost,
    issues: Math.max(23, Math.round(34 - (i / indexSeries.length) * 11)),
  }
})

function pageOf<T>(xs: T[], page: number, pageSize: number) {
  return xs.slice((page - 1) * pageSize, page * pageSize)
}

const statusOrder = ['indexed', 'crawled', 'discovered', 'blocked', 'error', 'unknown']

function queryUrls(q: UrlQuery) {
  const s = q.q?.toLowerCase().trim()
  let xs = urlItems.filter((u) => (!s || u.path.toLowerCase().includes(s) || (u.title ?? '').toLowerCase().includes(s)) && (!q.status?.length || q.status.includes(u.status)))
  const d = q.dir === 'asc' ? 1 : -1
  xs = [...xs].sort((a, b) => {
    switch (q.sort) {
      case 'url':
        return a.path.localeCompare(b.path) * d
      case 'status':
        return (statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)) * d
      case 'http':
        return ((a.http ?? 0) - (b.http ?? 0)) * d
      case 'lastCrawl':
        return (a.lastCrawl ?? '').localeCompare(b.lastCrawl ?? '') * d
      default:
        return (a.lastChecked ?? '').localeCompare(b.lastChecked ?? '') * d
    }
  })
  const counts: Record<string, number> = {}
  urlItems.forEach((u) => (counts[u.status] = (counts[u.status] ?? 0) + 1))
  return { urls: pageOf(xs, q.page, q.pageSize), total: xs.length, page: q.page, pageSize: q.pageSize, counts }
}

function queryBacklinks(q: BacklinkQuery) {
  const s = q.q?.toLowerCase().trim()
  const f = new Set(q.filter ?? [])
  const xs = backlinkItems
    .filter((b) => {
      if (s && !(b.sourceUrl + (b.anchor ?? '') + (b.target ?? '')).toLowerCase().includes(s)) return false
      if ((f.has('dofollow') || f.has('nofollow')) && !((f.has('dofollow') && b.type === 'dofollow') || (f.has('nofollow') && b.type !== 'dofollow'))) return false
      if ((f.has('new') || f.has('lost')) && !((f.has('new') && b.isNew) || (f.has('lost') && (b.status === 'lost' || b.status === 'broken')))) return false
      if ((f.has('high') || f.has('low')) && !((f.has('high') && (b.authority ?? 0) >= 70) || (f.has('low') && (b.authority ?? 100) < 30))) return false
      return true
    })
    .sort((a, b) => {
      const d = q.dir === 'asc' ? 1 : -1
      if (q.sort === 'authority') return ((a.authority ?? 0) - (b.authority ?? 0)) * d
      if (q.sort === 'lastSeen') return (a.lastSeen ?? '').localeCompare(b.lastSeen ?? '') * d
      return (a.firstSeen ?? '').localeCompare(b.firstSeen ?? '') * d
    })
  return { backlinks: pageOf(xs, q.page, q.pageSize), total: xs.length, page: q.page, pageSize: q.pageSize }
}

const sampleFor = (n: number) => urlItems.slice(0, Math.min(n, 5)).map((u) => ({ id: u.id, url: u.url }))
const demoAudit: AuditResult = {
  score: 87,
  urlsChecked: 1525,
  linksChecked: 8421,
  categories: auditCategories
    .filter((c) => c.key !== 'structured')
    .map((c) => ({ key: c.key as AuditResult['categories'][number]['key'], name: c.name, description: c.description, score: c.score, passed: c.passed, warnings: c.warnings, errors: c.errors })),
  checks: auditChecks
    .filter((c) => c.category !== 'structured')
    .map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category as AuditResult['checks'][number]['category'],
      severity: c.severity === 'passed' ? 'notice' : c.severity,
      affected: c.affected,
      samples: sampleFor(c.affected),
      description: c.description,
      fix: c.fix,
    })),
}

export const demoSource: DataSource = {
  mode: 'demo',
  base: '/demo',
  me: () => wait(me, 120),
  plans: () => wait({ plans, founding: { total: 100, left: 63 } }, 100),
  projects: () => wait(projectList),
  project: (id) => wait(projectList.find((p) => p.id === id) ?? projectList[0]),
  history: (id, days) => {
    const scale = id === projectList[0].id ? 1 : (projectList.find((p) => p.id === id)?.stats?.indexed ?? 1284) / 1284
    return wait(
      history.slice(-days).map((h) =>
        scale === 1 ? h : { ...h, indexed: Math.round(h.indexed * scale), crawled: Math.round(h.crawled * scale), discovered: Math.round(h.discovered * scale), backlinks: Math.round(h.backlinks * scale), ref_domains: Math.round(h.ref_domains * scale) },
      ),
    )
  },
  sitemaps: () =>
    wait({
      sitemaps: [
        { id: 'sm1', url: 'https://northwindlabs.com/sitemap-blog.xml', status: 'ok', url_count: 412, last_error: null, last_fetched_at: '2026-10-02T09:00:00Z' },
        { id: 'sm2', url: 'https://northwindlabs.com/sitemap-docs.xml', status: 'ok', url_count: 641, last_error: null, last_fetched_at: '2026-10-02T09:00:00Z' },
        { id: 'sm3', url: 'https://northwindlabs.com/sitemap-pages.xml', status: 'ok', url_count: 96, last_error: null, last_fetched_at: '2026-10-02T09:00:00Z' },
        { id: 'sm4', url: 'https://northwindlabs.com/sitemap-products.xml', status: 'ok', url_count: 376, last_error: null, last_fetched_at: '2026-10-02T09:00:00Z' },
      ],
      coverage: { total: 1525, indexed: 1284 },
    }),
  urls: (_id, q) => wait(queryUrls(q)),
  url: (id) => {
    const u = urlItems.find((x) => x.id === id)
    if (!u) return Promise.reject(new ApiError(404, 'not_found', 'URL not found'))
    return wait({
      url: u,
      events: urlHistory(id).map((e) => ({ at: e.date, kind: e.tone, detail: `${e.title} — ${e.detail}` })),
      backlinks: backlinkItems
        .filter((b) => b.target === u.url && b.status !== 'pending')
        .map((b) => ({ id: b.id, sourceUrl: b.sourceUrl, sourceDomain: b.sourceDomain, anchor: b.anchor, rel: b.type, authority: b.authority, status: b.status, firstSeen: b.firstSeen })),
    })
  },
  backlinks: (_id, q) => wait(queryBacklinks(q)),
  backlinkProfile: () =>
    wait({
      anchors: { branded: anchorDistribution[0].value, other: anchorDistribution[1].value, url: anchorDistribution[2].value, generic: anchorDistribution[3].value, empty: anchorDistribution[4].value },
      authority: [...authorityBuckets].map((b) => ({ bucket: b.bucket, count: b.count })),
      unknownAuthority: 0,
      total: 642,
    }),
  alerts: (o) => wait({ alerts: alertItems.filter((a) => !o?.unread || !a.read), unread: alertItems.filter((a) => !a.read).length }, 200),
  notificationSettings: () => wait({ email: 1, slackWebhook: 'https://hooks.slack.com/services/demo', webhookUrl: null, digest: 0, minSeverity: 'warning' as const }),

  audit: () => wait(demoAudit),
  opportunities: () =>
    wait({
      gapStatus: 'ok' as const,
      competitors: ['crawlwise.io', 'rankpilot.com', 'serpstack.dev'],
      opportunities: [
        {
          id: 'reclaim:backlinko',
          kind: 'reclaim' as const,
          domain: 'backlinko.com',
          authority: 82,
          headline: 'Your link “Northwind Labs” was removed',
          reason: 'It was last seen 2026-09-30. Links removed during a page update are often restored after a short, friendly email.',
          sourceUrl: 'https://backlinko.com/seo-tools',
          targetUrl: 'https://northwindlabs.com/',
          competitors: [],
          priority: 97,
        },
        ...mockOpps.map((o) => ({
          id: o.id,
          kind: o.kind,
          domain: o.domain,
          authority: o.authority,
          headline: o.headline,
          reason: o.reason,
          sourceUrl: `https://${o.domain}`,
          targetUrl: `https://northwindlabs.com${o.suggestedTarget}`,
          competitors: o.competitors,
          priority: o.relevance,
        })),
      ],
    }),
  competitors: () =>
    wait({
      providerConfigured: true,
      competitors: ['crawlwise.io', 'rankpilot.com', 'serpstack.dev'].map((d, i) => ({ id: `c${i}`, domain: d, createdAt: '2026-04-01T00:00:00Z' })),
    }),
  apiKeys: async () => [{ id: 'k1', name: 'Looker Studio sync', prefix: 'ix_8fK2pQ1', createdAt: '2026-08-12T10:00:00Z', lastUsedAt: '2026-10-02T06:14:00Z' }],
  createApiKey: demoOnly,
  saveBranding: demoOnly,
  health: async () => ({
    certificate: { host: 'acme-analytics.com', expiresAt: new Date(Date.now() + 61 * 86_400_000).toISOString(), issuer: "Let's Encrypt", error: null, checkedAt: new Date().toISOString() },
    domain: { expiresAt: new Date(Date.now() + 23 * 86_400_000).toISOString(), registrar: 'Namecheap, Inc.', checkedAt: new Date().toISOString() },
  }),
  cwv: async () => {
    const dates = Array.from({ length: 25 }, (_, i) => new Date(Date.now() - (24 - i) * 7 * 86_400_000).toISOString().slice(0, 10))
    const wave = (base: number, amp: number, drift: number) => dates.map((_, i) => Math.round((base + Math.sin(i / 3) * amp + i * drift) * 100) / 100)
    return {
      configured: true as const,
      checked: true as const,
      origin: 'https://northwindlabs.com',
      fetchedAt: new Date().toISOString(),
      series: { dates, p75: { lcp: wave(2700, 160, -20), inp: wave(230, 15, -2.4), cls: wave(0.08, 0.012, 0.0016), fcp: wave(1700, 120, -10), ttfb: wave(720, 60, -6) } },
    }
  },
  team: async () => ({
    role: 'owner' as const,
    seats: { used: 3, limit: 3 },
    owner: { id: 'u1', name: me.user.name, email: me.user.email },
    members: [{ id: 'u2', name: 'Priya Raman', email: 'priya@northwind.io', joinedAt: '2026-06-02T09:00:00Z' }],
    invites: [{ id: 'i1', email: 'leo@northwind.io', createdAt: '2026-09-30T09:00:00Z', expiresAt: '2026-10-07T09:00:00Z', expired: false }],
  }),
  inviteMember: demoOnly,
  revokeInvite: demoOnly,
  removeMember: demoOnly,
  leaveTeam: demoOnly,
  deleteApiKey: demoOnly,
  addCompetitor: demoOnly,
  deleteCompetitor: demoOnly,
  keywords: () =>
    wait({
      connected: true,
      range: { start: '2026-09-02', end: '2026-09-29' },
      rows: mockKeywords.map((k) => {
        const impressions = Math.round(k.volume * (k.position <= 3 ? 0.9 : k.position <= 10 ? 0.55 : 0.12))
        const ctr = k.position <= 1 ? 0.28 : k.position <= 3 ? 0.12 : k.position <= 10 ? 0.03 : 0.006
        return { query: k.keyword, page: `https://northwindlabs.com${k.url}`, clicks: Math.round(impressions * ctr), impressions, ctr, position: k.position, prevPosition: k.position + k.change, prevClicks: null }
      }),
    }),
  createProject: demoOnly,
  updateProject: demoOnly,
  deleteProject: demoOnly,
  scanProject: demoOnly,
  addUrls: demoOnly,
  recheckUrl: demoOnly,
  addSitemap: demoOnly,
  addBacklinks: demoOnly,
  importBacklinks: demoOnly,
  recheckBacklink: demoOnly,
  deleteBacklink: demoOnly,
  markAlertRead: async (id) => {
    alertItems = alertItems.map((a) => (a.id === id ? { ...a, read: true } : a))
  },
  markAllAlertsRead: async () => {
    alertItems = alertItems.map((a) => ({ ...a, read: true }))
  },
  saveNotificationSettings: demoOnly,
  googleSites: () => wait([{ siteUrl: 'sc-domain:northwindlabs.com', permissionLevel: 'siteOwner' }]),
  disconnectGoogle: demoOnly,
  checkout: demoOnly,
  logout: async () => undefined,
  deleteAccount: demoOnly,
}

export const DEMO_NOW = NOW
