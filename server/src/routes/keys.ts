import { z } from 'zod'
import { ApiError, body, notFound, requireUser, router } from '../http.js'
import { createApiKey } from '../lib/auth.js'
import { id } from '../lib/ids.js'
import { getPlan } from '../plans.js'

const MAX_KEYS = 10

/** Personal API keys. Managed with a browser session only — a key can't mint or revoke keys. */
export const keyRoutes = router()
keyRoutes.use('*', requireUser)

keyRoutes.get('/', (c) => {
  const keys = c.var.ctx.db.all<{ id: string; name: string; prefix: string; created_at: string; last_used_at: string | null }>(
    'SELECT id, name, prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
    [c.var.user.id],
  )
  return c.json({ keys: keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, createdAt: k.created_at, lastUsedAt: k.last_used_at })) })
})

keyRoutes.post('/', async (c) => {
  const { db } = c.var.ctx
  const input = await body(c, z.object({ name: z.string().trim().min(1).max(60) }))
  if (!getPlan(c.var.user.plan).features.api) throw new ApiError(402, 'plan_feature', 'API access is available from the Pro plan')
  const count = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ?', [c.var.user.id])!.n
  if (count >= MAX_KEYS) throw new ApiError(409, 'limit_reached', `You can have up to ${MAX_KEYS} API keys. Revoke one first.`)
  const key = createApiKey()
  const keyId = id('key')
  db.run('INSERT INTO api_keys (id, user_id, name, hash, prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)', [keyId, c.var.user.id, input.name, key.hash, key.prefix, c.var.ctx.now().toISOString()])
  return c.json({ key: { id: keyId, name: input.name, prefix: key.prefix }, token: key.token }, 201)
})

keyRoutes.delete('/:id', (c) => {
  const r = c.var.ctx.db.run('DELETE FROM api_keys WHERE id = ? AND user_id = ?', [c.req.param('id'), c.var.user.id])
  if (!r.changes) throw notFound('API key')
  return c.body(null, 204)
})
