import type { Db } from '../db/index.js'

export type Category = 'technical' | 'content' | 'performance' | 'indexing' | 'links'
export type Severity = 'error' | 'warning' | 'notice'

export interface AuditCheck {
  id: string
  title: string
  category: Category
  severity: Severity
  affected: number
  samples: { id: string; url: string }[]
  description: string
  fix: string
}

interface Rule {
  id: string
  title: string
  category: Category
  severity: Severity
  /** SQL WHERE clause over monitored_urls (alias m) */
  where?: string
  /** Custom query returning (id, url) rows */
  query?: string
  description: string
  fix: string
  /** Weight in the score: how much this issue hurts when it affects every URL */
  weight: number
}

/**
 * Rule-based audit over what we already crawl. Every rule is explainable and
 * links to the exact URLs it affects — no black-box score.
 */
const rules: Rule[] = [
  { id: 'server_errors', title: 'Pages returning server errors (5xx)', category: 'technical', severity: 'error', where: 'm.http_status >= 500', description: 'Google retries 5xx pages for a while, then drops them from the index.', fix: 'Check your server logs for these URLs. Fix the error, or return 410 if the page is gone on purpose.', weight: 30 },
  { id: 'not_found', title: 'Pages returning 404 / 410', category: 'technical', severity: 'error', where: 'm.http_status IN (404, 410)', description: 'Monitored URLs that no longer exist. If they are linked internally or from other sites, that equity is wasted.', fix: 'Redirect (301) to the closest live page, or remove the URL from sitemaps and internal links.', weight: 20 },
  { id: 'client_errors', title: 'Pages returning other 4xx errors', category: 'technical', severity: 'error', where: 'm.http_status >= 400 AND m.http_status < 500 AND m.http_status NOT IN (404, 410)', description: 'Pages answering 401/403/429 etc. Googlebot can’t see their content.', fix: 'Make sure these pages are public and not rate-limiting or blocking crawlers.', weight: 20 },
  { id: 'redirects', title: 'Monitored URLs that redirect', category: 'technical', severity: 'warning', where: 'm.http_status >= 300 AND m.http_status < 400', description: 'Redirected URLs can’t be indexed themselves. Fine for old URLs, wasteful when they’re in sitemaps or internal links.', fix: 'Update sitemaps and internal links to point to the final URL.', weight: 6 },
  { id: 'robots_blocked', title: 'Blocked by robots.txt for Googlebot', category: 'indexing', severity: 'error', where: "m.robots = 'blocked'", description: 'Googlebot is not allowed to crawl these URLs, so their content can’t be indexed.', fix: 'Remove the matching Disallow rule if these pages should rank. Use noindex instead if you want them out of search.', weight: 25 },
  { id: 'noindex', title: 'Pages with a noindex directive', category: 'indexing', severity: 'warning', where: "m.robots = 'noindex'", description: 'A meta robots or X-Robots-Tag noindex tells Google to keep these pages out of search.', fix: 'Confirm each one is intentional. A leftover noindex from staging is one of the most common causes of lost traffic.', weight: 15 },
  { id: 'sitemap_non_indexable', title: 'Non-indexable URLs listed in sitemaps', category: 'indexing', severity: 'warning', where: 'm.in_sitemap = 1 AND m.indexable = 0', description: 'Sitemaps should only list canonical, indexable 200 URLs. Mixed signals waste crawl budget.', fix: 'Remove redirected, noindexed, broken and canonicalised URLs from your sitemaps.', weight: 8 },
  { id: 'canonical_other', title: 'Canonical points to another URL', category: 'indexing', severity: 'warning', where: "m.canonical = 'other' AND m.http_status = 200", description: 'These pages tell Google that a different URL is the main version, so they won’t be indexed themselves.', fix: 'Expected for duplicates and parameter URLs. If a page should rank on its own, make its canonical self-referencing.', weight: 5 },
  { id: 'canonical_missing', title: 'Missing canonical tag', category: 'indexing', severity: 'notice', where: "m.canonical = 'missing' AND m.http_status = 200", description: 'Without a canonical, Google picks one itself — usually fine, but parameters and tracking codes can create duplicates.', fix: 'Add <link rel="canonical" href="…"> pointing to the page’s own clean URL.', weight: 2 },
  { id: 'google_crawled_not_indexed', title: 'Crawled by Google but not indexed', category: 'indexing', severity: 'warning', where: "m.index_status = 'crawled'", description: 'Google fetched these pages and decided not to index them — usually a quality or duplication signal.', fix: 'Strengthen unique content, merge near-duplicates, and link to these pages from relevant indexed pages.', weight: 10 },
  { id: 'google_discovered', title: 'Discovered but not yet crawled', category: 'indexing', severity: 'notice', where: "m.index_status = 'discovered'", description: 'Google knows these URLs but hasn’t crawled them. Common for new pages; persistent cases point to weak internal linking.', fix: 'Link to these pages from your homepage, hubs or recent posts.', weight: 4 },
  { id: 'google_errors', title: 'Google reports errors for these URLs', category: 'indexing', severity: 'error', where: "m.index_status = 'error'", description: 'Search Console reports a fetch error (404, 5xx, soft 404 or redirect error).', fix: 'Open the URL in Search Console’s URL Inspection to see the exact error, fix it, then validate the fix.', weight: 15 },
  { id: 'missing_title', title: 'Missing <title>', category: 'content', severity: 'error', where: "m.http_status = 200 AND (m.title IS NULL OR m.title = '')", description: 'Titles are the strongest on-page relevance signal and the clickable line in search results.', fix: 'Give every indexable page a unique, descriptive title of roughly 50–60 characters.', weight: 8 },
  {
    id: 'duplicate_title',
    title: 'Duplicate titles',
    category: 'content',
    severity: 'warning',
    query: `SELECT m.id, m.url FROM monitored_urls m
            JOIN (SELECT title FROM monitored_urls WHERE project_id = :p AND http_status = 200 AND indexable = 1 AND title IS NOT NULL AND title != ''
                  GROUP BY title HAVING COUNT(*) > 1) d ON d.title = m.title
            WHERE m.project_id = :p AND m.indexable = 1`,
    description: 'Several indexable pages share the same title, so Google can’t tell which one answers a query.',
    fix: 'Make each title specific to its page. For paginated archives append “– Page N”.',
    weight: 6,
  },
  { id: 'thin_content', title: 'Thin content (under 300 words)', category: 'content', severity: 'warning', where: 'm.http_status = 200 AND m.indexable = 1 AND m.word_count IS NOT NULL AND m.word_count < 300', description: 'Very short indexable pages often end up “Crawled – not indexed”.', fix: 'Expand pages that target a search intent; merge or noindex pages that don’t.', weight: 6 },
  { id: 'slow_pages', title: 'Slow server response (over 2.5s)', category: 'performance', severity: 'warning', where: 'm.load_ms > 2500', description: 'Measured from our crawler: the time to download the HTML. Slow responses reduce crawl rate and hurt users.', fix: 'Add caching (CDN or full-page cache), and check slow database queries on these templates.', weight: 6 },
  {
    id: 'lost_dofollow',
    title: 'Lost dofollow backlinks (30 days)',
    category: 'links',
    severity: 'error',
    query: `SELECT id, source_url AS url FROM backlinks WHERE project_id = :p AND status IN ('lost','broken') AND rel = 'dofollow' AND last_seen >= :since`,
    description: 'Links that passed full equity and disappeared in the last 30 days.',
    fix: 'Contact the site owner: links removed during a page update are often restored on request.',
    weight: 10,
  },
  {
    id: 'linking_page_noindex',
    title: 'Backlinks on noindexed pages',
    category: 'links',
    severity: 'notice',
    query: `SELECT id, source_url AS url FROM backlinks WHERE project_id = :p AND status = 'active' AND page_noindex = 1`,
    description: 'The linking page asks Google not to index it; such links typically carry little weight.',
    fix: 'Nothing to fix on your side — but don’t count these when reporting link growth.',
    weight: 1,
  },
]

const categoryMeta: Record<Category, { name: string; description: string }> = {
  technical: { name: 'Technical', description: 'Status codes and redirects' },
  indexing: { name: 'Indexing', description: 'robots.txt, noindex, canonicals, sitemaps and Google’s verdict' },
  content: { name: 'Content', description: 'Titles and thin pages' },
  performance: { name: 'Performance', description: 'Server response time' },
  links: { name: 'Links', description: 'Health of your backlink profile' },
}

export function runAudit(db: Db, projectId: string, nowIso = new Date().toISOString()) {
  const since = new Date(new Date(nowIso).getTime() - 30 * 86_400_000).toISOString()
  const total = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM monitored_urls WHERE project_id = ? AND last_checked_at IS NOT NULL', [projectId])!.n
  const totalLinks = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM backlinks WHERE project_id = ? AND status != 'pending'", [projectId])!.n
  const checks: AuditCheck[] = rules.map((r) => {
    const sql = r.query ?? `SELECT m.id, m.url FROM monitored_urls m WHERE m.project_id = :p AND m.last_checked_at IS NOT NULL AND (${r.where})`
    const rows = db.all<{ id: string; url: string }>(sql, { p: projectId, since })
    return { id: r.id, title: r.title, category: r.category, severity: r.severity, affected: rows.length, samples: rows.slice(0, 20), description: r.description, fix: r.fix }
  })

  // Score: start at 100, subtract each rule's weight scaled by the share of URLs (or links) it affects.
  let penalty = 0
  for (const r of rules) {
    const c = checks.find((x) => x.id === r.id)!
    const base = r.category === 'links' ? Math.max(1, totalLinks) : Math.max(1, total)
    penalty += r.weight * Math.min(1, c.affected / base) * (c.affected ? 1 : 0)
  }
  const score = total ? Math.max(0, Math.round(100 - penalty)) : null

  const categories = (Object.keys(categoryMeta) as Category[]).map((k) => {
    const cs = checks.filter((c) => c.category === k)
    const catPenalty = rules.filter((r) => r.category === k).reduce((a, r) => {
      const c = checks.find((x) => x.id === r.id)!
      const base = k === 'links' ? Math.max(1, totalLinks) : Math.max(1, total)
      return a + r.weight * Math.min(1, c.affected / base)
    }, 0)
    const maxPenalty = rules.filter((r) => r.category === k).reduce((a, r) => a + r.weight, 0)
    return {
      key: k,
      ...categoryMeta[k],
      score: Math.round(100 - (catPenalty / maxPenalty) * 100),
      passed: cs.filter((c) => c.affected === 0).length,
      warnings: cs.filter((c) => c.affected > 0 && c.severity !== 'error').length,
      errors: cs.filter((c) => c.affected > 0 && c.severity === 'error').length,
    }
  })

  return { score, urlsChecked: total, linksChecked: totalLinks, categories, checks }
}
