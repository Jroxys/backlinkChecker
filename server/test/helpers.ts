import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from '../src/app.js'
import { config } from '../src/config.js'
import type { Ctx } from '../src/context.js'
import { openDb } from '../src/db/index.js'
import { PoliteFetcher } from '../src/lib/fetcher.js'
import { createGoogleClient, type GoogleClient } from '../src/services/google.js'
import { memoryNotifier } from '../src/services/notifier.js'

export interface Route {
  status?: number
  body?: string
  headers?: Record<string, string>
}

/** A tiny local website whose pages tests can rewrite between checks. */
export async function fixtureSite() {
  const routes = new Map<string, Route>()
  const hits: string[] = []
  const server: Server = createServer((req, res) => {
    hits.push(req.url ?? '/')
    const r = routes.get(req.url ?? '/') ?? { status: 404, body: 'not found' }
    res.writeHead(r.status ?? 200, { 'content-type': 'text/html; charset=utf-8', ...r.headers })
    res.end(r.body ?? '')
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  const port = (server.address() as AddressInfo).port
  return {
    origin: `http://127.0.0.1:${port}`,
    url: (path: string) => `http://127.0.0.1:${port}${path}`,
    set: (path: string, r: Route | string) => routes.set(path, typeof r === 'string' ? { body: r } : r),
    hits,
    close: () =>
      new Promise<void>((ok) => {
        if (!server.listening) return ok()
        server.closeAllConnections()
        server.close(() => ok())
      }),
  }
}

export function testCtx(overrides: Partial<Ctx> = {}) {
  const db = openDb(':memory:')
  const notifier = memoryNotifier()
  let clock = new Date('2026-10-02T09:00:00Z')
  const ctx: Ctx = {
    db,
    config: { ...config, appUrl: 'http://app.test', apiUrl: 'http://api.test' },
    fetcher: new PoliteFetcher({ userAgent: 'IndexoraBot-test', allowPrivate: true, perHostDelayMs: 0, timeoutMs: 3000 }),
    notifier,
    provider: null,
    google: createGoogleClient('', '') as GoogleClient,
    probes: {
      certificate: async (host) => ({ host, expiresAt: null, issuer: null, error: 'ECONNREFUSED' }),
      domain: async () => ({ expiresAt: null, registrar: null }),
    },
    now: () => clock,
    ...overrides,
  }
  return {
    ctx,
    notifier,
    advance(hours: number) {
      clock = new Date(clock.getTime() + hours * 3_600_000)
    },
  }
}

export function seedUser(ctx: Ctx, plan = 'pro', email = 'owner@example.com') {
  const userId = 'usr_' + Math.random().toString(36).slice(2)
  ctx.db.run("INSERT INTO users (id, email, name, password_hash, plan, created_at) VALUES (?, ?, 'Owner', 'x', ?, '2026-01-01')", [userId, email, plan])
  return userId
}

export function seedProject(ctx: Ctx, userId: string, domain = '127.0.0.1') {
  const projectId = 'prj_' + Math.random().toString(36).slice(2)
  ctx.db.run("INSERT INTO projects (id, user_id, name, domain, created_at) VALUES (?, ?, 'Test', ?, '2026-01-01')", [projectId, userId, domain])
  return projectId
}

/** HTTP client against the Hono app with a cookie jar. */
export function client(ctx: Ctx) {
  const app = createApp(ctx)
  let cookie = ''
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(path, {
      method,
      headers: {
        ...(body !== undefined && typeof body !== 'string' ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        origin: ctx.config.appUrl,
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    const json = (await res.json().catch(() => null)) as any
    return { status: res.status, json }
  }
  return {
    get: (p: string) => call('GET', p),
    post: (p: string, b?: unknown, h?: Record<string, string>) => call('POST', p, b ?? {}, h),
    put: (p: string, b?: unknown) => call('PUT', p, b ?? {}),
    patch: (p: string, b?: unknown) => call('PATCH', p, b ?? {}),
    del: (p: string) => call('DELETE', p),
    call,
    clearCookie: () => (cookie = ''),
  }
}
