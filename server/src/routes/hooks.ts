import { ApiError, notFound, router } from '../http.js'
import { RateLimiter } from '../lib/auth.js'
import { triggerDeployCheck } from '../services/watch.js'

/**
 * Public hooks called by other systems. The token in the URL is the credential.
 *   curl -X POST https://app.example.com/api/hooks/deploy/dep_…
 */
export const hookRoutes = router()
const limiters = new WeakMap<object, RateLimiter>()

hookRoutes.post('/deploy/:token', (c) => {
  const { ctx } = c.var
  const p = ctx.db.get<{ id: string; paused: number }>('SELECT id, paused FROM projects WHERE deploy_token = ?', [c.req.param('token')])
  if (!p) throw notFound('Hook')
  if (p.paused) throw new ApiError(402, 'paused', 'This project is paused because it’s over the plan’s limits')
  if (!limiters.has(ctx)) limiters.set(ctx, new RateLimiter(6, 60_000))
  if (!limiters.get(ctx)!.take(p.id)) throw new ApiError(429, 'rate_limited', 'At most 6 deploy checks per minute')
  return c.json({ ok: true, queued: triggerDeployCheck(ctx, p.id) }, 202)
})
