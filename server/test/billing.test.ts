import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { client, testCtx } from './helpers.js'

async function setup() {
  const { ctx } = testCtx()
  ctx.config = { ...ctx.config, lemonSqueezy: { ...ctx.config.lemonSqueezy, webhookSecret: 'whsec', variantPlans: { '10': 'pro', '11': 'pro:founding', '20': 'agency' } } }
  const api = client(ctx)
  await api.post('/api/auth/signup', { email: 'pay@example.com', name: 'Pay', password: 'correct horse battery' })
  const userId = ctx.db.get<{ id: string }>('SELECT id FROM users')!.id
  const send = async (event: string, subId: string, attributes: Record<string, unknown>, custom: Record<string, string> = {}) => {
    const payload = JSON.stringify({ meta: { event_name: event, custom_data: { user_id: userId, ...custom } }, data: { id: subId, attributes } })
    const sig = createHmac('sha256', 'whsec').update(payload).digest('hex')
    return api.post('/api/billing/webhooks/lemonsqueezy', payload, { 'x-signature': sig, 'content-type': 'application/json' })
  }
  const user = () => ctx.db.get<{ plan: string; founding: number; subscription_id: string | null }>('SELECT plan, founding, subscription_id FROM users')!
  return { send, user }
}

test('cancelling keeps the paid plan until the subscription expires', async () => {
  const { send, user } = await setup()
  await send('subscription_created', 's1', { variant_id: 10, status: 'active' })
  assert.equal(user().plan, 'pro')
  await send('subscription_updated', 's1', { variant_id: 10, status: 'cancelled', ends_at: '2026-11-01T00:00:00Z' })
  assert.equal(user().plan, 'pro', 'still paid for this period')
  await send('subscription_expired', 's1', { variant_id: 10, status: 'expired' })
  assert.equal(user().plan, 'free')
})

test('founding status comes from the variant, not from checkout custom data', async () => {
  const { send, user } = await setup()
  await send('subscription_created', 's1', { variant_id: 10, status: 'active' }, { founding: '1' })
  assert.equal(user().founding, 0, 'forged custom_data is ignored')
  await send('subscription_created', 's2', { variant_id: 11, status: 'active' })
  assert.equal(user().founding, 1)
})

test('late events for an old subscription do not touch the current plan', async () => {
  const { send, user } = await setup()
  await send('subscription_created', 'old', { variant_id: 10, status: 'active' })
  await send('subscription_created', 'new', { variant_id: 20, status: 'active' })
  assert.deepEqual({ ...user(), founding: undefined }, { plan: 'agency', founding: undefined, subscription_id: 'new' })
  await send('subscription_expired', 'old', { variant_id: 10, status: 'expired' })
  await send('subscription_updated', 'old', { variant_id: 10, status: 'active' })
  assert.equal(user().plan, 'agency')
  await send('subscription_updated', 'new', { variant_id: 20, status: 'unpaid' })
  assert.equal(user().plan, 'free')
})
