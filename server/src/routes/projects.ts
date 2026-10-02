import { z } from 'zod'
import { ApiError, body, ownedProject, requireUser, router } from '../http.js'
import { id, now } from '../lib/ids.js'
import { normalizeDomain } from '../lib/url.js'
import { getPlan } from '../plans.js'
import { enqueue } from '../jobs/queue.js'
import { addUrls } from '../services/urls.js'
import { projectSnapshot } from '../services/stats.js'
import { runAudit } from '../services/audit.js'

export const projectRoutes = router()
projectRoutes.use('*', requireUser)

const createSchema = z.object({
  domain: z.string().trim().min(3).max(253),
  name: z.string().trim().max(80).optional(),
  gscProperty: z.string().trim().max(300).nullish(),
})

function present(p: { id: string; name: string; domain: string; gsc_property: string | null; created_at: string }, stats?: ReturnType<typeof projectSnapshot>) {
  return { id: p.id, name: p.name, domain: p.domain, gscProperty: p.gsc_property, createdAt: p.created_at, stats }
}

projectRoutes.get('/', (c) => {
  const { db } = c.var.ctx
  const rows = db.all<{ id: string; name: string; domain: string; gsc_property: string | null; created_at: string }>('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at', [c.var.user.id])
  return c.json({
    projects: rows.map((p) => {
      const last = db.get<{ at: string | null }>(
        'SELECT MAX(x) AS at FROM (SELECT MAX(last_checked_at) AS x FROM monitored_urls WHERE project_id = ? UNION ALL SELECT MAX(last_checked_at) FROM backlinks WHERE project_id = ?)',
        [p.id, p.id],
      )
      const trend = db.all<{ indexed: number }>('SELECT indexed FROM daily_stats WHERE project_id = ? ORDER BY date DESC LIMIT 14', [p.id]).map((r) => r.indexed).reverse()
      return { ...present(p, projectSnapshot(db, p.id)), lastScan: last?.at ?? null, indexTrend: trend }
    }),
  })
})

projectRoutes.post('/', async (c) => {
  const { db } = c.var.ctx
  const input = await body(c, createSchema)
  const domain = normalizeDomain(input.domain)
  if (!domain) throw new ApiError(422, 'invalid_domain', 'Enter a domain like example.com')
  const plan = getPlan(c.var.user.plan)
  const count = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM projects WHERE user_id = ?', [c.var.user.id])!.n
  if (count >= plan.limits.projects) throw new ApiError(402, 'plan_limit', `Your ${plan.name} plan includes ${plan.limits.projects} project${plan.limits.projects > 1 ? 's' : ''}. Upgrade to add more.`)
  if (db.get('SELECT 1 FROM projects WHERE user_id = ? AND domain = ?', [c.var.user.id, domain])) throw new ApiError(409, 'duplicate', `${domain} is already a project`)
  const projectId = id('prj')
  db.run('INSERT INTO projects (id, user_id, name, domain, gsc_property, created_at) VALUES (?, ?, ?, ?, ?, ?)', [projectId, c.var.user.id, input.name || domain, domain, input.gscProperty ?? null, now()])
  // Start monitoring right away: the homepage, then whatever the sitemaps list.
  addUrls(c.var.ctx, projectId, [`https://${domain}/`])
  enqueue(db, 'sitemaps.discover', { projectId }, { dedupeKey: `discover:${projectId}` })
  const p = ownedProject(c, projectId)
  return c.json({ project: present(p, projectSnapshot(db, projectId)) }, 201)
})

projectRoutes.get('/:id', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  return c.json({ project: present(p, projectSnapshot(c.var.ctx.db, p.id)) })
})

projectRoutes.patch('/:id', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const input = await body(c, z.object({ name: z.string().trim().min(1).max(80).optional(), gscProperty: z.string().trim().max(300).nullable().optional() }))
  c.var.ctx.db.run('UPDATE projects SET name = COALESCE(?, name), gsc_property = CASE WHEN ? THEN ? ELSE gsc_property END WHERE id = ?', [
    input.name ?? null,
    input.gscProperty !== undefined ? 1 : 0,
    input.gscProperty ?? null,
    p.id,
  ])
  return c.json({ project: present(ownedProject(c, p.id)) })
})

projectRoutes.delete('/:id', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  c.var.ctx.db.run('DELETE FROM projects WHERE id = ?', [p.id])
  return c.json({ ok: true })
})

/** "Scan now": make everything in the project due immediately. */
projectRoutes.post('/:id/scan', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const { db } = c.var.ctx
  const at = now()
  const u = db.run('UPDATE monitored_urls SET next_check_at = ? WHERE project_id = ?', [at, p.id]).changes
  const b = db.run("UPDATE backlinks SET next_check_at = ? WHERE project_id = ? AND status != 'blocked'", [at, p.id]).changes
  enqueue(db, 'urls.sweep', {}, { dedupeKey: 'periodic:urls.sweep' })
  enqueue(db, 'backlinks.sweep', {}, { dedupeKey: 'periodic:backlinks.sweep' })
  enqueue(db, 'sitemaps.discover', { projectId: p.id }, { dedupeKey: `discover:${p.id}` })
  return c.json({ queued: { urls: u, backlinks: b } })
})

/** Daily series for charts. */
projectRoutes.get('/:id/history', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const days = Math.min(400, Math.max(7, Number(c.req.query('days') ?? 90)))
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  const rows = c.var.ctx.db.all('SELECT * FROM daily_stats WHERE project_id = ? AND date >= ? ORDER BY date', [p.id, since])
  return c.json({ history: rows })
})

projectRoutes.get('/:id/sitemaps', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const rows = c.var.ctx.db.all<{ id: string; project_id: string; url: string }>('SELECT * FROM sitemaps WHERE project_id = ? ORDER BY url', [p.id])
  const indexedBySitemap = c.var.ctx.db.get<{ total: number; indexed: number }>(
    "SELECT COUNT(*) AS total, SUM(index_status = 'indexed') AS indexed FROM monitored_urls WHERE project_id = ? AND in_sitemap = 1",
    [p.id],
  )
  return c.json({ sitemaps: rows, coverage: indexedBySitemap })
})

projectRoutes.post('/:id/sitemaps', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const { url } = await body(c, z.object({ url: z.string().url().max(2000) }))
  const host = normalizeDomain(new URL(url).hostname)
  if (!host || !(host === p.domain || host.endsWith('.' + p.domain))) throw new ApiError(422, 'not_on_project_domain', `Sitemap must be on ${p.domain}`)
  const smId = id('sm')
  c.var.ctx.db.run('INSERT OR IGNORE INTO sitemaps (id, project_id, url, created_at) VALUES (?, ?, ?, ?)', [smId, p.id, url, now()])
  const row = c.var.ctx.db.get<{ id: string }>('SELECT id FROM sitemaps WHERE project_id = ? AND url = ?', [p.id, url])!
  enqueue(c.var.ctx.db, 'sitemaps.sync', { sitemapId: row.id }, { dedupeKey: `sitemap:${row.id}` })
  return c.json({ sitemap: row }, 201)
})

/** Rule-based technical audit over everything we've crawled for this project. */
projectRoutes.get('/:id/audit', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  return c.json(runAudit(c.var.ctx.db, p.id, c.var.ctx.now().toISOString()))
})
