import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client, testCtx } from './helpers.js'

async function proUser() {
  const { ctx } = testCtx()
  const api = client(ctx)
  await api.post('/api/auth/signup', { email: 'dev@example.com', name: 'Dev', password: 'correct horse battery' })
  ctx.db.run("UPDATE users SET plan = 'pro'")
  return { ctx, api, bot: client(ctx) }
}

test('API keys: Pro only, shown once, authenticate as the owner, revocable', async () => {
  const { ctx, api, bot } = await proUser()
  ctx.db.run("UPDATE users SET plan = 'starter'")
  assert.equal((await api.post('/api/keys', { name: 'CI' })).status, 402)
  ctx.db.run("UPDATE users SET plan = 'pro'")

  const created = await api.post('/api/keys', { name: 'CI' })
  assert.equal(created.status, 201)
  const token: string = created.json.token
  assert.match(token, /^ix_/)
  assert.equal(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM api_keys WHERE hash = ?', [token])!.n, 0, 'plaintext never stored')
  const list = await api.get('/api/keys')
  assert.equal(list.json.keys.length, 1)
  assert.equal(list.json.keys[0].token, undefined)

  const auth = { authorization: `Bearer ${token}` }
  await api.post('/api/projects', { domain: 'example.com' })
  const projects = await bot.call('GET', '/api/projects', undefined, auth)
  assert.equal(projects.status, 200)
  assert.equal(projects.json.projects.length, 1)
  assert.equal((await bot.call('GET', '/api/auth/me', undefined, auth)).status, 200)
  assert.ok(ctx.db.get<{ last_used_at: string }>('SELECT last_used_at FROM api_keys')!.last_used_at)

  await api.del(`/api/keys/${created.json.key.id}`)
  assert.equal((await bot.call('GET', '/api/projects', undefined, auth)).status, 401)
})

test('API keys cannot manage the account, billing or other keys', async () => {
  const { api, bot } = await proUser()
  const { token } = (await api.post('/api/keys', { name: 'x' })).json
  const auth = { authorization: `Bearer ${token}` }
  assert.equal((await bot.call('POST', '/api/keys', { name: 'y' }, auth)).status, 403)
  assert.equal((await bot.call('GET', '/api/keys', undefined, auth)).status, 403)
  assert.equal((await bot.call('DELETE', '/api/auth/account', { password: 'correct horse battery' }, auth)).status, 403)
  assert.equal((await bot.call('POST', '/api/billing/checkout', { plan: 'agency' }, auth)).status, 403)
  assert.equal((await bot.call('GET', '/api/google/connect', undefined, auth)).status, 403)
})

test('API keys stop working after a downgrade and reject garbage', async () => {
  const { ctx, api, bot } = await proUser()
  const { token } = (await api.post('/api/keys', { name: 'x' })).json
  ctx.db.run("UPDATE users SET plan = 'free'")
  assert.equal((await bot.call('GET', '/api/projects', undefined, { authorization: `Bearer ${token}` })).status, 402)
  assert.equal((await bot.call('GET', '/api/projects', undefined, { authorization: 'Bearer ix_nope' })).status, 401)
})

test('white-label branding: Agency only, https logos only, returned by /me', async () => {
  const { ctx, api } = await proUser()
  const brand = { name: 'Northwind SEO', logoUrl: 'https://northwind.example/logo.svg', color: '#0F766E' }
  assert.equal((await api.put('/api/auth/branding', brand)).status, 402)
  ctx.db.run("UPDATE users SET plan = 'agency'")
  assert.equal((await api.put('/api/auth/branding', { ...brand, logoUrl: 'javascript:alert(1)' })).status, 422)
  assert.equal((await api.put('/api/auth/branding', { ...brand, color: 'red' })).status, 422)
  assert.equal((await api.put('/api/auth/branding', brand)).status, 200)
  assert.deepEqual((await api.get('/api/auth/me')).json.branding, brand)
  assert.equal((await api.put('/api/auth/branding', { name: null, logoUrl: null, color: null })).status, 200)
  assert.deepEqual((await api.get('/api/auth/me')).json.branding, { name: null, logoUrl: null, color: null })
})

test('a key request is authenticated once, even when several routers match the path', async () => {
  const { ctx, api, bot } = await proUser()
  const { token } = (await api.post('/api/keys', { name: 'x' })).json
  const project = (await api.post('/api/projects', { domain: 'example.com' })).json.project
  const auth = { authorization: `Bearer ${token}` }
  for (let i = 0; i < 60; i++) assert.equal((await bot.call('GET', `/api/projects/${project.id}/report`, undefined, auth)).status, 200, `request ${i}`)
  assert.equal((await bot.call('PUT', '/api/alerts/settings', { webhookUrl: 'https://evil.example/hook' }, auth)).status, 403, 'keys cannot redirect alerts')
  assert.equal((await bot.call('PUT', '/api/alerts/settings', { minSeverity: 'critical' }, auth)).status, 200)
  void ctx
})
