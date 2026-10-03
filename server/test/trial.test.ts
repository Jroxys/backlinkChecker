import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client, testCtx } from './helpers.js'
import { enforceLimits, processTrials } from '../src/services/plan.js'

async function trialUser() {
  const t = testCtx()
  t.ctx.config = { ...t.ctx.config, trialDays: 14 }
  const api = client(t.ctx)
  await api.post('/api/auth/signup', { email: 'try@example.com', name: 'Tia Trial', password: 'correct horse battery' })
  const userId = t.ctx.db.get<{ id: string }>('SELECT id FROM users')!.id
  return { ...t, api, userId }
}

test('new accounts start a 14-day Pro trial; /me shows it', async () => {
  const { api } = await trialUser()
  const me = (await api.get('/api/auth/me')).json
  assert.equal(me.plan.id, 'pro')
  assert.equal(me.trialEndsAt, '2026-10-16T09:00:00.000Z')
  assert.deepEqual(me.paused, { urls: 0, backlinks: 0 })
})

test('trial: reminder 3 days before, then falls back to free and pauses what no longer fits', async () => {
  const { ctx, api, notifier, advance, userId } = await trialUser()
  const project = (await api.post('/api/projects', { domain: 'example.com' })).json.project
  const links = Array.from({ length: 130 }, (_, i) => ({ sourceUrl: `https://blog${i}.example.org/post` }))
  assert.equal((await api.post(`/api/projects/${project.id}/backlinks`, { links })).status, 201)

  advance(24 * 10)
  assert.deepEqual(await processTrials(ctx), { reminded: 0, ended: 0 })
  advance(24 * 1 + 1)
  assert.deepEqual(await processTrials(ctx), { reminded: 1, ended: 0 })
  assert.match(notifier.sent.at(-1)!.text, /trial ends in 3 days/)
  assert.deepEqual(await processTrials(ctx), { reminded: 0, ended: 0 }, 'reminded once')

  advance(24 * 3)
  assert.deepEqual(await processTrials(ctx), { reminded: 0, ended: 1 })
  assert.match(notifier.sent.at(-1)!.text, /30 monitored items are over the Free limits and now paused/)
  const me = (await api.get('/api/auth/me')).json
  assert.equal(me.plan.id, 'free')
  assert.equal(me.trialEndsAt, null)
  assert.deepEqual(me.paused, { urls: 0, backlinks: 30 })
  // Paused entries are never picked up by the sweep, and the oldest 100 stay active.
  assert.equal(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM backlinks WHERE paused = 1 AND next_check_at IS NOT NULL')!.n, 0)
  const firstPaused = ctx.db.get<{ source_url: string }>('SELECT source_url FROM backlinks WHERE paused = 1 ORDER BY created_at, id LIMIT 1')!
  assert.ok(firstPaused)

  // Upgrading resumes everything.
  ctx.db.run("UPDATE users SET plan = 'starter' WHERE id = ?", [userId])
  assert.deepEqual(enforceLimits(ctx, userId), { paused: 0, resumed: 30 })
  assert.equal(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM backlinks WHERE paused = 0 AND next_check_at IS NOT NULL')!.n, 130)
})

test('subscribing during the trial ends it without a downgrade, and trials are not counted as paying', async () => {
  const { createHmac } = await import('node:crypto')
  const { ctx, advance, userId } = await trialUser()
  ctx.config = { ...ctx.config, adminEmails: ['try@example.com'], lemonSqueezy: { ...ctx.config.lemonSqueezy, webhookSecret: 'whsec', variantPlans: { '1': 'starter' } } }
  const api = client(ctx)
  await api.post('/api/auth/login', { email: 'try@example.com', password: 'correct horse battery' })
  let m = (await api.get('/api/admin/metrics')).json
  assert.equal(m.totals.paying, 0)
  assert.equal(m.totals.trials, 1)

  const payload = JSON.stringify({ meta: { event_name: 'subscription_created', custom_data: { user_id: userId } }, data: { id: 's1', attributes: { variant_id: 1, status: 'active' } } })
  await api.post('/api/billing/webhooks/lemonsqueezy', payload, { 'x-signature': createHmac('sha256', 'whsec').update(payload).digest('hex'), 'content-type': 'application/json' })
  advance(24 * 20)
  assert.deepEqual(await processTrials(ctx), { reminded: 0, ended: 0 })
  assert.equal(ctx.db.get<{ plan: string }>('SELECT plan FROM users')!.plan, 'starter')
  m = (await api.get('/api/admin/metrics')).json
  assert.equal(m.totals.paying, 1)
  assert.equal(m.totals.mrr, 12)
})
