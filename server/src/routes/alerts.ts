import { z } from 'zod'
import { body, pageParams, requireUser, router } from '../http.js'
import { getPlan } from '../plans.js'
import { ApiError } from '../http.js'

export const alertRoutes = router()
alertRoutes.use('*', requireUser)

alertRoutes.get('/', (c) => {
  const { pageSize, offset } = pageParams(c)
  const where = ['a.user_id = :u']
  const params: Record<string, string> = { u: c.var.account.id }
  if (c.req.query('unread') === 'true') where.push('a.read_at IS NULL')
  const sev = c.req.query('severity')
  if (sev) where.push('a.severity = :sev'), (params.sev = sev)
  const kind = c.req.query('kind')
  if (kind) where.push('a.kind = :kind'), (params.kind = kind)
  const rows = c.var.ctx.db.all(
    `SELECT a.id, a.kind, a.severity, a.title, a.body AS description, a.href, a.created_at AS time, a.read_at IS NOT NULL AS read, p.domain AS project
       FROM alerts a LEFT JOIN projects p ON p.id = a.project_id WHERE ${where.join(' AND ')} ORDER BY a.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  )
  const unread = c.var.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM alerts WHERE user_id = ? AND read_at IS NULL', [c.var.account.id])!.n
  return c.json({ alerts: rows.map((r) => ({ ...r, read: Boolean(r.read) })), unread })
})

alertRoutes.post('/:id/read', (c) => {
  c.var.ctx.db.run('UPDATE alerts SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?', [new Date().toISOString(), c.req.param('id'), c.var.account.id])
  return c.json({ ok: true })
})

alertRoutes.post('/read-all', (c) => {
  c.var.ctx.db.run('UPDATE alerts SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [new Date().toISOString(), c.var.account.id])
  return c.json({ ok: true })
})

alertRoutes.get('/settings', (c) => {
  const s = c.var.ctx.db.get('SELECT email, slack_webhook AS slackWebhook, webhook_url AS webhookUrl, digest, min_severity AS minSeverity FROM notification_settings WHERE user_id = ?', [c.var.account.id])
  return c.json({ settings: s ?? { email: 1, slackWebhook: null, webhookUrl: null, digest: 0, minSeverity: 'warning' } })
})

const settingsSchema = z.object({
  email: z.boolean().optional(),
  slackWebhook: z.string().url().startsWith('https://hooks.slack.com/').nullable().optional(),
  webhookUrl: z.string().url().startsWith('https://').nullable().optional(),
  digest: z.boolean().optional(),
  minSeverity: z.enum(['info', 'warning', 'critical']).optional(),
})

alertRoutes.put('/settings', async (c) => {
  const input = await body(c, settingsSchema)
  const plan = getPlan(c.var.account.plan)
  if (input.slackWebhook && !plan.features.slack) throw new ApiError(402, 'plan_feature', `Slack alerts are available from the Starter plan`)
  if (input.webhookUrl && !plan.features.webhooks) throw new ApiError(402, 'plan_feature', `Webhooks are available from the Pro plan`)
  const { db } = c.var.ctx
  db.run('INSERT OR IGNORE INTO notification_settings (user_id) VALUES (?)', [c.var.account.id])
  db.run(
    `UPDATE notification_settings SET
       email = COALESCE(:email, email),
       slack_webhook = CASE WHEN :setSlack THEN :slack ELSE slack_webhook END,
       webhook_url = CASE WHEN :setHook THEN :hook ELSE webhook_url END,
       digest = COALESCE(:digest, digest),
       min_severity = COALESCE(:min, min_severity)
     WHERE user_id = :u`,
    {
      u: c.var.account.id,
      email: input.email === undefined ? null : input.email ? 1 : 0,
      setSlack: input.slackWebhook !== undefined ? 1 : 0,
      slack: input.slackWebhook ?? null,
      setHook: input.webhookUrl !== undefined ? 1 : 0,
      hook: input.webhookUrl ?? null,
      digest: input.digest === undefined ? null : input.digest ? 1 : 0,
      min: input.minSeverity ?? null,
    },
  )
  return c.json({ ok: true })
})
