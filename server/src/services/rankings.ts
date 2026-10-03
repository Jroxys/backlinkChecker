import type { Ctx } from '../context.js'
import { enqueue } from '../jobs/queue.js'
import { FetchError } from '../lib/fetcher.js'
import { id } from '../lib/ids.js'
import { analyzeHtml } from '../lib/html.js'
import { comparePages, fold, pageFacts, todo, type ComparisonCheck } from '../lib/onpage.js'
import { rootDomain } from '../lib/url.js'
import { getPlan } from '../plans.js'
import { accessTokenFor } from './google.js'
import { recordPageLinks, refDomainsFor } from './linkgraph.js'

const DAY = 86_400_000
const day = (d: Date) => d.toISOString().slice(0, 10)
const normalize = (k: string) => k.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr').slice(0, 200)
const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export class RankingError extends Error {
  constructor(
    readonly code: 'plan_limit' | 'not_found' | 'no_competitor' | 'fetch_failed' | 'serp_unavailable',
    message: string,
  ) {
    super(message)
  }
}

interface Project {
  id: string
  domain: string
  user_id: string
  plan: string
  gsc_property: string | null
  serp_location: string
  serp_language: string
}
const projectOf = (ctx: Ctx, projectId: string) =>
  ctx.db.get<Project>(
    'SELECT p.id, p.domain, p.user_id, u.plan, p.gsc_property, p.serp_location, p.serp_language FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = ?',
    [projectId],
  )

export function addKeywords(ctx: Ctx, projectId: string, raw: string[]) {
  const p = projectOf(ctx, projectId)
  if (!p) throw new RankingError('not_found', 'Project not found')
  const limit = getPlan(p.plan).limits.trackedKeywords
  const used = ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM tracked_keywords WHERE project_id = ?', [p.id])!.n
  const created: string[] = []
  const skipped: { keyword: string; reason: string }[] = []
  for (const k of [...new Set(raw.map(normalize).filter((k) => k.length >= 2))]) {
    if (used + created.length >= limit) {
      skipped.push({ keyword: k, reason: 'plan_limit' })
      continue
    }
    const kid = id('kw')
    const r = ctx.db.run('INSERT OR IGNORE INTO tracked_keywords (id, project_id, keyword, created_at) VALUES (?, ?, ?, ?)', [kid, p.id, k, ctx.now().toISOString()])
    if (r.changes) created.push(kid)
    else skipped.push({ keyword: k, reason: 'duplicate' })
  }
  // Backfill 90 days from Search Console so the chart isn't empty on day one; refresh live results if available
  if (created.length) enqueue(ctx.db, 'rankings.sync', { projectId: p.id, days: 90 }, { dedupeKey: `rankings:${p.id}` })
  return { created, skipped }
}

/**
 * Daily positions from Search Console (average position per query and day — what Google itself
 * reports, free and without scraping). Search Console data lags ~2–3 days.
 */
export async function syncGscPositions(ctx: Ctx, projectId: string, days = 10) {
  const p = projectOf(ctx, projectId)
  if (!p?.gsc_property || !ctx.google.configured) return { synced: 0 }
  const token = await accessTokenFor(ctx.db, ctx.google, p.user_id)
  if (!token) return { synced: 0 }
  const kws = ctx.db.all<{ id: string; keyword: string }>('SELECT id, keyword FROM tracked_keywords WHERE project_id = ?', [p.id])
  if (!kws.length) return { synced: 0 }
  const byKeyword = new Map(kws.map((k) => [k.keyword, k.id]))
  const end = new Date(ctx.now().getTime() - 2 * DAY)
  const start = new Date(end.getTime() - (days - 1) * DAY)
  const recentStart = new Date(end.getTime() - 27 * DAY)

  // Batch keywords into regex filters that stay well under the API's expression limit
  const batches: string[][] = [[]]
  for (const k of kws.map((k) => k.keyword)) {
    const cur = batches[batches.length - 1]
    if (cur.join('|').length + k.length > 3000) batches.push([])
    batches[batches.length - 1].push(k)
  }
  let synced = 0
  for (const batch of batches) {
    const filters = [{ dimension: 'query' as const, operator: 'includingRegex' as const, expression: `^(${batch.map(reEscape).join('|')})$` }]
    const [daily, pages] = await Promise.all([
      ctx.google.searchAnalytics(token, p.gsc_property, { startDate: day(start), endDate: day(end), dimensions: ['date', 'query'], rowLimit: 25000, filters }),
      ctx.google.searchAnalytics(token, p.gsc_property, { startDate: day(recentStart), endDate: day(end), dimensions: ['query', 'page'], rowLimit: 25000, filters }),
    ])
    ctx.db.tx(() => {
      for (const r of daily) {
        const kid = byKeyword.get(normalize(r.keys[1] ?? ''))
        if (!kid) continue
        ctx.db.run(
          `INSERT INTO keyword_positions (keyword_id, date, source, position, clicks, impressions) VALUES (?, ?, 'gsc', ?, ?, ?)
           ON CONFLICT(keyword_id, date, source) DO UPDATE SET position = excluded.position, clicks = excluded.clicks, impressions = excluded.impressions`,
          [kid, r.keys[0], Math.round(r.position * 10) / 10, r.clicks, r.impressions],
        )
        synced++
      }
      const best = new Map<string, { page: string; clicks: number; impressions: number }>()
      for (const r of pages) {
        const k = normalize(r.keys[0] ?? '')
        const cur = best.get(k)
        if (!cur || r.clicks > cur.clicks || (r.clicks === cur.clicks && r.impressions > cur.impressions)) best.set(k, { page: r.keys[1], clicks: r.clicks, impressions: r.impressions })
      }
      for (const [k, v] of best) {
        const kid = byKeyword.get(k)
        if (kid) ctx.db.run('UPDATE tracked_keywords SET best_page = ? WHERE id = ?', [v.page, kid])
      }
    })
  }
  ctx.db.run('UPDATE projects SET rankings_synced_at = ? WHERE id = ?', [ctx.now().toISOString(), p.id])
  return { synced }
}

/** Live Google top 10 for one keyword, and where the project's domain sits in it. */
export async function refreshSerp(ctx: Ctx, keywordId: string) {
  if (!ctx.serp) throw new RankingError('serp_unavailable', 'Live Google results aren’t configured on this server')
  const k = ctx.db.get<{ id: string; keyword: string; project_id: string }>('SELECT id, keyword, project_id FROM tracked_keywords WHERE id = ?', [keywordId])
  if (!k) throw new RankingError('not_found', 'Keyword not found')
  const p = projectOf(ctx, k.project_id)!
  const results = await ctx.serp.search(k.keyword, { locationName: p.serp_location, languageCode: p.serp_language })
  const nowIso = ctx.now().toISOString()
  const ours = results.find((r) => rootDomain(r.domain) === rootDomain(p.domain))
  ctx.db.tx(() => {
    ctx.db.run('INSERT INTO serp_snapshots (id, keyword_id, fetched_at, results) VALUES (?, ?, ?, ?)', [id('serp'), k.id, nowIso, JSON.stringify(results)])
    ctx.db.run('UPDATE tracked_keywords SET serp_checked_at = ? WHERE id = ?', [nowIso, k.id])
    ctx.db.run(
      `INSERT INTO keyword_positions (keyword_id, date, source, position, page) VALUES (?, ?, 'serp', ?, ?)
       ON CONFLICT(keyword_id, date, source) DO UPDATE SET position = excluded.position, page = excluded.page`,
      [k.id, day(ctx.now()), ours?.position ?? null, ours?.url ?? null],
    )
  })
  return { results, position: ours?.position ?? null }
}

/** Every 6 hours: Search Console positions once a day per project; live results when due by plan. */
export async function sweepRankings(ctx: Ctx, { serpBudget = 50 } = {}) {
  const projects = ctx.db.all<{ id: string; plan: string; rankings_synced_at: string | null }>(
    `SELECT p.id, u.plan, p.rankings_synced_at FROM projects p JOIN users u ON u.id = p.user_id
      WHERE p.paused = 0 AND EXISTS (SELECT 1 FROM tracked_keywords k WHERE k.project_id = p.id)`,
  )
  let gsc = 0
  let serp = 0
  for (const p of projects) {
    if (!p.rankings_synced_at || ctx.now().getTime() - new Date(p.rankings_synced_at).getTime() > 20 * 3_600_000) {
      await syncGscPositions(ctx, p.id).catch((e) => console.error('[rankings] gsc', p.id, e))
      gsc++
    }
    const every = getPlan(p.plan).limits.serpRefreshDays
    if (!ctx.serp || !every) continue
    const due = ctx.db.all<{ id: string }>('SELECT id FROM tracked_keywords WHERE project_id = ? AND (serp_checked_at IS NULL OR serp_checked_at < ?) ORDER BY serp_checked_at LIMIT ?', [
      p.id,
      new Date(ctx.now().getTime() - every * DAY + 3_600_000).toISOString(),
      Math.max(0, serpBudget - serp),
    ])
    for (const k of due) {
      await refreshSerp(ctx, k.id).catch((e) => console.error('[rankings] serp', k.id, e))
      serp++
    }
  }
  return { gsc, serp }
}

/**
 * Compare the user's page with a competitor's for one keyword. Our page is fetched as the
 * site owner; theirs as a polite crawler that respects their robots.txt.
 */
export async function comparePage(ctx: Ctx, projectId: string, input: { keyword: string; keywordId?: string | null; myUrl?: string | null; theirUrl?: string | null }) {
  const p = projectOf(ctx, projectId)
  if (!p) throw new RankingError('not_found', 'Project not found')
  const today = day(ctx.now())
  const used = ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM comparisons WHERE project_id = ? AND substr(created_at, 1, 10) = ?", [p.id, today])!.n
  const limit = getPlan(p.plan).limits.comparisonsPerDay
  if (used >= limit) throw new RankingError('plan_limit', `Your plan includes ${limit} comparisons per day. Try again tomorrow or upgrade.`)

  const kw = input.keywordId ? ctx.db.get<{ id: string; keyword: string; best_page: string | null }>('SELECT id, keyword, best_page FROM tracked_keywords WHERE id = ? AND project_id = ?', [input.keywordId, p.id]) : undefined
  const keyword = kw?.keyword ?? normalize(input.keyword)
  const latest = kw ? ctx.db.get<{ results: string }>('SELECT results FROM serp_snapshots WHERE keyword_id = ? ORDER BY fetched_at DESC LIMIT 1', [kw.id]) : undefined
  const serpTop = latest ? (JSON.parse(latest.results) as { url: string; domain: string }[]).find((r) => rootDomain(r.domain) !== rootDomain(p.domain)) : undefined
  const myUrl = input.myUrl || kw?.best_page || `https://${p.domain}/`
  const theirUrl = input.theirUrl || serpTop?.url
  if (!theirUrl) throw new RankingError('no_competitor', 'Enter the URL of the page that ranks above you (search the keyword in Google and copy the top result).')

  const fetchFacts = async (url: string, ownSite: boolean) => {
    try {
      const r = await ctx.fetcher.fetchPage(url, { ownSite })
      if (r.status >= 400) throw new RankingError('fetch_failed', `${url} answered HTTP ${r.status}`)
      if (!ownSite) recordPageLinks(ctx, r.finalUrl, analyzeHtml(r.body, r.finalUrl, r.headers))
      return pageFacts(r.body, r.finalUrl, r.timeMs)
    } catch (e) {
      if (e instanceof RankingError) throw e
      const why = e instanceof FetchError && e.code === 'robots' ? 'its robots.txt doesn’t allow our crawler' : (e as Error).message
      throw new RankingError('fetch_failed', `Couldn’t read ${url}: ${why}`)
    }
  }
  const [mine, theirs] = await Promise.all([fetchFacts(myUrl, true), fetchFacts(theirUrl, false)])
  const checks: ComparisonCheck[] = comparePages(keyword, mine, theirs, {
    myRefDomains: refDomainsFor(ctx, new URL(mine.url).hostname),
    theirRefDomains: refDomainsFor(ctx, new URL(theirs.url).hostname),
  })
  const strip = ({ text: _t, ...f }: typeof mine) => f
  const result = { keyword, mine: strip(mine), theirs: strip(theirs), checks, todo: todo(checks) }
  const cid = id('cmp')
  ctx.db.run('INSERT INTO comparisons (id, project_id, keyword_id, keyword, my_url, their_url, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    cid,
    p.id,
    kw?.id ?? null,
    keyword,
    mine.url,
    theirs.url,
    JSON.stringify(result),
    ctx.now().toISOString(),
  ])
  return { id: cid, ...result }
}

/** Queries from the cached Search Console report that aren't tracked yet, most impressions first. */
export function keywordSuggestions(ctx: Ctx, projectId: string) {
  const cached = ctx.db.get<{ body: string }>("SELECT body FROM gsc_cache WHERE project_id = ? AND key = 'queries:28d'", [projectId])
  if (!cached) return []
  const tracked = new Set(ctx.db.all<{ keyword: string }>('SELECT keyword FROM tracked_keywords WHERE project_id = ?', [projectId]).map((k) => k.keyword))
  return ((JSON.parse(cached.body) as { rows?: { query: string; impressions: number; position: number; clicks: number }[] }).rows ?? [])
    .filter((r) => !tracked.has(normalize(r.query)))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 25)
    .map((r) => ({ keyword: r.query, impressions: r.impressions, clicks: r.clicks, position: r.position }))
}

export { fold }
