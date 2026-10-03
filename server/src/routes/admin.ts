import { ApiError, requireUser, router } from '../http.js'
import { getPlan } from '../plans.js'

/** Founder metrics: the funnel from docs/LANSMAN.md, computed from first-party data. */
export const adminRoutes = router()
adminRoutes.use('*', requireUser)
adminRoutes.use('*', async (c, next) => {
  if (!c.var.ctx.config.adminEmails.includes(c.var.user.email.toLowerCase())) throw new ApiError(404, 'not_found', 'No such endpoint')
  await next()
})

adminRoutes.get('/metrics', (c) => {
  const { db } = c.var.ctx
  const days = Math.min(180, Math.max(7, Number(c.req.query('days') ?? 30)))
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const n = (sql: string, p: unknown[] = []) => db.get<{ n: number }>(sql, p as never)!.n

  const cohort = 'SELECT id FROM users WHERE created_at >= ?'
  const signups = n('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', [since])
  const funnel = [
    { step: 'Signed up', users: signups },
    { step: 'Created a project', users: n(`SELECT COUNT(DISTINCT user_id) AS n FROM projects WHERE user_id IN (${cohort})`, [since]) },
    { step: 'Added backlinks', users: n(`SELECT COUNT(DISTINCT p.user_id) AS n FROM backlinks b JOIN projects p ON p.id = b.project_id WHERE p.user_id IN (${cohort})`, [since]) },
    { step: 'Connected Search Console', users: n(`SELECT COUNT(*) AS n FROM google_connections WHERE user_id IN (${cohort})`, [since]) },
    { step: 'Received a real alert', users: n(`SELECT COUNT(DISTINCT user_id) AS n FROM alerts WHERE user_id IN (${cohort})`, [since]) },
    { step: 'Started checkout', users: n(`SELECT COUNT(DISTINCT user_id) AS n FROM events WHERE name = 'checkout_started' AND user_id IN (${cohort})`, [since]) },
    { step: 'Paying', users: n(`SELECT COUNT(*) AS n FROM users WHERE plan != 'free' AND id IN (${cohort})`, [since]) },
  ]

  const paying = db.all<{ plan: string; founding: number; n: number }>("SELECT plan, founding, COUNT(*) AS n FROM users WHERE plan != 'free' GROUP BY plan, founding")
  const mrr = paying.reduce((a, r) => a + (r.founding ? getPlan(r.plan).founding : getPlan(r.plan).monthly) * r.n, 0)

  const daily = db.all<{ day: string; signups: number }>("SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS signups FROM users WHERE created_at >= ? GROUP BY day ORDER BY day", [since])
  const tools = db.all<{ name: string; n: number }>("SELECT name, COUNT(*) AS n FROM events WHERE name LIKE 'tool_%' AND at >= ? GROUP BY name", [since])

  return c.json({
    days,
    totals: {
      users: n('SELECT COUNT(*) AS n FROM users'),
      projects: n('SELECT COUNT(*) AS n FROM projects'),
      urls: n('SELECT COUNT(*) AS n FROM monitored_urls'),
      backlinks: n('SELECT COUNT(*) AS n FROM backlinks'),
      paying: paying.reduce((a, r) => a + r.n, 0),
      founding: n('SELECT COUNT(*) AS n FROM users WHERE founding = 1'),
      mrr,
    },
    funnel,
    daily,
    tools: Object.fromEntries(tools.map((t) => [t.name, t.n])),
    queue: db.all("SELECT kind, status, COUNT(*) AS n FROM jobs WHERE status IN ('queued','running','failed') GROUP BY kind, status"),
  })
})
