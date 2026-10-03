import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testCtx, seedProject } from './helpers.js'
import { sendActivationEmails } from '../src/services/activation.js'
import type { Ctx } from '../src/context.js'

function signup(ctx: Ctx, email = 'new@example.com') {
  const id = 'usr_' + Math.random().toString(36).slice(2)
  ctx.db.run("INSERT INTO users (id, email, name, password_hash, plan, created_at) VALUES (?, ?, 'Ada Lovelace', 'x', 'free', ?)", [id, email, ctx.now().toISOString()])
  return id
}

test('walks a stalled user through the funnel, one nudge at a time', async () => {
  const { ctx, notifier, advance } = testCtx()
  const userId = signup(ctx)

  advance(12)
  assert.equal((await sendActivationEmails(ctx)).sent, 0, 'too early')

  advance(13)
  await sendActivationEmails(ctx)
  assert.equal(notifier.sent.length, 1)
  assert.match(notifier.sent[0].text, /^Add your site/)
  assert.match(notifier.sent[0].text, /Hi Ada,/)
  assert.match(notifier.sent[0].text, /app\.test\/app\/onboarding/)

  // Same hour again: nothing new.
  advance(1)
  assert.equal((await sendActivationEmails(ctx)).sent, 0)

  // They add a project; on day 3 the backlinks nudge follows.
  seedProject(ctx, userId)
  advance(48)
  await sendActivationEmails(ctx)
  assert.equal(notifier.sent.length, 2)
  assert.match(notifier.sent[1].text, /^Are your backlinks still there/)

  // Google isn't configured in tests, so the GSC nudge never applies.
  advance(24 * 5)
  assert.equal((await sendActivationEmails(ctx)).sent, 0)
})

test('respects opt-out, paying users and accounts older than two weeks', async () => {
  const { ctx, advance } = testCtx()
  const optedOut = signup(ctx, 'quiet@example.com')
  ctx.db.run('INSERT INTO notification_settings (user_id, email) VALUES (?, 0)', [optedOut])
  const paying = signup(ctx, 'paid@example.com')
  ctx.db.run("UPDATE users SET plan = 'starter' WHERE id = ?", [paying])
  ctx.db.run("INSERT INTO users (id, email, name, password_hash, plan, created_at) VALUES ('old', 'old@example.com', 'Old', 'x', 'free', '2025-01-01')")
  advance(30)
  assert.equal((await sendActivationEmails(ctx)).sent, 0)
})

test('spaces nudges at least two days apart', async () => {
  const { ctx, notifier, advance } = testCtx()
  signup(ctx)
  // Skip straight to day 4 without having run the sweep: the user qualifies for the first nudge only.
  advance(24 * 4)
  await sendActivationEmails(ctx)
  advance(24)
  await sendActivationEmails(ctx)
  assert.equal(notifier.sent.length, 1)
})
