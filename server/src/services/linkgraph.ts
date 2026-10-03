import type { Ctx } from '../context.js'
import { analyzeHtml, relOf, type PageAnalysis } from '../lib/html.js'
import { FetchError } from '../lib/fetcher.js'
import { rootDomain } from '../lib/url.js'
import { addBacklinks } from './backlinks.js'

/**
 * Our own link graph.
 *
 * Every external page we fetch anyway (backlink checks, comparisons, frontier probes)
 * has its outbound links recorded here. Common Crawl's domain graph (services/commoncrawl.ts)
 * adds domain-level edges for the domains our customers care about. Together they give
 * referring-domain counts, free backlink discovery and competitor gaps without a paid index.
 */

/** Links per page we keep. Link farms and huge footers add noise, not signal. */
const MAX_LINKS_PER_PAGE = 300

/** Platforms that link to everyone; useless as outreach targets. */
export const PLATFORMS = new Set([
  'google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com', 'pinterest.com',
  'reddit.com', 'wikipedia.org', 'wikimedia.org', 'github.com', 'medium.com', 'tumblr.com', 'blogspot.com', 'wordpress.com',
  'apple.com', 'microsoft.com', 'amazon.com', 'tiktok.com', 'whatsapp.com', 't.me', 'bit.ly', 'archive.org', 'yandex.ru',
  'bing.com', 'yahoo.com', 'baidu.com', 'cloudflare.com', 'w3.org', 'gravatar.com', 'feedburner.com', 'addthis.com', 'sharethis.com',
])

const domainOf = (u: string) => {
  try {
    const x = new URL(u)
    return x.protocol === 'http:' || x.protocol === 'https:' ? rootDomain(x.hostname) : null
  } catch {
    return null
  }
}

/**
 * Store a page's external links, replacing what we saw on it last time.
 * Also turns links to our customers' domains into discovered backlinks (verified before anyone sees them).
 */
export function recordPageLinks(ctx: Ctx, pageUrl: string, page: PageAnalysis, { requestedUrl }: { requestedUrl?: string } = {}) {
  const src = domainOf(pageUrl)
  if (!src) return { links: 0, discovered: 0 }
  const at = ctx.now().toISOString()
  const seen = new Map<string, { dst: string; anchor: string; rel: string }>()
  for (const l of page.links) {
    if (seen.size >= MAX_LINKS_PER_PAGE) break
    const dst = domainOf(l.href)
    if (!dst || dst === src || seen.has(l.href)) continue
    seen.set(l.href, { dst, anchor: l.anchor.slice(0, 200), rel: relOf(l, page.nofollowAll) })
  }

  ctx.db.tx(() => {
    ctx.db.run('DELETE FROM page_links WHERE src_url = ?', [pageUrl])
    for (const [href, l] of seen) {
      ctx.db.run('INSERT OR REPLACE INTO page_links (src_url, dst_url, src_domain, dst_domain, anchor, rel, seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [pageUrl, href, src, l.dst, l.anchor, l.rel, at])
    }
    for (const dst of new Set([...seen.values()].map((l) => l.dst))) {
      ctx.db.run(
        "INSERT INTO domain_links (dst_domain, src_domain, source, seen_at) VALUES (?, ?, 'crawl', ?) ON CONFLICT DO UPDATE SET seen_at = excluded.seen_at",
        [dst, src, at],
      )
    }
  })

  return { links: seen.size, discovered: discoverFromPage(ctx, pageUrl, requestedUrl, seen) }
}

/** A page that links to a customer's domain is a backlink they may not know about. */
function discoverFromPage(ctx: Ctx, pageUrl: string, requestedUrl: string | undefined, links: Map<string, { dst: string }>) {
  const dsts = [...new Set([...links.values()].map((l) => l.dst))]
  if (!dsts.length) return 0
  const projects = ctx.db.all<{ id: string; domain: string }>(
    `SELECT id, domain FROM projects WHERE paused = 0 AND domain IN (${dsts.map(() => '?').join(',')})`,
    dsts,
  )
  let n = 0
  for (const p of projects) {
    const known = ctx.db.get('SELECT 1 FROM backlinks WHERE project_id = ? AND source_url IN (?, ?)', [p.id, pageUrl, requestedUrl ?? pageUrl])
    if (known) continue
    const target = [...links.entries()].find(([, l]) => l.dst === p.domain)?.[0]
    n += addBacklinks(ctx, p.id, [{ sourceUrl: pageUrl, targetUrl: target }], 'discovery').created.length
  }
  return n
}

/** Fetch a page politely and record its links. Returns the analysis, or null when it couldn't be read. */
export async function crawlPage(ctx: Ctx, url: string) {
  try {
    const res = await ctx.fetcher.fetchPage(url)
    if (res.status < 200 || res.status >= 300 || !/html/i.test(res.contentType || 'text/html')) return null
    const page = analyzeHtml(res.body, res.finalUrl, res.headers)
    recordPageLinks(ctx, res.finalUrl, page, { requestedUrl: url })
    return { url: res.finalUrl, page }
  } catch (e) {
    if (e instanceof FetchError) return null
    return null
  }
}

/** Referring domains we know of for a host. Null when the graph has no data about it. */
export function refDomainsFor(ctx: Ctx, host: string): number | null {
  const d = rootDomain(host)
  const srcs = new Set(
    ctx.db
      .all<{ src_domain: string }>('SELECT DISTINCT src_domain FROM domain_links WHERE dst_domain = ? AND src_domain != ?', [d, d])
      .map((r) => r.src_domain),
  )
  // Verified backlinks of projects on this domain count too
  for (const r of ctx.db.all<{ source_domain: string }>(
    "SELECT DISTINCT b.source_domain FROM backlinks b JOIN projects p ON p.id = b.project_id WHERE p.domain = ? AND b.status = 'active'",
    [d],
  ))
    srcs.add(rootDomain(r.source_domain))
  srcs.delete(d)
  if (srcs.size) return srcs.size
  const covered = ctx.db.get<{ cc_release: string | null }>('SELECT cc_release FROM graph_domains WHERE domain = ?', [d])
  return covered?.cc_release ? 0 : null
}

/** Pages that look like they collect links: resource lists, partner pages, tools roundups. */
const LINKY = /(resource|link|tool|partner|useful|recommend|directory|best-|top-|kaynak|baglanti|bağlantı|arac|araç|onerilen|önerilen)/i

/**
 * Visit a domain to find the exact pages that link to the given targets.
 * Home page first, then up to `maxPages` of its internal pages that look like link lists.
 */
export async function probeDomain(ctx: Ctx, domain: string, { maxPages = 4 } = {}) {
  const home = await crawlPage(ctx, `https://${domain}/`)
  let pages = home ? 1 : 0
  if (home) {
    const candidates = [
      ...new Set(
        home.page.links
          .filter((l) => domainOf(l.href) === domain && LINKY.test(new URL(l.href).pathname + ' ' + l.anchor))
          .map((l) => l.href.split('#')[0]),
      ),
    ].slice(0, maxPages)
    for (const u of candidates) if (await crawlPage(ctx, u)) pages++
  }
  ctx.db.run('UPDATE crawl_frontier SET probed_at = ?, pages = ? WHERE domain = ?', [ctx.now().toISOString(), pages, domain])
  return pages
}

/** Probe a few queued domains (polite: the fetcher rate-limits per host and honours robots.txt). */
export async function sweepFrontier(ctx: Ctx, { limit = 15 } = {}) {
  const stale = new Date(ctx.now().getTime() - 30 * 86_400_000).toISOString()
  const due = ctx.db.all<{ domain: string }>('SELECT domain FROM crawl_frontier WHERE probed_at IS NULL OR probed_at < ? ORDER BY probed_at IS NOT NULL, created_at LIMIT ?', [stale, limit])
  let pages = 0
  for (const d of due) pages += await probeDomain(ctx, d.domain)
  return { probed: due.length, pages }
}

export function queueProbe(ctx: Ctx, domain: string, reason: string) {
  ctx.db.run('INSERT OR IGNORE INTO crawl_frontier (domain, reason, created_at) VALUES (?, ?, ?)', [domain, reason, ctx.now().toISOString()])
}

/** Competitor URLs that other sites link to: check whether they still work (dead ones = broken-link building). */
export async function checkLinkTargets(ctx: Ctx, { limit = 40 } = {}) {
  const comps = ctx.db.all<{ domain: string }>('SELECT DISTINCT domain FROM competitors').map((r) => r.domain)
  if (!comps.length) return { checked: 0 }
  const stale = new Date(ctx.now().getTime() - 30 * 86_400_000).toISOString()
  const due = ctx.db.all<{ dst_url: string }>(
    `SELECT DISTINCT pl.dst_url FROM page_links pl LEFT JOIN link_targets t ON t.url = pl.dst_url
      WHERE pl.dst_domain IN (${comps.map(() => '?').join(',')}) AND (t.url IS NULL OR t.checked_at < ?) LIMIT ?`,
    [...comps, stale, limit],
  )
  for (const { dst_url } of due) {
    let status: number | null = null
    try {
      status = (await ctx.fetcher.fetchPage(dst_url)).status
    } catch {
      status = null
    }
    ctx.db.run('INSERT OR REPLACE INTO link_targets (url, status, checked_at) VALUES (?, ?, ?)', [dst_url, status, ctx.now().toISOString()])
  }
  return { checked: due.length }
}
