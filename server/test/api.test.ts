import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client, testCtx } from './helpers.js'

async function signup(api: ReturnType<typeof client>, email = 'ada@example.com') {
  return api.post('/api/auth/signup', { email, name: 'Ada', password: 'correct horse battery' })
}

test('signup → me → logout → login', async () => {
  const { ctx } = testCtx()
  const api = client(ctx)
  const s = await signup(api)
  assert.equal(s.status, 201)
  const me = await api.get('/api/auth/me')
  assert.equal(me.status, 200)
  assert.equal(me.json.user.plan, 'free')
  assert.deepEqual(me.json.usage, { projects: 0, urls: 0, backlinks: 0 })
  await api.post('/api/auth/logout')
  assert.equal((await api.get('/api/auth/me')).status, 401)
  assert.equal((await api.post('/api/auth/login', { email: 'ADA@example.com', password: 'wrong password!' })).status, 401)
  assert.equal((await api.post('/api/auth/login', { email: 'ADA@example.com', password: 'correct horse battery' })).status, 200)
  assert.equal((await api.get('/api/auth/me')).status, 200)
})

test('signup validation and duplicate email', async () => {
  const { ctx } = testCtx()
  const api = client(ctx)
  const bad = await api.post('/api/auth/signup', { email: 'nope', name: '', password: 'short' })
  assert.equal(bad.status, 422)
  assert.equal(bad.json.error.code, 'validation_failed')
  await signup(api)
  assert.equal((await signup(client(ctx))).status, 409)
})

test('passwords are stored hashed, sessions stored as hashes', async () => {
  const { ctx } = testCtx()
  await signup(client(ctx))
  const u = ctx.db.get<{ password_hash: string }>('SELECT password_hash FROM users')!
  assert.match(u.password_hash, /^scrypt\$/)
  assert.ok(!u.password_hash.includes('correct horse'))
  const sid = ctx.db.get<{ id: string }>('SELECT id FROM sessions')!.id
  assert.match(sid, /^[0-9a-f]{64}$/)
})

test('cross-site POST is rejected (CSRF)', async () => {
  const { ctx } = testCtx()
  const api = client(ctx)
  await signup(api)
  const r = await api.post('/api/projects', { domain: 'example.com' }, { origin: 'https://evil.test' })
  assert.equal(r.status, 403)
  assert.equal(r.json.error.code, 'bad_origin')
})

test('projects: create, plan limit, normalisation, isolation between users', async () => {
  const { ctx } = testCtx()
  const a = client(ctx)
  await signup(a)
  const created = await a.post('/api/projects', { domain: 'https://WWW.Example.com/some/path' })
  assert.equal(created.status, 201)
  assert.equal(created.json.project.domain, 'example.com')
  assert.equal(created.json.project.stats.urls, 1, 'homepage is enrolled automatically')
  const second = await a.post('/api/projects', { domain: 'another.com' })
  assert.equal(second.status, 402, 'free plan = 1 project')
  assert.equal(second.json.error.code, 'plan_limit')

  const b = client(ctx)
  await signup(b, 'bob@example.com')
  const pid = created.json.project.id
  assert.equal((await b.get(`/api/projects/${pid}`)).status, 404)
  assert.equal((await b.get(`/api/projects/${pid}/backlinks`)).status, 404)
  assert.equal((await b.del(`/api/projects/${pid}`)).status, 404)
  assert.equal((await b.get('/api/projects')).json.projects.length, 0)
})

test('backlinks: add, import CSV, list with filters', async () => {
  const { ctx } = testCtx()
  const api = client(ctx)
  await signup(api)
  const pid = (await api.post('/api/projects', { domain: 'example.com' })).json.project.id
  const add = await api.post(`/api/projects/${pid}/backlinks`, { links: [{ sourceUrl: 'https://blog.test/a' }, { sourceUrl: 'https://example.com/self' }] })
  assert.equal(add.status, 201)
  assert.equal(add.json.created.length, 1)

  const csv = 'Linking page,Last crawled\nhttps://news.test/x,2026-09-01\nhttps://forum.test/y,2026-09-02\n'
  const imp = await api.post(`/api/projects/${pid}/backlinks/import`, csv, { 'content-type': 'text/csv' })
  assert.equal(imp.status, 201)
  assert.equal(imp.json.format, 'search-console')
  assert.equal(imp.json.created.length, 2)

  const domainsOnly = await api.post(`/api/projects/${pid}/backlinks/import`, 'Site,Linking pages\nnews.test,4\n', { 'content-type': 'text/csv' })
  assert.equal(domainsOnly.status, 422)
  assert.match(domainsOnly.json.error.message, /Latest links/)

  const list = await api.get(`/api/projects/${pid}/backlinks?filter=pending`)
  assert.equal(list.json.total, 3)
  assert.equal(list.json.backlinks[0].status, 'pending')
})

test('notification settings: paid features gated by plan', async () => {
  const { ctx } = testCtx()
  const api = client(ctx)
  await signup(api)
  const r = await api.put('/api/alerts/settings', { slackWebhook: 'https://hooks.slack.com/services/T/B/x' })
  assert.equal(r.status, 402)
  assert.equal((await api.put('/api/alerts/settings', { digest: true, minSeverity: 'critical' })).status, 200)
  const s = await api.get('/api/alerts/settings')
  assert.equal(s.json.settings.digest, 1)
  assert.equal(s.json.settings.minSeverity, 'critical')
})

test('public plans endpoint exposes founding seats', async () => {
  const { ctx } = testCtx()
  const r = await client(ctx).get('/api/billing/plans')
  assert.equal(r.status, 200)
  assert.equal(r.json.founding.left, 100)
  assert.deepEqual(r.json.plans.map((p: { id: string }) => p.id), ['free', 'starter', 'pro', 'agency'])
})

test('Lemon Squeezy webhook: rejects bad signature, upgrades on valid event', async () => {
  const { createHmac } = await import('node:crypto')
  const { ctx } = testCtx()
  ctx.config = { ...ctx.config, lemonSqueezy: { ...ctx.config.lemonSqueezy, webhookSecret: 'whsec', variantPlans: { '42': 'pro:founding' } } }
  const api = client(ctx)
  await signup(api)
  const userId = ctx.db.get<{ id: string }>('SELECT id FROM users')!.id
  const payload = JSON.stringify({
    meta: { event_name: 'subscription_created', custom_data: { user_id: userId } },
    data: { id: 'sub_1', attributes: { variant_id: 42, status: 'active', renews_at: '2026-11-02T00:00:00Z', customer_id: 7 } },
  })
  const bad = await api.post('/api/billing/webhooks/lemonsqueezy', payload, { 'x-signature': 'deadbeef', 'content-type': 'application/json', origin: 'https://lemonsqueezy.com' })
  assert.equal(bad.status, 401)
  const sig = createHmac('sha256', 'whsec').update(payload).digest('hex')
  const ok = await api.post('/api/billing/webhooks/lemonsqueezy', payload, { 'x-signature': sig, 'content-type': 'application/json', origin: 'https://lemonsqueezy.com' })
  assert.equal(ok.status, 200)
  const u = ctx.db.get<{ plan: string; founding: number }>('SELECT plan, founding FROM users')!
  assert.deepEqual({ ...u }, { plan: 'pro', founding: 1 })
})

test('unknown routes and malformed JSON return structured errors', async () => {
  const { ctx } = testCtx()
  const api = client(ctx)
  assert.equal((await api.get('/api/nope')).json.error.code, 'not_found')
  const r = await api.post('/api/auth/login', '{not json', { 'content-type': 'application/json' })
  assert.equal(r.status, 400)
})
