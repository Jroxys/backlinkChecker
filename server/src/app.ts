import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { Ctx } from './context.js'
import { ApiError, type Env } from './http.js'
import { authRoutes } from './routes/auth.js'
import { projectRoutes } from './routes/projects.js'
import { urlRoutes } from './routes/urls.js'
import { backlinkRoutes } from './routes/backlinks.js'
import { alertRoutes } from './routes/alerts.js'
import { googleRoutes } from './routes/google.js'
import { competitorRoutes } from './routes/competitors.js'
import { billingRoutes } from './routes/billing.js'

export function createApp(ctx: Ctx) {
  const app = new Hono<Env>()

  app.use('*', secureHeaders())
  app.use('/api/*', cors({ origin: [ctx.config.appUrl], credentials: true, allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], maxAge: 600 }))
  app.use('*', async (c, next) => {
    c.set('ctx', ctx)
    await next()
  })

  /**
   * CSRF: session cookies are SameSite=Lax, and every state-changing request must
   * come from our own origin (Origin header) — webhooks excepted, they're signed.
   */
  app.use('/api/*', async (c, next) => {
    const m = c.req.method
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && !c.req.path.startsWith('/api/billing/webhooks/')) {
      const origin = c.req.header('origin')
      if (origin && origin !== ctx.config.appUrl && origin !== ctx.config.apiUrl) throw new ApiError(403, 'bad_origin', 'Cross-site request blocked')
    }
    await next()
  })

  app.get('/api/health', (c) => c.json({ ok: true, time: ctx.now().toISOString() }))
  app.route('/api/auth', authRoutes)
  app.route('/api/projects', projectRoutes)
  app.route('/api', urlRoutes)
  app.route('/api', backlinkRoutes)
  app.route('/api', competitorRoutes)
  app.route('/api/alerts', alertRoutes)
  app.route('/api/google', googleRoutes)
  app.route('/api/billing', billingRoutes)

  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'No such endpoint' } }, 404))
  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status)
    if ('status' in err && typeof err.status === 'number' && err.status < 500) return c.json({ error: { code: 'http_error', message: err.message } }, err.status as 400)
    console.error('[api] unhandled', err)
    return c.json({ error: { code: 'internal', message: 'Something went wrong on our side' } }, 500)
  })
  return app
}
