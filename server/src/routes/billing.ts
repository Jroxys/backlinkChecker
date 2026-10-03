import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { ApiError, body, ownerOnly, requireUser, router } from '../http.js'
import { plans, type PlanId } from '../plans.js'
import { track } from '../services/events.js'
import { enforceLimits } from '../services/plan.js'

export const FOUNDING_SEATS = 100

export const billingRoutes = router()

/** Public: plan catalogue + how many founding seats are left. */
billingRoutes.get('/plans', (c) => {
  const taken = c.var.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE founding = 1')!.n
  return c.json({ plans: Object.values(plans), founding: { total: FOUNDING_SEATS, left: Math.max(0, FOUNDING_SEATS - taken) } })
})

billingRoutes.post('/checkout', requireUser, ownerOnly, async (c) => {
  const { db, config } = c.var.ctx
  const input = await body(c, z.object({ plan: z.enum(['starter', 'pro', 'agency']), cycle: z.enum(['monthly', 'yearly']) }))
  const taken = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE founding = 1')!.n
  const founding = input.cycle === 'monthly' && taken < FOUNDING_SEATS
  const urls = config.lemonSqueezy.checkoutUrls
  const base = (founding && urls[`${input.plan}_monthly_founding`]) || urls[`${input.plan}_${input.cycle}`]
  if (!base) throw new ApiError(503, 'billing_not_configured', 'Checkout is not configured yet. Set LEMONSQUEEZY_CHECKOUT_URLS.')
  const u = new URL(base)
  u.searchParams.set('checkout[email]', c.var.user.email)
  u.searchParams.set('checkout[name]', c.var.user.name)
  u.searchParams.set('checkout[custom][user_id]', c.var.user.id)
  track(db, 'checkout_started', c.var.user.id)
  return c.json({ url: u.href, founding })
})

billingRoutes.get('/portal', requireUser, ownerOnly, (c) => {
  const url = c.var.ctx.config.lemonSqueezy.customerPortalUrl
  if (!url) throw new ApiError(503, 'billing_not_configured', 'Customer portal is not configured')
  return c.json({ url })
})

/**
 * Lemon Squeezy webhook. Signature = hex HMAC-SHA256 of the raw body with the signing secret.
 * We only trust the plan from our own variant→plan map, never from the payload text.
 */
billingRoutes.post('/webhooks/lemonsqueezy', async (c) => {
  const { db, config } = c.var.ctx
  const secret = config.lemonSqueezy.webhookSecret
  if (!secret) throw new ApiError(503, 'billing_not_configured', 'Webhook secret not set')
  const raw = await c.req.text()
  const sig = c.req.header('x-signature') ?? ''
  const expected = createHmac('sha256', secret).update(raw).digest('hex')
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new ApiError(401, 'bad_signature', 'Invalid signature')

  const evt = JSON.parse(raw) as {
    meta: { event_name: string; custom_data?: { user_id?: string } }
    data: { id?: string | number; attributes: { variant_id?: number; status?: string; renews_at?: string | null; ends_at?: string | null; customer_id?: number } }
  }
  const userId = evt.meta.custom_data?.user_id
  if (!userId) return c.json({ ignored: 'no user id' })
  const user = db.get<{ id: string; subscription_id: string | null }>('SELECT id, subscription_id FROM users WHERE id = ?', [userId])
  if (!user) return c.json({ ignored: 'unknown user' })
  const a = evt.data.attributes
  const subId = evt.data.id === undefined ? null : String(evt.data.id)
  // Variant map values are "pro" or "pro:founding". Founding comes from what was bought, never from client-editable checkout data.
  const [planKey, tag] = (config.lemonSqueezy.variantPlans[String(a.variant_id)] ?? '').split(':')
  const plan = planKey && planKey in plans && planKey !== 'free' ? (planKey as PlanId) : undefined
  const founding = tag === 'founding'
  // "cancelled" means it won't renew; the customer keeps what they paid for until it expires.
  const paid = ['active', 'on_trial', 'past_due', 'cancelled'].includes(a.status ?? '')
  // Only the subscription the plan currently comes from may change it (late or replayed events for an old one are ignored).
  const current = !user.subscription_id || !subId || user.subscription_id === subId
  const name = evt.meta.event_name

  switch (name) {
    case 'subscription_created':
    case 'subscription_updated':
    case 'subscription_resumed':
      if (name !== 'subscription_created' && !current) return c.json({ ignored: 'not the current subscription' })
      if (plan && paid) {
        if (name === 'subscription_created') track(db, 'subscribed', userId)
        db.run(
          'UPDATE users SET plan = ?, plan_renews_at = ?, billing_customer_id = COALESCE(?, billing_customer_id), subscription_id = COALESCE(?, subscription_id), trial_ends_at = NULL, founding = CASE WHEN ? = 1 THEN 1 ELSE founding END WHERE id = ?',
          [plan, a.ends_at ?? a.renews_at ?? null, a.customer_id ? String(a.customer_id) : null, subId, founding ? 1 : 0, userId],
        )
      } else if (!paid && user.subscription_id && current) db.run("UPDATE users SET plan = 'free', plan_renews_at = NULL WHERE id = ?", [userId])
      // No subscription on file (free or on the trial): a failed checkout changes nothing.
      break
    case 'subscription_expired':
      if (!current || !user.subscription_id) return c.json({ ignored: 'not the current subscription' })
      db.run("UPDATE users SET plan = 'free', plan_renews_at = NULL, subscription_id = NULL WHERE id = ?", [userId])
      break
    default:
      return c.json({ ignored: name })
  }
  // Pause what no longer fits after a downgrade; resume paused entries after an upgrade.
  enforceLimits(c.var.ctx, userId)
  return c.json({ ok: true })
})
