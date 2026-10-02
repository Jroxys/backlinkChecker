import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import type { ZodType } from 'zod'
import type { Ctx } from './context.js'
import { SESSION_COOKIE, userForToken, type SessionUser } from './lib/auth.js'

export type Env = { Variables: { user: SessionUser; ctx: Ctx } }
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

export const requireUser: MiddlewareHandler<Env> = async (c, next) => {
  const user = userForToken(c.var.ctx.db, getCookie(c, SESSION_COOKIE))
  if (!user) throw new ApiError(401, 'unauthenticated', 'Sign in to continue')
  c.set('user', user)
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
