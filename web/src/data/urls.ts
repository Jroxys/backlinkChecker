import type { IndexStatus, UrlRecord } from '@/types'
import { between, pick, rng } from '@/lib/random'

const paths: [string, string][] = [
  ['/blog/how-to-do-seo', 'How to Do SEO in 2026: A Practical Playbook'],
  ['/blog/technical-seo-guide', 'The Complete Technical SEO Guide'],
  ['/blog/google-indexing-guide', 'Google Indexing: How It Actually Works'],
  ['/products/seo-tool', 'Northwind SEO Toolkit — Product Overview'],
  ['/docs/api', 'API Reference · Northwind Docs'],
  ['/blog/backlink-strategy', 'A Backlink Strategy That Compounds'],
  ['/pricing', 'Pricing — Northwind Labs'],
  ['/blog/crawl-budget-explained', 'Crawl Budget, Explained Without the Myths'],
  ['/blog/canonical-tags', 'Canonical Tags: Rules, Edge Cases & Mistakes'],
  ['/docs/getting-started', 'Getting Started · Northwind Docs'],
  ['/blog/internal-linking', 'Internal Linking for Large Sites'],
  ['/blog/core-web-vitals-2026', 'Core Web Vitals in 2026: What Changed'],
  ['/features/rank-tracking', 'Rank Tracking — Features'],
  ['/blog/sitemap-best-practices', 'XML Sitemap Best Practices'],
  ['/docs/webhooks', 'Webhooks · Northwind Docs'],
  ['/customers/fern-and-pine', 'How Fern & Pine Grew Organic Revenue 3.2×'],
  ['/blog/robots-txt-guide', 'robots.txt: The Definitive Guide'],
  ['/blog/hreflang-implementation', 'Implementing hreflang Without Breaking Things'],
  ['/compare/northwind-vs-ahrefs', 'Northwind vs. Ahrefs: An Honest Comparison'],
  ['/blog/structured-data-guide', 'Structured Data for Non-Developers'],
  ['/docs/authentication', 'Authentication · Northwind Docs'],
  ['/blog/log-file-analysis', 'Log File Analysis for SEO'],
  ['/tag/link-building?page=4', 'Link Building — Page 4'],
  ['/blog/javascript-seo', 'JavaScript SEO: Rendering, Hydration & Google'],
  ['/about', 'About Northwind Labs'],
  ['/blog/page-speed-checklist', 'The 31-Point Page Speed Checklist'],
  ['/careers/senior-frontend-engineer', 'Senior Frontend Engineer — Careers'],
  ['/blog/e-e-a-t-signals', 'E-E-A-T Signals You Can Actually Control'],
  ['/docs/rate-limits', 'Rate Limits · Northwind Docs'],
  ['/blog/old-seo-tactics-2019', '11 SEO Tactics (2019 Edition)'],
  ['/features/site-audit', 'Site Audit — Features'],
  ['/blog/duplicate-content', 'Duplicate Content: When It Matters'],
  ['/legal/privacy', 'Privacy Policy'],
  ['/blog/keyword-cannibalization', 'Fixing Keyword Cannibalization'],
  ['/docs/sdk/python', 'Python SDK · Northwind Docs'],
  ['/blog/pagination-seo', 'Pagination & SEO After rel=next'],
  ['/search?q=backlinks', 'Search results'],
  ['/blog/link-reclamation', 'Link Reclamation: Recover Lost Backlinks'],
  ['/integrations/slack', 'Slack Integration'],
  ['/blog/topical-authority', 'Building Topical Authority, Step by Step'],
  ['/webinars/indexing-masterclass', 'Indexing Masterclass — On Demand'],
  ['/blog/404-vs-410', '404 vs 410 for Removed Content'],
  ['/docs/changelog', 'Changelog · Northwind Docs'],
  ['/blog/seo-reporting-template', 'An SEO Reporting Template Clients Read'],
  ['/staging/new-homepage', 'New Homepage (staging)'],
  ['/blog/anchor-text-ratios', 'Anchor Text Ratios: Data From 40k Links'],
  ['/features/backlink-monitor', 'Backlink Monitor — Features'],
  ['/blog/image-seo', 'Image SEO Beyond Alt Text'],
  ['/docs/sdk/node', 'Node.js SDK · Northwind Docs'],
  ['/blog/faceted-navigation', 'Faceted Navigation Without Index Bloat'],
  ['/old-pricing', 'Pricing (legacy)'],
  ['/blog/google-search-console-tips', '17 Search Console Tips for Power Users'],
  ['/partners', 'Partner Program'],
  ['/blog/redirect-chains', 'Redirect Chains and How to Untangle Them'],
  ['/docs/errors', 'Error Codes · Northwind Docs'],
  ['/blog/content-pruning', 'Content Pruning: What to Cut and Why'],
  ['/events/seo-summit-2026', 'SEO Summit 2026'],
  ['/blog/serp-features', 'Winning SERP Features in 2026'],
]

// Hand-tuned status distribution: mostly indexed, with a realistic long tail.
const forced: Record<string, Partial<UrlRecord>> = {
  '/blog/how-to-do-seo': { status: 'indexed', backlinks: 8, internalLinks: 14, externalLinks: 3, wordCount: 3420 },
  '/tag/link-building?page=4': { status: 'crawled', indexable: true, canonical: 'other', canonicalTarget: '/tag/link-building' },
  '/search?q=backlinks': { status: 'blocked', robots: 'blocked', indexable: false, inSitemap: false },
  '/staging/new-homepage': { status: 'blocked', robots: 'noindex', indexable: false, inSitemap: false },
  '/old-pricing': { status: 'error', http: 404, indexable: false, inSitemap: true },
  '/blog/old-seo-tactics-2019': { status: 'crawled', wordCount: 640 },
  '/careers/senior-frontend-engineer': { status: 'discovered', lastCrawl: null },
  '/events/seo-summit-2026': { status: 'discovered', lastCrawl: null },
  '/blog/serp-features': { status: 'discovered', lastCrawl: null },
  '/docs/errors': { status: 'error', http: 500, indexable: false },
  '/blog/404-vs-410': { status: 'crawled' },
  '/blog/duplicate-content': { status: 'crawled', canonical: 'other', canonicalTarget: '/blog/canonical-tags' },
  '/webinars/indexing-masterclass': { status: 'discovered', lastCrawl: null },
  '/legal/privacy': { status: 'crawled' },
  '/blog/content-pruning': { status: 'discovered', lastCrawl: null },
  '/docs/changelog': { status: 'crawled', canonical: 'missing' },
}

function iso(daysAgo: number, hours: number) {
  const d = new Date('2026-10-02T09:14:00Z')
  d.setUTCDate(d.getUTCDate() - daysAgo)
  d.setUTCHours(hours, between(rng(daysAgo * 13 + hours), 0, 59))
  return d.toISOString()
}

export const urls: UrlRecord[] = paths.map(([path, title], i) => {
  const r = rng(i * 101 + 9)
  const base: UrlRecord = {
    id: `u${i + 1}`,
    path,
    domain: 'northwindlabs.com',
    title,
    status: 'indexed' as IndexStatus,
    http: 200,
    indexable: true,
    canonical: 'self',
    robots: 'allowed',
    inSitemap: true,
    lastCrawl: iso(between(r, 0, 19), between(r, 0, 23)),
    lastChecked: iso(0, between(r, 2, 8)),
    internalLinks: between(r, 4, 46),
    externalLinks: between(r, 0, 12),
    backlinks: Math.round(r() ** 2.4 * 140),
    wordCount: between(r, 900, 4200),
    loadTime: Math.round((0.6 + r() * 1.9) * 100) / 100,
    depth: between(r, 1, 4),
    clicks: Math.round(r() ** 2 * 4200),
    impressions: Math.round(r() ** 1.6 * 96000),
  }
  if (path.startsWith('/docs')) base.wordCount = between(r, 400, 1800)
  if (r() > 0.94 && !forced[path]) base.canonical = pick(r, ['missing', 'self'] as const)
  const rec = { ...base, ...forced[path] }
  if (rec.status !== 'indexed') {
    rec.clicks = 0
    rec.impressions = rec.status === 'crawled' ? between(r, 0, 40) : 0
  }
  return rec
})

export const getUrl = (id: string) => urls.find((u) => u.id === id)

export const statusMeta: Record<IndexStatus, { label: string; tone: 'success' | 'primary' | 'neutral' | 'warning' | 'error'; help: string }> = {
  indexed: { label: 'Indexed', tone: 'success', help: 'Google has indexed this URL and it can appear in search results.' },
  crawled: {
    label: 'Crawled – Not Indexed',
    tone: 'warning',
    help: 'Googlebot fetched the page but chose not to index it — usually a quality or duplication signal.',
  },
  discovered: {
    label: 'Discovered – Not Indexed',
    tone: 'neutral',
    help: 'Google knows the URL exists but has not crawled it yet. Often a crawl budget or internal linking issue.',
  },
  blocked: { label: 'Blocked', tone: 'neutral', help: 'Excluded by robots.txt or a noindex directive.' },
  error: { label: 'Error', tone: 'error', help: 'The server returned an error (4xx/5xx) when Google tried to fetch the URL.' },
}

/** Per-URL inspection history for the detail page. */
export function urlHistory(id: string) {
  const r = rng(id.length * 77 + id.charCodeAt(1))
  const events = [
    { date: '2026-10-02T03:12:00Z', title: 'Index status confirmed', detail: 'URL Inspection API returned “Submitted and indexed”.', tone: 'success' as const },
    { date: '2026-09-28T11:40:00Z', title: 'Content updated', detail: `Word count changed 3,180 → 3,420 (+${between(r, 180, 260)}). Title unchanged.`, tone: 'primary' as const },
    { date: '2026-09-28T14:02:00Z', title: 'Recrawled by Googlebot Smartphone', detail: 'Fetched in 412 ms · 200 OK · rendered HTML 184 KB.', tone: 'neutral' as const },
    { date: '2026-09-19T08:21:00Z', title: 'New backlink detected', detail: 'searchengineland.com linked with anchor “practical SEO playbook”.', tone: 'primary' as const },
    { date: '2026-09-04T02:31:00Z', title: 'Canonical mismatch resolved', detail: 'Declared and Google-selected canonical now match.', tone: 'success' as const },
    { date: '2026-08-30T02:31:00Z', title: 'Canonical mismatch detected', detail: 'Google selected /blog/how-to-do-seo/ (trailing slash) as canonical.', tone: 'warning' as const },
    { date: '2026-07-12T10:00:00Z', title: 'First indexed', detail: '2 days after first discovery via sitemap-blog.xml.', tone: 'success' as const },
  ]
  return events.sort((a, b) => b.date.localeCompare(a.date))
}
