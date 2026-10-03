import { z } from 'zod'
import { ApiError, body, ownedProject, requireUser, router } from '../http.js'
import { id, now } from '../lib/ids.js'
import { normalizeDomain } from '../lib/url.js'
import { getPlan } from '../plans.js'
import { opportunitiesFor } from '../services/opportunities.js'

export const competitorRoutes = router()
competitorRoutes.use('/projects/*', requireUser)

competitorRoutes.get('/projects/:id/competitors', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const rows = c.var.ctx.db.all('SELECT id, domain, created_at AS createdAt FROM competitors WHERE project_id = ? ORDER BY created_at', [p.id])
  return c.json({ competitors: rows, providerConfigured: Boolean(c.var.ctx.provider) })
})

competitorRoutes.post('/projects/:id/competitors', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const { domain: raw } = await body(c, z.object({ domain: z.string().min(3).max(253) }))
  const domain = normalizeDomain(raw)
  if (!domain || domain === p.domain) throw new ApiError(422, 'invalid_domain', 'Enter a competitor domain like rival.com')
  const max = getPlan(c.var.account.plan).limits.competitorsPerProject
  const count = c.var.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM competitors WHERE project_id = ?', [p.id])!.n
  if (count >= max) throw new ApiError(402, 'plan_limit', max ? `Your plan tracks up to ${max} competitors per project` : 'Competitor tracking starts on the Starter plan')
  c.var.ctx.db.run('INSERT OR IGNORE INTO competitors (id, project_id, domain, created_at) VALUES (?, ?, ?, ?)', [id('cmp'), p.id, domain, now()])
  return c.json({ ok: true }, 201)
})

competitorRoutes.delete('/projects/:id/competitors/:cid', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  c.var.ctx.db.run('DELETE FROM competitors WHERE id = ? AND project_id = ?', [c.req.param('cid'), p.id])
  return c.json({ ok: true })
})

/** Backlink gap: referring domains linking to competitors but not to you. Needs the discovery provider. */
competitorRoutes.get('/projects/:id/competitors/gap', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const provider = c.var.ctx.provider
  if (!provider) throw new ApiError(503, 'provider_not_configured', 'Backlink gap analysis needs a backlink data provider (DATAFORSEO_LOGIN/PASSWORD).')
  const comps = c.var.ctx.db.all<{ domain: string }>('SELECT domain FROM competitors WHERE project_id = ?', [p.id]).map((r) => r.domain)
  if (!comps.length) return c.json({ gap: [] })
  return c.json({ gap: await provider.gap(p.domain, comps, { limit: 50 }) })
})

/** Ranked link opportunities: reclaim lost links, redirect broken targets, competitor gaps. */
competitorRoutes.get('/projects/:id/opportunities', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  return c.json(await opportunitiesFor(c.var.ctx, p.id))
})
