import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import type { ZodType } from 'zod'
import type { Ctx } from './context.js'
import { API_KEY_PREFIX, RateLimiter, SESSION_COOKIE, userForApiKey, userForToken, type SessionUser } from './lib/auth.js'
import { getPlan } from './plans.js'

export type Env = { Variables: { user: SessionUser; ctx: Ctx; auth: 'session' | 'key' } }
export type C = Context<Env>

export const router = () => new Hono<Env>()

export class ApiError extends HTTPException {
  constructor(
    status: 400 | 401 | 402 | 403 | 404 | 409 | 422 | 429 | 500 | 503,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(status, { message })
  }
}

export const notFound = (what = 'Resource') => new ApiError(404, 'not_found', `${what} not found`)

/** Parse + validate a JSON body with zod; 422 with field errors on failure. */
export async function body<T>(c: C, schema: ZodType<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON')
  }
  const r = schema.safeParse(raw)
  if (!r.success) throw new ApiError(422, 'validation_failed', 'Some fields are invalid', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })))
  return r.data
}

/** Areas an API key can never reach: anything that manages the account itself. */
const sessionOnly = ['/api/auth/', '/api/billing/', '/api/google/', '/api/admin/', '/api/keys']
const keyLimiters = new WeakMap<object, RateLimiter>()

export const requireUser: MiddlewareHandler<Env> = async (c, next) => {
  const { ctx } = c.var
  const bearer = c.req.header('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (bearer?.startsWith(API_KEY_PREFIX)) {
    const user = userForApiKey(ctx.db, bearer)
    if (!user) throw new ApiError(401, 'invalid_api_key', 'This API key is invalid or was revoked')
    const path = c.req.path
    const readMe = c.req.method === 'GET' && path === '/api/auth/me'
    if (!readMe && sessionOnly.some((p) => path.startsWith(p))) throw new ApiError(403, 'session_required', 'This endpoint is not available to API keys')
    if (!getPlan(user.plan).features.api) throw new ApiError(402, 'plan_feature', 'API access is available from the Pro plan')
    if (!keyLimiters.has(ctx)) keyLimiters.set(ctx, new RateLimiter(120, 60_000))
    if (!keyLimiters.get(ctx)!.take(user.keyId)) throw new ApiError(429, 'rate_limited', 'API keys are limited to 120 requests per minute')
    ctx.db.run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', [ctx.now().toISOString(), user.keyId])
    const { keyId: _k, ...u } = user
    c.set('user', u)
    c.set('auth', 'key')
    return next()
  }
  const user = userForToken(ctx.db, getCookie(c, SESSION_COOKIE))
  if (!user) throw new ApiError(401, 'unauthenticated', 'Sign in to continue')
  c.set('user', user)
  c.set('auth', 'session')
  await next()
}

/** Load a project the current user owns, or 404 (never 403 — don't leak existence). */
export function ownedProject(c: C, projectId: string) {
  const p = c.var.ctx.db.get<{ id: string; user_id: string; name: string; domain: string; gsc_property: string | null; created_at: string }>(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?',
    [projectId, c.var.user.id],
  )
  if (!p) throw notFound('Project')
  return p
}

export function pageParams(c: C, maxSize = 100) {
  const page = Math.max(1, Number(c.req.query('page') ?? 1) || 1)
  const pageSize = Math.min(maxSize, Math.max(1, Number(c.req.query('pageSize') ?? 25) || 25))
  return { page, pageSize, offset: (page - 1) * pageSize }
}
