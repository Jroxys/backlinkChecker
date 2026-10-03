import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client, testCtx } from './helpers.js'

test('admin metrics: hidden from normal users, funnel and MRR for admins', async () => {
  const { ctx } = testCtx()
  ctx.config = { ...ctx.config, adminEmails: ['boss@example.com'] }
  const user = client(ctx)
  await user.post('/api/auth/signup', { email: 'u@example.com', name: 'U', password: 'correct horse battery' })
  await user.post('/api/projects', { domain: 'example.com' })
  assert.equal((await user.get('/api/admin/metrics')).status, 404, 'looks like it does not exist')
  ctx.db.run("UPDATE users SET plan = 'pro', founding = 1")

  const boss = client(ctx)
  await boss.post('/api/auth/signup', { email: 'boss@example.com', name: 'Boss', password: 'correct horse battery' })
  assert.equal((await boss.get('/api/auth/me')).json.user.isAdmin, true)
  const m = await boss.get('/api/admin/metrics')
  assert.equal(m.status, 200)
  assert.equal(m.json.funnel[0].users, 2)
  assert.equal(m.json.funnel[1].users, 1)
  assert.equal(m.json.totals.mrr, 19, 'founding Pro = $19')
})
