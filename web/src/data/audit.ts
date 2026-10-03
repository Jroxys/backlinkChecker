import type { AuditCategory, AuditCheck } from '@/types'

export const auditCategories: AuditCategory[] = [
  { key: 'technical', name: 'Technical', score: 91, passed: 38, warnings: 3, errors: 1, description: 'Status codes, redirects, robots & crawlability' },
  { key: 'content', name: 'Content', score: 84, passed: 22, warnings: 6, errors: 2, description: 'Titles, meta descriptions, headings & duplication' },
  { key: 'performance', name: 'Performance', score: 78, passed: 14, warnings: 5, errors: 2, description: 'Core Web Vitals, payload size & caching' },
  { key: 'indexing', name: 'Indexing', score: 88, passed: 17, warnings: 2, errors: 1, description: 'Canonicals, sitemaps & index directives' },
  { key: 'links', name: 'Links', score: 93, passed: 26, warnings: 2, errors: 0, description: 'Internal linking, broken links & anchor quality' },
  { key: 'structured', name: 'Structured Data', score: 82, passed: 9, warnings: 2, errors: 1, description: 'Schema.org validity & rich result eligibility' },
]

export const auditChecks: AuditCheck[] = [
  { id: 'c1', title: 'Pages returning 5xx server errors', severity: 'error', affected: 1, category: 'technical', description: '/docs/errors returned 500 on the last two crawls.', fix: 'Check application logs for the docs renderer; return 200 or a deliberate 410.' },
  { id: 'c2', title: 'Redirect chains longer than 2 hops', severity: 'warning', affected: 6, category: 'technical', description: 'Legacy /resources/* URLs pass through 3 redirects before resolving.', fix: 'Point each legacy URL directly at its final destination.' },
  { id: 'c3', title: 'Duplicate title tags', severity: 'error', affected: 4, category: 'content', description: 'Paginated tag archives share the same <title> as page 1.', fix: 'Append “— Page N” to paginated titles or noindex deep pagination.' },
  { id: 'c4', title: 'Thin content (under 300 words)', severity: 'warning', affected: 9, category: 'content', description: 'Mostly tag archives and legacy changelog stubs.', fix: 'Consolidate, expand, or noindex pages that do not satisfy a search intent.' },
  { id: 'c5', title: 'Missing meta descriptions', severity: 'warning', affected: 14, category: 'content', description: 'Google will auto-generate snippets for these pages.', fix: 'Write 140–160 character descriptions for high-impression pages first.' },
  { id: 'c6', title: 'Largest Contentful Paint above 2.5s', severity: 'error', affected: 7, category: 'performance', description: 'Hero images on /customers/* are served unoptimised (avg 1.8 MB).', fix: 'Serve AVIF/WebP, add width/height and fetchpriority="high" to the LCP image.' },
  { id: 'c7', title: 'Render-blocking third-party scripts', severity: 'warning', affected: 31, category: 'performance', description: 'Chat widget and A/B testing snippet load synchronously in <head>.', fix: 'Defer or load after interaction.' },
  { id: 'c8', title: 'Canonical points to a non-200 URL', severity: 'error', affected: 2, category: 'indexing', description: 'Two blog posts canonicalise to URLs that now redirect.', fix: 'Update canonicals to the final destination URL.' },
  { id: 'c9', title: 'URLs in sitemap that are not indexable', severity: 'warning', affected: 3, category: 'indexing', description: 'sitemap-pages.xml lists /old-pricing (404) and 2 noindexed URLs.', fix: 'Remove non-canonical, non-200 and noindexed URLs from sitemaps.' },
  { id: 'c10', title: 'Orphan pages (no internal links)', severity: 'warning', affected: 5, category: 'links', description: 'Found only via sitemap; no crawl path from the homepage.', fix: 'Link from relevant hub pages or the docs sidebar.' },
  { id: 'c11', title: 'Invalid Article schema', severity: 'error', affected: 3, category: 'structured', description: '“datePublished” is not ISO 8601 on 3 posts.', fix: 'Output dates as 2026-09-28T10:00:00Z.' },
  { id: 'c12', title: 'HTTPS everywhere', severity: 'passed', affected: 0, category: 'technical', description: 'All 1,525 URLs serve over HTTPS with valid HSTS.', fix: '' },
  { id: 'c13', title: 'robots.txt reachable and valid', severity: 'passed', affected: 0, category: 'technical', description: 'Fetched in 84 ms; 4 directives; sitemap declared.', fix: '' },
  { id: 'c14', title: 'Single H1 per page', severity: 'passed', affected: 0, category: 'content', description: 'Every indexable page has exactly one H1.', fix: '' },
  { id: 'c15', title: 'Mobile viewport configured', severity: 'passed', affected: 0, category: 'performance', description: 'All templates declare a responsive viewport.', fix: '' },
  { id: 'c16', title: 'hreflang reciprocity', severity: 'passed', affected: 0, category: 'indexing', description: 'All 38 alternate pairs confirm each other.', fix: '' },
]

export const scoreHistory = [
  { date: 'May', score: 71 },
  { date: 'Jun', score: 74 },
  { date: 'Jul', score: 73 },
  { date: 'Aug', score: 79 },
  { date: 'Sep', score: 83 },
  { date: 'Oct', score: 87 },
]

export const vitals = [
  { name: 'LCP', value: '2.1s', target: '≤ 2.5s', good: 82 },
  { name: 'INP', value: '168ms', target: '≤ 200ms', good: 89 },
  { name: 'CLS', value: '0.04', target: '≤ 0.1', good: 94 },
]
