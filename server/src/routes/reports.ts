import { randomBytes } from 'node:crypto'
import { ApiError, notFound, ownedProject, requireUser, router } from '../http.js'
import { RateLimiter } from '../lib/auth.js'
import { getPlan } from '../plans.js'
import { buildReport } from '../services/report.js'
import { keywordsFor } from '../services/keywords.js'

/** Share links for client reports. The token in the URL is the only credential. */
export const reportRoutes = router()

const limiters = new WeakMap<object, RateLimiter>()

/** Public: the shared report. 404 for unknown tokens or once the owner's plan drops reports. */
reportRoutes.get('/reports/:token', (c) => {
  const { ctx } = c.var
  if (!limiters.has(ctx)) limiters.set(ctx, new RateLimiter(120, 60 * 60_000))
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (!limiters.get(ctx)!.take(ip)) throw new ApiError(429, 'rate_limited', 'Too many requests')
  const p = ctx.db.get<{ id: string; plan: string }>(
    'SELECT p.id, u.plan FROM projects p JOIN users u ON u.id = p.user_id WHERE p.report_token = ?',
    [c.req.param('token')],
  )
  if (!p || !getPlan(p.plan).features.reports) throw notFound('Report')
  c.header('Cache-Control', 'private, max-age=300')
  c.header('X-Robots-Tag', 'noindex')
  return c.json(buildReport(ctx, p.id))
})

reportRoutes.use('/projects/:id/share', requireUser)
reportRoutes.use('/projects/:id/report', requireUser)

/** The in-app report: refreshes Search Console queries first when connected, then the same payload clients see. */
reportRoutes.get('/projects/:id/report', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  await keywordsFor(c.var.ctx, p.id).catch(() => undefined)
  return c.json(buildReport(c.var.ctx, p.id))
})

reportRoutes.get('/projects/:id/share', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const row = c.var.ctx.db.get<{ report_token: string | null }>('SELECT report_token FROM projects WHERE id = ?', [p.id])!
  return c.json({ url: row.report_token ? `${c.var.ctx.config.appUrl}/r/${row.report_token}` : null })
})

/** Turn sharing on, or rotate the link (the old one stops working). */
reportRoutes.post('/projects/:id/share', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  if (!getPlan(c.var.account.plan).features.reports) throw new ApiError(402, 'plan_feature', 'Shareable client reports are available from the Starter plan')
  const token = randomBytes(18).toString('base64url')
  c.var.ctx.db.run('UPDATE projects SET report_token = ? WHERE id = ?', [token, p.id])
  return c.json({ url: `${c.var.ctx.config.appUrl}/r/${token}` })
})

reportRoutes.delete('/projects/:id/share', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  c.var.ctx.db.run('UPDATE projects SET report_token = NULL WHERE id = ?', [p.id])
  return c.body(null, 204)
})
