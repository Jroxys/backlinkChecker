import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client, testCtx } from './helpers.js'
import { sendWeeklySummaries } from '../src/services/summary.js'
import { snapshotAll } from '../src/services/stats.js'

test('password reset: emailed token works once, signs out everywhere, reveals nothing for unknown emails', async () => {
  const t = testCtx()
  const api = client(t.ctx)
  await api.post('/api/auth/signup', { email: 'ada@example.com', name: 'Ada', password: 'correct horse battery' })
  assert.equal((await api.post('/api/auth/forgot', { email: 'nobody@example.com' })).status, 200)
  assert.equal(t.notifier.sent.length, 0)
  await api.post('/api/auth/forgot', { email: 'ADA@example.com' })
  const mail = t.notifier.sent.at(-1)!
  const token = mail.text.match(/token=([\w-]+)/)![1]
  assert.equal((await api.post('/api/auth/reset', { token, password: 'a brand new password' })).status, 200)
  assert.equal((await api.get('/api/auth/me')).status, 401, 'existing sessions were revoked')
  assert.equal((await api.post('/api/auth/reset', { token, password: 'another new password' })).status, 400, 'single use')
  assert.equal((await api.post('/api/auth/login', { email: 'ada@example.com', password: 'a brand new password' })).status, 200)
})

test('account deletion requires the password and cascades', async () => {
  const { ctx } = testCtx()
  const api = client(ctx)
  await api.post('/api/auth/signup', { email: 'del@example.com', name: 'Del', password: 'correct horse battery' })
  await api.post('/api/projects', { domain: 'example.com' })
  assert.equal((await api.call('DELETE', '/api/auth/account', { password: 'wrong password' })).status, 401)
  assert.equal((await api.call('DELETE', '/api/auth/account', { password: 'correct horse battery' })).status, 200)
  assert.equal(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM projects')!.n, 0)
  assert.equal(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM monitored_urls')!.n, 0)
})

test('weekly summary goes to users with projects, once per week, respecting email opt-out', async () => {
  const t = testCtx()
  const api = client(t.ctx)
  await api.post('/api/auth/signup', { email: 'sum@example.com', name: 'Sam Smith', password: 'correct horse battery' })
  await api.post('/api/projects', { domain: 'example.com' })
  snapshotAll(t.ctx)
  assert.deepEqual(await sendWeeklySummaries(t.ctx), { sent: 1 })
  assert.match(t.notifier.sent.at(-1)!.text, /example\.com/)
  assert.deepEqual(await sendWeeklySummaries(t.ctx), { sent: 0 }, 'not twice in a week')
  t.advance(24 * 7)
  t.ctx.db.run('UPDATE notification_settings SET email = 0')
  assert.deepEqual(await sendWeeklySummaries(t.ctx), { sent: 0 }, 'opted out')
})
