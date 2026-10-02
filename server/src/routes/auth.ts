import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import { ApiError, body, requireUser, router } from '../http.js'
import { RateLimiter, SESSION_COOKIE, createSession, destroySession, hashPassword, verifyPassword } from '../lib/auth.js'
import { id, now } from '../lib/ids.js'
import { getPlan } from '../plans.js'
import { usageFor } from '../services/usage.js'

// One limiter per app context (tests create many contexts; prod has one).
const limiters = new WeakMap<object, RateLimiter>()
const limiterFor = (ctx: object) => {
  let l = limiters.get(ctx)
  if (!l) limiters.set(ctx, (l = new RateLimiter(10, 15 * 60_000)))
  return l
}

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(80),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
})
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) })

export const authRoutes = router()

function ip(c: { req: { header: (k: string) => string | undefined } }) {
  return c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'local'
}

authRoutes.post('/signup', async (c) => {
  const { db, config } = c.var.ctx
  if (!limiterFor(c.var.ctx).take(`signup:${ip(c)}`)) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again in a few minutes.')
  const input = await body(c, signupSchema)
  if (db.get('SELECT 1 FROM users WHERE email = ?', [input.email])) throw new ApiError(409, 'email_taken', 'An account with this email already exists')
  const userId = id('usr')
  db.run('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', [userId, input.email, input.name, await hashPassword(input.password), now()])
  db.run('INSERT INTO notification_settings (user_id) VALUES (?)', [userId])
  const s = createSession(db, userId)
  setCookie(c, SESSION_COOKIE, s.token, { httpOnly: true, secure: config.cookieSecure, sameSite: 'Lax', path: '/', maxAge: s.maxAge })
  return c.json({ user: { id: userId, email: input.email, name: input.name, plan: 'free' } }, 201)
})

authRoutes.post('/login', async (c) => {
  const { db, config } = c.var.ctx
  const input = await body(c, loginSchema)
  if (!limiterFor(c.var.ctx).take(`login:${ip(c)}:${input.email}`)) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again in a few minutes.')
  const u = db.get<{ id: string; password_hash: string; name: string; plan: string }>('SELECT id, password_hash, name, plan FROM users WHERE email = ?', [input.email])
  // Same error and similar timing whether or not the email exists
  const ok = u ? await verifyPassword(input.password, u.password_hash) : (await hashPassword(input.password), false)
  if (!u || !ok) throw new ApiError(401, 'invalid_credentials', 'Email or password is incorrect')
  const s = createSession(db, u.id)
  setCookie(c, SESSION_COOKIE, s.token, { httpOnly: true, secure: config.cookieSecure, sameSite: 'Lax', path: '/', maxAge: s.maxAge })
  return c.json({ user: { id: u.id, email: input.email, name: u.name, plan: u.plan } })
})

authRoutes.post('/logout', async (c) => {
  destroySession(c.var.ctx.db, getCookie(c, SESSION_COOKIE))
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})

authRoutes.get('/me', requireUser, (c) => {
  const u = c.var.user
  const plan = getPlan(u.plan)
  const google = c.var.ctx.db.get<{ email: string | null }>('SELECT email FROM google_connections WHERE user_id = ?', [u.id])
  return c.json({
    user: { id: u.id, email: u.email, name: u.name, plan: plan.id, founding: Boolean(u.founding), createdAt: u.created_at },
    plan,
    usage: usageFor(c.var.ctx.db, u.id),
    google: { connected: Boolean(google), email: google?.email ?? null, configured: c.var.ctx.google.configured },
  })
})
