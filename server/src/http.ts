import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import type { ZodType } from 'zod'
import type { Ctx } from './context.js'
import { API_KEY_PREFIX, RateLimiter, SESSION_COOKIE, userForApiKey, userForToken, type SessionUser } from './lib/auth.js'
import { getPlan } from './plans.js'

/**
 * `user` is who is signed in; `account` is whose workspace they act in. They differ only for
 * team members, who work inside the owner's account (projects, plan, limits, alerts).
 */
export interface Account {
  id: string
  plan: string
  role: 'owner' | 'member'
  ownerName: string
  /** Member whose seat the owner's plan no longer covers. */
  suspended?: boolean
}
export type Env = { Variables: { user: SessionUser; ctx: Ctx; auth: 'session' | 'key'; account: Account } }
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
const sessionOnly = ['/api/auth/', '/api/billing/', '/api/google/', '/api/admin/', '/api/keys', '/api/team']
const keyLimiters = new WeakMap<object, RateLimiter>()

export const requireUser: MiddlewareHandler<Env> = async (c, next) => {
  // Several routers mounted at /api match the same paths; authenticate (and rate-limit keys) once.
  if (c.var.user) return next()
  const { ctx } = c.var
  const bearer = c.req.header('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (bearer?.startsWith(API_KEY_PREFIX)) {
    const user = userForApiKey(ctx.db, bearer)
    if (!user) throw new ApiError(401, 'invalid_api_key', 'This API key is invalid or was revoked')
    const path = c.req.path
    const readMe = c.req.method === 'GET' && path === '/api/auth/me'
    if (!readMe && sessionOnly.some((p) => path.startsWith(p))) throw new ApiError(403, 'session_required', 'This endpoint is not available to API keys')
    if (!keyLimiters.has(ctx)) keyLimiters.set(ctx, new RateLimiter(120, 60_000))
    if (!keyLimiters.get(ctx)!.take(user.keyId)) throw new ApiError(429, 'rate_limited', 'API keys are limited to 120 requests per minute')
    ctx.db.run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', [ctx.now().toISOString(), user.keyId])
    const { keyId: _k, ...u } = user
    c.set('user', u)
    c.set('auth', 'key')
    setAccount(c, accountFor(ctx, u))
    if (!getPlan(c.var.account.plan).features.api) throw new ApiError(402, 'plan_feature', 'API access is available from the Pro plan')
    return next()
  }
  const user = userForToken(ctx.db, getCookie(c, SESSION_COOKIE))
  if (!user) throw new ApiError(401, 'unauthenticated', 'Sign in to continue')
  c.set('user', user)
  c.set('auth', 'session')
  setAccount(c, accountFor(ctx, user))
  await next()
}

function accountFor(ctx: Ctx, user: SessionUser): Account {
  const team = ctx.db.get<{ owner_id: string; plan: string; name: string; seat: number }>(
    `SELECT t.owner_id, o.plan, o.name,
            (SELECT COUNT(*) FROM team_members x WHERE x.owner_id = t.owner_id AND x.created_at <= t.created_at) AS seat
       FROM team_members t JOIN users o ON o.id = t.owner_id WHERE t.member_id = ?`,
    [user.id],
  )
  if (!team) return { id: user.id, plan: user.plan, role: 'owner', ownerName: user.name }
  // Seat 0 is the owner. After a downgrade, the most recent members lose access first — nobody is deleted.
  return { id: team.owner_id, plan: team.plan, role: 'member', ownerName: team.name, suspended: team.seat >= getPlan(team.plan).limits.seats }
}

/** What a suspended member can still do: see who they are, leave, or delete their own account. */
const suspendedAllowed = ['/api/auth/', '/api/team/leave']

function setAccount(c: C, account: Account) {
  c.set('account', account)
  if (account.suspended && !suspendedAllowed.some((p) => c.req.path.startsWith(p)))
    throw new ApiError(402, 'seat_limit', `${account.ownerName}’s plan no longer includes your seat. Ask them to upgrade, or leave the team.`)
}

/** Account-level actions (billing, Google connection, branding, team) belong to the workspace owner. */
export const ownerOnly: MiddlewareHandler<Env> = async (c, next) => {
  if (c.var.account.role !== 'owner') throw new ApiError(403, 'owner_only', `Only ${c.var.account.ownerName} can change this`)
  await next()
}

/** Load a project in the current workspace, or 404 (never 403 — don't leak existence). */
export function ownedProject(c: C, projectId: string) {
  const p = c.var.ctx.db.get<{ id: string; user_id: string; name: string; domain: string; gsc_property: string | null; created_at: string }>(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?',
    [projectId, c.var.account.id],
  )
  if (!p) throw notFound('Project')
  return p
}

export function pageParams(c: C, maxSize = 100) {
  const page = Math.max(1, Number(c.req.query('page') ?? 1) || 1)
  const pageSize = Math.min(maxSize, Math.max(1, Number(c.req.query('pageSize') ?? 25) || 25))
  return { page, pageSize, offset: (page - 1) * pageSize }
}
