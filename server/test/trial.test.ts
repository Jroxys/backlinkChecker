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

test('review regressions: paused rows stay paused through scans and rechecks; deletes free room; extra projects pause', async () => {
  const { ctx, api, advance } = await trialUser()
  const p1 = (await api.post('/api/projects', { domain: 'one.example' })).json.project
  const p2 = (await api.post('/api/projects', { domain: 'two.example' })).json.project
  const links = Array.from({ length: 110 }, (_, i) => ({ sourceUrl: `https://blog${i}.example.org/post` }))
  await api.post(`/api/projects/${p1.id}/backlinks`, { links })
  await api.post(`/api/projects/${p2.id}/backlinks`, { links: [{ sourceUrl: 'https://x.example.org/a' }] })
  advance(24 * 15)
  await processTrials(ctx)

  const projects = ctx.db.all<{ id: string; paused: number }>('SELECT id, paused FROM projects ORDER BY created_at, id')
  assert.deepEqual(projects.map((p) => p.paused), [0, 1], 'free plan: one project')
  assert.equal(ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM backlinks WHERE paused = 1")!.n, 11, '10 over the limit + the paused project’s link')

  assert.equal((await api.post(`/api/projects/${p1.id}/scan`)).json.queued.backlinks, 100)
  assert.equal((await api.post(`/api/projects/${p2.id}/scan`)).status, 402)
  assert.equal(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM backlinks WHERE paused = 1 AND next_check_at IS NOT NULL')!.n, 0)
  const pausedId = ctx.db.get<{ id: string }>("SELECT b.id FROM backlinks b WHERE b.paused = 1 AND b.project_id = ?", [p1.id])!.id
  assert.equal((await api.post(`/api/backlinks/${pausedId}/recheck`)).status, 402)
  assert.equal((await api.post(`/api/projects/${p2.id}/backlinks`, { links: [{ sourceUrl: 'https://y.example.org/b' }] })).json.skipped[0].reason, 'plan_limit')

  // Deleting active links frees room: the paused ones (oldest first) resume.
  const active = ctx.db.all<{ id: string }>('SELECT id FROM backlinks WHERE paused = 0 LIMIT 5')
  for (const a of active) await api.del(`/api/backlinks/${a.id}`)
  assert.equal(ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM backlinks WHERE paused = 0")!.n, 100)
})

test('review regressions: Slack/webhook delivery follows the current plan; a failed checkout doesn’t end a trial', async () => {
  const { createHmac } = await import('node:crypto')
  const { deliverPendingAlerts } = await import('../src/services/notifier.js')
  const { ctx, api, notifier, userId } = await trialUser()
  await api.put('/api/alerts/settings', { slackWebhook: 'https://hooks.slack.com/services/T/B/x' })
  ctx.db.run("INSERT INTO alerts (id, user_id, kind, severity, title, body, created_at) VALUES ('a1', ?, 'technical', 'critical', 'Boom', 'b', ?)", [userId, ctx.now().toISOString()])
  ctx.db.run("UPDATE users SET plan = 'free', trial_ends_at = NULL")
  await deliverPendingAlerts(ctx)
  assert.ok(!notifier.sent.some((m) => m.channel === 'slack'), 'no Slack on Free')

  ctx.db.run("UPDATE users SET plan = 'pro', trial_ends_at = '2026-10-16T09:00:00.000Z'")
  ctx.config = { ...ctx.config, lemonSqueezy: { ...ctx.config.lemonSqueezy, webhookSecret: 'whsec', variantPlans: { '1': 'pro' } } }
  const payload = JSON.stringify({ meta: { event_name: 'subscription_created', custom_data: { user_id: userId } }, data: { id: 's1', attributes: { variant_id: 1, status: 'unpaid' } } })
  await api.post('/api/billing/webhooks/lemonsqueezy', payload, { 'x-signature': createHmac('sha256', 'whsec').update(payload).digest('hex'), 'content-type': 'application/json' })
  assert.deepEqual({ ...ctx.db.get('SELECT plan, trial_ends_at FROM users') }, { plan: 'pro', trial_ends_at: '2026-10-16T09:00:00.000Z' })
})
