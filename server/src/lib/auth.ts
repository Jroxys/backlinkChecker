import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { Db } from '../db/index.js'
import { addHours, now } from './ids.js'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>
const PARAMS = { N: 16384, r: 8, p: 1 }

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, 32, PARAMS)
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, n, r, p, salt, key] = stored.split('$')
  if (alg !== 'scrypt') return false
  const expected = Buffer.from(key, 'base64')
  const got = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) })
  return got.length === expected.length && timingSafeEqual(got, expected)
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const SESSION_COOKIE = 'ix_session'
const SESSION_DAYS = 30

/** Creates a session and returns the raw token for the cookie. Only its hash is stored. */
export function createSession(db: Db, userId: string) {
  const token = randomBytes(32).toString('base64url')
  db.run('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [sha256(token), userId, now(), addHours(now(), SESSION_DAYS * 24)])
  return { token, maxAge: SESSION_DAYS * 86400 }
}

export interface SessionUser {
  id: string
  email: string
  name: string
  plan: string
  founding: number
  created_at: string
}

export function userForToken(db: Db, token: string | undefined): SessionUser | null {
  if (!token) return null
  const row = db.get<SessionUser & { expires_at: string }>(
    `SELECT u.id, u.email, u.name, u.plan, u.founding, u.created_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    [sha256(token)],
  )
  if (!row || row.expires_at < now()) return null
  const { expires_at: _e, ...user } = row
  return user
}

export function destroySession(db: Db, token: string | undefined) {
  if (token) db.run('DELETE FROM sessions WHERE id = ?', [sha256(token)])
}

/** Tiny fixed-window limiter for login/signup. In-memory is fine for a single instance. */
export class RateLimiter {
  private hits = new Map<string, { count: number; reset: number }>()
  constructor(
    private max: number,
    private windowMs: number,
  ) {}
  take(key: string) {
    const t = Date.now()
    const e = this.hits.get(key)
    if (!e || e.reset < t) {
      this.hits.set(key, { count: 1, reset: t + this.windowMs })
      return true
    }
    e.count++
    return e.count <= this.max
  }
}
