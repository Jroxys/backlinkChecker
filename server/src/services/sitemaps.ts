import * as cheerio from 'cheerio'
import type { Ctx } from '../context.js'
import { id } from '../lib/ids.js'
import { createAlert, plural } from './alerts.js'
import { addUrls } from './urls.js'
import { selectPriorityPages } from './watch.js'

const MAX_CHILD_SITEMAPS = 50
const MAX_URLS = 50_000

/** Parse a sitemap or sitemap index. Returns child sitemaps and page URLs. */
export function parseSitemap(xml: string) {
  const $ = cheerio.load(xml, { xml: true })
  const children = $('sitemapindex > sitemap > loc').map((_, el) => $(el).text().trim()).get()
  const urls = $('urlset > url > loc').map((_, el) => $(el).text().trim()).get()
  return { children: children.filter(Boolean), urls: urls.filter(Boolean) }
}

/** Find sitemaps for a domain: robots.txt Sitemap: lines, else /sitemap.xml. */
export async function discoverSitemaps(ctx: Ctx, projectId: string) {
  const p = ctx.db.get<{ domain: string }>('SELECT domain FROM projects WHERE id = ?', [projectId])
  if (!p) return []
  const origin = new URL(`https://${p.domain}/`)
  let found = await ctx.fetcher.sitemapsFromRobots(origin).catch(() => [])
  if (!found.length) found = [new URL('/sitemap.xml', origin).href]
  const at = ctx.now().toISOString()
  for (const url of found.slice(0, 20)) ctx.db.run('INSERT OR IGNORE INTO sitemaps (id, project_id, url, created_at) VALUES (?, ?, ?, ?)', [id('sm'), projectId, url, at])
  return found
}

/** Fetch a sitemap (recursively for indexes) and enroll its URLs into monitoring. */
export async function syncSitemap(ctx: Ctx, sitemapId: string) {
  const sm = ctx.db.get<{ id: string; project_id: string; url: string; last_fetched_at: string | null }>('SELECT * FROM sitemaps WHERE id = ?', [sitemapId])
  if (!sm) return { added: 0 }
  const at = ctx.now().toISOString()
  const pageUrls: string[] = []
  const queue = [sm.url]
  const seen = new Set<string>()
  let error: string | null = null
  try {
    while (queue.length && seen.size < MAX_CHILD_SITEMAPS && pageUrls.length < MAX_URLS) {
      const next = queue.shift()!
      if (seen.has(next)) continue
      seen.add(next)
      const res = await ctx.fetcher.fetchPage(next, { accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5', ownSite: true })
      if (res.status !== 200) throw new Error(`${next} returned HTTP ${res.status}`)
      const parsed = parseSitemap(res.body)
      queue.push(...parsed.children)
      pageUrls.push(...parsed.urls)
    }
  } catch (e) {
    error = (e as Error).message
  }

  if (error && !pageUrls.length) {
    ctx.db.run("UPDATE sitemaps SET status = 'error', last_error = ?, last_fetched_at = ? WHERE id = ?", [error, at, sm.id])
    const p = ctx.db.get<{ user_id: string }>('SELECT user_id FROM projects WHERE id = ?', [sm.project_id])
    if (p && sm.last_fetched_at)
      createAlert(ctx, { userId: p.user_id, projectId: sm.project_id, kind: 'sitemap', severity: 'warning', title: 'Sitemap could not be read', body: `${sm.url}: ${error}`, href: '/app/indexing' })
    return { added: 0, error }
  }

  const { created, skipped } = addUrls(ctx, sm.project_id, pageUrls, 'sitemap')
  if (created.length) selectPriorityPages(ctx, sm.project_id)
  ctx.db.run("UPDATE sitemaps SET status = 'ok', last_error = NULL, url_count = ?, last_fetched_at = ? WHERE id = ?", [pageUrls.length, at, sm.id])
  const limited = skipped.filter((s) => s.reason === 'plan_limit').length
  const p = ctx.db.get<{ user_id: string }>('SELECT user_id FROM projects WHERE id = ?', [sm.project_id])
  if (p && sm.last_fetched_at && created.length)
    createAlert(ctx, {
      userId: p.user_id,
      projectId: sm.project_id,
      kind: 'sitemap',
      severity: 'info',
      title: `${plural(created.length, 'new URL')} detected`,
      body: `${new URL(sm.url).pathname} added ${plural(created.length, 'URL')} since the last read. They are now monitored.`,
      href: '/app/indexing',
    })
  if (p && limited)
    createAlert(ctx, {
      userId: p.user_id,
      projectId: sm.project_id,
      kind: 'sitemap',
      severity: 'warning',
      title: `${plural(limited, 'URL')} not monitored — plan limit reached`,
      body: 'Your sitemap lists more URLs than your plan covers. Upgrade or remove URLs you don’t need to watch.',
      href: '/app/settings?tab=billing',
    })
  return { added: created.length, total: pageUrls.length, limited }
}
