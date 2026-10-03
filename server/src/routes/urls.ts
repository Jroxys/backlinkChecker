import { enforceLimits } from '../services/plan.js'
import { z } from 'zod'
import { ApiError, body, notFound, ownedProject, pageParams, requireUser, router } from '../http.js'
import { addUrls, checkUrl, inspectUrl, alertForUrlChanges, type UrlRow } from '../services/urls.js'

export const urlRoutes = router()
urlRoutes.use('/projects/*', requireUser)
urlRoutes.use('/urls/*', requireUser)

const SORTS: Record<string, string> = {
  url: 'url',
  status: "CASE index_status WHEN 'indexed' THEN 0 WHEN 'crawled' THEN 1 WHEN 'discovered' THEN 2 WHEN 'blocked' THEN 3 WHEN 'error' THEN 4 ELSE 5 END",
  http: 'http_status',
  lastCrawl: 'last_crawled_by_google',
  lastChecked: 'last_checked_at',
}

export function presentUrl(u: UrlRow) {
  let path = u.url
  try {
    const x = new URL(u.url)
    path = x.pathname + x.search
  } catch {
    /* keep */
  }
  return {
    id: u.id,
    url: u.url,
    path,
    title: u.title,
    status: u.index_status,
    paused: Boolean(u.paused),
    coverageState: u.coverage_state,
    http: u.http_status,
    indexable: u.indexable === null ? null : Boolean(u.indexable),
    robots: u.robots,
    canonical: u.canonical,
    canonicalUrl: u.canonical_url,
    googleCanonical: u.google_canonical,
    inSitemap: Boolean(u.in_sitemap),
    wordCount: u.word_count,
    loadMs: u.load_ms,
    lastCrawl: u.last_crawled_by_google,
    lastChecked: u.last_checked_at,
    indexCheckedAt: u.index_checked_at,
    source: u.source,
  }
}

urlRoutes.get('/projects/:id/urls', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const { page, pageSize, offset } = pageParams(c)
  const where = ['project_id = :p']
  const params: Record<string, string | number> = { p: p.id }
  const statuses = (c.req.query('status') ?? '').split(',').filter((s) => ['indexed', 'crawled', 'discovered', 'blocked', 'error', 'unknown'].includes(s))
  if (statuses.length) where.push(`index_status IN (${statuses.map((_, i) => `:s${i}`).join(',')})`), statuses.forEach((s, i) => (params[`s${i}`] = s))
  const q = c.req.query('q')?.trim()
  if (q) where.push('(url LIKE :q OR title LIKE :q)'), (params.q = `%${q}%`)
  if (c.req.query('indexable') === 'false') where.push('indexable = 0')
  const sortKey = SORTS[c.req.query('sort') ?? 'lastChecked'] ?? SORTS.lastChecked
  const dir = c.req.query('dir') === 'asc' ? 'ASC' : 'DESC'
  const total = c.var.ctx.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM monitored_urls WHERE ${where.join(' AND ')}`, params)!.n
  const rows = c.var.ctx.db.all<UrlRow>(`SELECT * FROM monitored_urls WHERE ${where.join(' AND ')} ORDER BY ${sortKey} ${dir} NULLS LAST, url LIMIT ${pageSize} OFFSET ${offset}`, params)
  const counts = Object.fromEntries(
    c.var.ctx.db.all<{ s: string; n: number }>('SELECT index_status AS s, COUNT(*) AS n FROM monitored_urls WHERE project_id = ? GROUP BY index_status', [p.id]).map((r) => [r.s, r.n]),
  )
  return c.json({ urls: rows.map(presentUrl), total, page, pageSize, counts })
})

urlRoutes.post('/projects/:id/urls', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const { urls } = await body(c, z.object({ urls: z.array(z.string().max(2000)).min(1).max(5000) }))
  return c.json(addUrls(c.var.ctx, p.id, urls), 201)
})

function ownedUrl(c: Parameters<typeof ownedProject>[0], urlId: string) {
  const u = c.var.ctx.db.get<UrlRow>('SELECT m.* FROM monitored_urls m JOIN projects p ON p.id = m.project_id WHERE m.id = ? AND p.user_id = ?', [urlId, c.var.account.id])
  if (!u) throw notFound('URL')
  return u
}

urlRoutes.get('/urls/:id', (c) => {
  const u = ownedUrl(c, c.req.param('id'))
  const { db } = c.var.ctx
  const events = db.all('SELECT at, kind, detail FROM url_events WHERE url_id = ? ORDER BY at DESC LIMIT 50', [u.id])
  const backlinks = db.all(
    "SELECT id, source_url AS sourceUrl, source_domain AS sourceDomain, anchor, rel, authority, status, first_seen AS firstSeen FROM backlinks WHERE project_id = ? AND (found_target = ? OR target_url = ?) AND status != 'pending' ORDER BY authority DESC NULLS LAST LIMIT 100",
    [u.project_id, u.url, u.url],
  )
  return c.json({ url: presentUrl(u), events, backlinks })
})

urlRoutes.post('/urls/:id/recheck', async (c) => {
  const u = ownedUrl(c, c.req.param('id'))
  if (u.paused) throw new ApiError(402, 'paused', 'This is paused because it’s over your plan’s limits. Upgrade, or remove something, to resume it.')
  const changes = [...(await checkUrl(c.var.ctx, u.id))]
  try {
    changes.push(...(await inspectUrl(c.var.ctx, u.id)))
  } catch (e) {
    throw new ApiError(503, 'google_unavailable', `Technical check done, but Search Console inspection failed: ${(e as Error).message}`)
  } finally {
    alertForUrlChanges(c.var.ctx, changes)
  }
  return c.json({ url: presentUrl(ownedUrl(c, u.id)), changes: changes.map((x) => ({ kind: x.kind, detail: x.detail })) })
})

urlRoutes.delete('/urls/:id', (c) => {
  const u = ownedUrl(c, c.req.param('id'))
  c.var.ctx.db.run('DELETE FROM monitored_urls WHERE id = ?', [u.id])
  enforceLimits(c.var.ctx, c.var.account.id)
  return c.json({ ok: true })
})
