import { z } from 'zod'
import { ApiError, body, ownedProject, requireUser, router } from '../http.js'
import { id, now } from '../lib/ids.js'
import { normalizeDomain } from '../lib/url.js'
import { getPlan } from '../plans.js'
import { opportunitiesFor } from '../services/opportunities.js'
import { addBacklinks } from '../services/backlinks.js'

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

/** Backlink gap: referring domains linking to competitors but not to you (our link graph, plus the provider when configured). */
competitorRoutes.get('/projects/:id/competitors/gap', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const r = await opportunitiesFor(c.var.ctx, p.id)
  return c.json({
    gap: r.opportunities
      .filter((o) => o.kind === 'competitor-gap' && o.status !== 'won')
      .map((o) => ({ domain: o.domain, authority: o.authority, linksTo: o.competitors, evidence: o.evidence, sourceUrl: o.sourceUrl })),
    status: r.gapStatus,
  })
})

/** Ranked link opportunities: reclaim lost links, redirect broken targets, competitor gaps. */
competitorRoutes.get('/projects/:id/opportunities', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  return c.json(await opportunitiesFor(c.var.ctx, p.id))
})

/**
 * Outreach progress for an opportunity. "won" adds the linking page to backlink monitoring,
 * so the new link is verified and watched from then on.
 */
competitorRoutes.put('/projects/:id/opportunities/status', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const input = await body(
    c,
    z.object({
      key: z.string().min(3).max(2500),
      domain: z.string().min(3).max(253),
      status: z.enum(['todo', 'contacted', 'won', 'rejected']),
      linkUrl: z.string().url().max(2000).nullish(),
      note: z.string().max(1000).nullish(),
    }),
  )
  const { db } = c.var.ctx
  let backlinkId: string | null = null
  let skipped: string | null = null
  if (input.status === 'won' && input.linkUrl) {
    const r = addBacklinks(c.var.ctx, p.id, [{ sourceUrl: input.linkUrl }], 'manual')
    backlinkId = r.created[0] ?? null
    skipped = r.skipped[0]?.reason ?? null
    if (skipped === 'plan_limit') throw new ApiError(402, 'plan_limit', 'Your plan’s backlink limit is reached — upgrade to monitor this link')
    if (skipped === 'internal_link' || skipped === 'invalid_url') throw new ApiError(422, 'invalid_url', 'Enter the URL of the page on the other site that links to you')
  }
  db.run(
    `INSERT INTO outreach (project_id, opp_key, domain, status, note, backlink_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT DO UPDATE SET status = excluded.status, note = COALESCE(excluded.note, outreach.note), backlink_id = COALESCE(excluded.backlink_id, outreach.backlink_id), updated_at = excluded.updated_at`,
    [p.id, input.key, input.domain, input.status, input.note ?? null, backlinkId, now()],
  )
  return c.json({ status: input.status, backlinkId, alreadyMonitored: skipped === 'duplicate' })
})
