import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import { ApiError, body, ownerOnly, requireUser, router } from '../http.js'
import { randomBytes } from 'node:crypto'
import { RateLimiter, SESSION_COOKIE, clientIp, createSession, destroySession, hashPassword, sha256, verifyPassword } from '../lib/auth.js'
import { addHours, id, now } from '../lib/ids.js'
import { getPlan } from '../plans.js'
import { usageFor } from '../services/usage.js'
import { track } from '../services/events.js'
import type { Db } from '../db/index.js'

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
  return clientIp((k) => c.req.header(k))
}

authRoutes.post('/signup', async (c) => {
  const { db, config } = c.var.ctx
  if (!limiterFor(c.var.ctx).take(`signup:${ip(c)}`)) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again in a few minutes.')
  const input = await body(c, signupSchema)
  if (db.get('SELECT 1 FROM users WHERE email = ?', [input.email])) throw new ApiError(409, 'email_taken', 'An account with this email already exists')
  const userId = id('usr')
  db.run('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', [userId, input.email, input.name, await hashPassword(input.password), now()])
  db.run('INSERT INTO notification_settings (user_id) VALUES (?)', [userId])
  track(db, 'signup', userId)
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
  const acct = c.var.account
  const plan = getPlan(acct.plan)
  const google = c.var.ctx.db.get<{ email: string | null }>('SELECT email FROM google_connections WHERE user_id = ?', [acct.id])
  return c.json({
    user: { id: u.id, email: u.email, name: u.name, plan: plan.id, founding: Boolean(acct.role === 'owner' && u.founding), createdAt: u.created_at, isAdmin: c.var.ctx.config.adminEmails.includes(u.email.toLowerCase()) },
    plan,
    usage: usageFor(c.var.ctx.db, acct.id),
    team: { role: acct.role, ownerName: acct.ownerName, suspended: Boolean(acct.suspended) },
    google: { connected: Boolean(google), email: google?.email ?? null, configured: c.var.ctx.google.configured },
    branding: brandingFor(c.var.ctx.db, acct.id),
  })
})

function brandingFor(db: Db, userId: string) {
  const b = db.get<{ brand_name: string | null; brand_logo_url: string | null; brand_color: string | null }>('SELECT brand_name, brand_logo_url, brand_color FROM users WHERE id = ?', [userId])
  return { name: b?.brand_name ?? null, logoUrl: b?.brand_logo_url ?? null, color: b?.brand_color ?? null }
}

/** White-label branding for client reports. The logo is only ever loaded by the user's own browser. */
authRoutes.put('/branding', requireUser, ownerOnly, async (c) => {
  const input = await body(
    c,
    z.object({
      name: z.string().trim().max(60).nullable(),
      logoUrl: z.string().trim().max(500).refine((v) => /^https:\/\/[^\s"'<>]+$/.test(v), 'Logo must be an https:// URL').nullable(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #0F766E').nullable(),
    }),
  )
  if (!getPlan(c.var.account.plan).features.whiteLabel) throw new ApiError(402, 'plan_feature', 'White-label reports are part of the Agency plan')
  c.var.ctx.db.run('UPDATE users SET brand_name = ?, brand_logo_url = ?, brand_color = ? WHERE id = ?', [input.name || null, input.logoUrl || null, input.color, c.var.user.id])
  return c.json({ branding: brandingFor(c.var.ctx.db, c.var.user.id) })
})

/** Always answers 200 so the endpoint can't be used to discover which emails have accounts. */
authRoutes.post('/forgot', async (c) => {
  const { db, config, notifier } = c.var.ctx
  const { email } = await body(c, z.object({ email: z.string().trim().toLowerCase().email() }))
  if (!limiterFor(c.var.ctx).take(`forgot:${ip(c)}`)) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again in a few minutes.')
  const u = db.get<{ id: string; name: string }>('SELECT id, name FROM users WHERE email = ?', [email])
  if (u) {
    const token = randomBytes(32).toString('base64url')
    db.run('INSERT INTO password_resets (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [sha256(token), u.id, now(), addHours(now(), 1)])
    await notifier.email(
      email,
      'Reset your Indexora password',
      `Hi ${u.name.split(' ')[0]},\n\nSomeone (hopefully you) asked to reset your Indexora password. This link works for one hour:\n\n${config.appUrl}/reset-password?token=${token}\n\nIf it wasn't you, ignore this email — your password stays the same.`,
    )
  }
  return c.json({ ok: true })
})

authRoutes.post('/reset', async (c) => {
  const { db } = c.var.ctx
  const input = await body(c, z.object({ token: z.string().min(20).max(200), password: z.string().min(10, 'Use at least 10 characters').max(200) }))
  const row = db.get<{ user_id: string; expires_at: string; used_at: string | null }>('SELECT user_id, expires_at, used_at FROM password_resets WHERE id = ?', [sha256(input.token)])
  if (!row || row.used_at || row.expires_at < now()) throw new ApiError(400, 'invalid_token', 'This reset link is invalid or has expired. Request a new one.')
  const hash = await hashPassword(input.password)
  db.tx(() => {
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id])
    db.run('UPDATE password_resets SET used_at = ? WHERE id = ?', [now(), sha256(input.token)])
    db.run('DELETE FROM sessions WHERE user_id = ?', [row.user_id]) // sign out everywhere
  })
  return c.json({ ok: true })
})

/** Permanently delete the account and everything in it (projects, history, tokens). */
authRoutes.delete('/account', requireUser, async (c) => {
  const { db } = c.var.ctx
  const { password } = await body(c, z.object({ password: z.string().min(1).max(200) }))
  const u = db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [c.var.user.id])!
  if (!(await verifyPassword(password, u.password_hash))) throw new ApiError(401, 'invalid_credentials', 'Password is incorrect')
  db.run('DELETE FROM users WHERE id = ?', [c.var.user.id]) // ON DELETE CASCADE removes the rest
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})
