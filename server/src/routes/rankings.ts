import { z } from 'zod'
import { ApiError, body, notFound, ownedProject, requireUser, router, type C } from '../http.js'
import { getPlan } from '../plans.js'
import { keywordsFor } from '../services/keywords.js'
import { addKeywords, comparePage, keywordSuggestions, RankingError, refreshSerp } from '../services/rankings.js'

/** Rank tracking (Search Console positions, optional live SERP) and page-vs-competitor comparison. */
export const rankingRoutes = router()
rankingRoutes.use('/projects/:id/rankings', requireUser)
rankingRoutes.use('/projects/:id/rankings/*', requireUser)
rankingRoutes.use('/projects/:id/compare', requireUser)
rankingRoutes.use('/keywords/*', requireUser)

const fail = (e: unknown): never => {
  if (e instanceof RankingError) throw new ApiError(e.code === 'plan_limit' ? 402 : e.code === 'not_found' ? 404 : e.code === 'serp_unavailable' ? 503 : 422, e.code, e.message)
  throw e
}

function ownedKeyword(c: C, keywordId: string) {
  const k = c.var.ctx.db.get<{ id: string; project_id: string; keyword: string; best_page: string | null; serp_checked_at: string | null; created_at: string }>(
    'SELECT k.* FROM tracked_keywords k JOIN projects p ON p.id = k.project_id WHERE k.id = ? AND p.user_id = ?',
    [keywordId, c.var.account.id],
  )
  if (!k) throw notFound('Keyword')
  return k
}

const latestSerp = (c: C, keywordId: string) => {
  const s = c.var.ctx.db.get<{ fetched_at: string; results: string }>('SELECT fetched_at, results FROM serp_snapshots WHERE keyword_id = ? ORDER BY fetched_at DESC LIMIT 1', [keywordId])
  return s ? { fetchedAt: s.fetched_at, results: JSON.parse(s.results) as { position: number; url: string; domain: string; title: string }[] } : null
}

rankingRoutes.get('/projects/:id/rankings', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const { db } = c.var.ctx
  const since = new Date(c.var.ctx.now().getTime() - 35 * 86_400_000).toISOString().slice(0, 10)
  const kws = db.all<{ id: string; keyword: string; best_page: string | null; serp_checked_at: string | null }>('SELECT id, keyword, best_page, serp_checked_at FROM tracked_keywords WHERE project_id = ? ORDER BY keyword', [p.id])
  const rows = db.all<{ keyword_id: string; date: string; source: string; position: number | null; clicks: number | null; impressions: number | null }>(
    `SELECT kp.* FROM keyword_positions kp JOIN tracked_keywords k ON k.id = kp.keyword_id WHERE k.project_id = ? AND kp.date >= ? ORDER BY kp.date`,
    [p.id, since],
  )
  const byKw = new Map<string, typeof rows>()
  for (const r of rows) byKw.set(r.keyword_id, [...(byKw.get(r.keyword_id) ?? []), r])
  const proj = db.get<{ serp_location: string; serp_language: string }>('SELECT serp_location, serp_language FROM projects WHERE id = ?', [p.id])!
  return c.json({
    keywords: kws.map((k) => {
      const all = byKw.get(k.id) ?? []
      // Prefer the live result when we have one for a day; otherwise Search Console's average
      const gsc = all.filter((r) => r.source === 'gsc' && r.position !== null)
      const serp = all.filter((r) => r.source === 'serp')
      const last = gsc.at(-1)
      // The latest data point at least a week before the newest one
      const cutoff = last ? new Date(new Date(last.date).getTime() - 7 * 86_400_000).toISOString().slice(0, 10) : ''
      const weekAgo = gsc.filter((r) => r.date <= cutoff).at(-1)
      const top = latestSerp(c, k.id)?.results.find((r) => !r.domain.endsWith(p.domain))
      return {
        id: k.id,
        keyword: k.keyword,
        position: serp.at(-1)?.position ?? last?.position ?? null,
        source: serp.at(-1) ? 'serp' : last ? 'gsc' : null,
        change7d: last && weekAgo && last.date !== weekAgo.date ? Math.round(((weekAgo.position ?? 0) - (last.position ?? 0)) * 10) / 10 : null,
        clicks30d: gsc.reduce((a, r) => a + (r.clicks ?? 0), 0),
        impressions30d: gsc.reduce((a, r) => a + (r.impressions ?? 0), 0),
        bestPage: k.best_page,
        trend: gsc.slice(-30).map((r) => r.position),
        topCompetitor: top ? { domain: top.domain, url: top.url, position: top.position } : null,
        serpCheckedAt: k.serp_checked_at,
      }
    }),
    limit: getPlan(c.var.account.plan).limits.trackedKeywords,
    gscConnected: !!p.gsc_property,
    serpConfigured: !!c.var.ctx.serp && !!getPlan(c.var.account.plan).limits.serpRefreshDays,
    location: { name: proj.serp_location, language: proj.serp_language },
  })
})

rankingRoutes.post('/projects/:id/rankings', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const { keywords } = await body(c, z.object({ keywords: z.array(z.string().max(200)).min(1).max(500) }))
  try {
    return c.json(addKeywords(c.var.ctx, p.id, keywords), 201)
  } catch (e) {
    return fail(e)
  }
})

rankingRoutes.get('/projects/:id/rankings/suggestions', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  // Warms the Search Console query cache the suggestions read from (no-op when fresh)
  await keywordsFor(c.var.ctx, p.id).catch(() => null)
  return c.json({ suggestions: keywordSuggestions(c.var.ctx, p.id) })
})

rankingRoutes.put('/projects/:id/rankings/settings', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const input = await body(c, z.object({ location: z.string().trim().min(2).max(80), language: z.string().trim().regex(/^[a-z]{2}(-[a-z]{2})?$/i) }))
  c.var.ctx.db.run('UPDATE projects SET serp_location = ?, serp_language = ? WHERE id = ?', [input.location, input.language.toLowerCase(), p.id])
  return c.json({ ok: true })
})

rankingRoutes.get('/keywords/:id', (c) => {
  const k = ownedKeyword(c, c.req.param('id'))
  const { db } = c.var.ctx
  const history = db.all<{ date: string; source: string; position: number | null; clicks: number | null; impressions: number | null; page: string | null }>(
    'SELECT date, source, position, clicks, impressions, page FROM keyword_positions WHERE keyword_id = ? ORDER BY date',
    [k.id],
  )
  const cmp = db.get<{ result: string; created_at: string }>('SELECT result, created_at FROM comparisons WHERE keyword_id = ? ORDER BY created_at DESC LIMIT 1', [k.id])
  return c.json({
    keyword: { id: k.id, keyword: k.keyword, bestPage: k.best_page, serpCheckedAt: k.serp_checked_at, createdAt: k.created_at },
    history,
    serp: latestSerp(c, k.id),
    comparison: cmp ? { ...JSON.parse(cmp.result), createdAt: cmp.created_at } : null,
  })
})

rankingRoutes.delete('/keywords/:id', (c) => {
  const k = ownedKeyword(c, c.req.param('id'))
  c.var.ctx.db.run('DELETE FROM tracked_keywords WHERE id = ?', [k.id])
  return c.body(null, 204)
})

/** Refresh the live top 10 now (at most once a day per keyword). */
rankingRoutes.post('/keywords/:id/serp', async (c) => {
  const k = ownedKeyword(c, c.req.param('id'))
  if (!getPlan(c.var.account.plan).limits.serpRefreshDays) throw new ApiError(402, 'plan_feature', 'Live Google results are included from the Starter plan')
  if (k.serp_checked_at && c.var.ctx.now().getTime() - new Date(k.serp_checked_at).getTime() < 20 * 3_600_000)
    throw new ApiError(429, 'rate_limited', 'Live results for this keyword were refreshed in the last day')
  try {
    return c.json(await refreshSerp(c.var.ctx, k.id))
  } catch (e) {
    return fail(e)
  }
})

rankingRoutes.post('/projects/:id/compare', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const input = await body(
    c,
    z.object({ keyword: z.string().trim().min(2).max(200), keywordId: z.string().max(64).nullish(), myUrl: z.string().url().max(2000).nullish(), theirUrl: z.string().url().max(2000).nullish() }),
  )
  try {
    return c.json(await comparePage(c.var.ctx, p.id, input))
  } catch (e) {
    return fail(e)
  }
})
