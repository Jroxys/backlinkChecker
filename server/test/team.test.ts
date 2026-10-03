import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client, testCtx } from './helpers.js'

async function agency() {
  const t = testCtx()
  const owner = client(t.ctx)
  await owner.post('/api/auth/signup', { email: 'boss@agency.com', name: 'Bo Boss', password: 'correct horse battery' })
  t.ctx.db.run("UPDATE users SET plan = 'pro' WHERE email = 'boss@agency.com'") // 3 seats
  const project = (await owner.post('/api/projects', { domain: 'client.com' })).json.project
  return { ...t, owner, project }
}

async function invite(t: Awaited<ReturnType<typeof agency>>, email: string) {
  const r = await t.owner.post('/api/team/invites', { email })
  assert.equal(r.status, 201, JSON.stringify(r.json))
  return t.notifier.sent.at(-1)!.text.match(/token=([\w-]+)/)![1]
}

test('invite → join → member works inside the owner workspace', async () => {
  const t = await agency()
  const token = await invite(t, 'Sam@Agency.com')
  assert.match(t.notifier.sent.at(-1)!.text, /Bo Boss invited you/)

  const sam = client(t.ctx)
  const preview = await sam.get(`/api/team/invite?token=${token}`)
  assert.deepEqual(preview.json, { ownerName: 'Bo Boss', email: 'sam@agency.com', expired: false })

  await sam.post('/api/auth/signup', { email: 'sam@agency.com', name: 'Sam', password: 'correct horse battery' })
  assert.equal((await sam.post('/api/team/join', { token })).status, 200)
  assert.equal((await sam.post('/api/team/join', { token })).status, 404, 'single use')

  const me = (await sam.get('/api/auth/me')).json
  assert.equal(me.plan.id, 'pro')
  assert.deepEqual(me.team, { role: 'member', ownerName: 'Bo Boss', suspended: false })
  assert.equal(me.usage.projects, 1)

  const projects = (await sam.get('/api/projects')).json.projects
  assert.equal(projects.length, 1)
  assert.equal(projects[0].id, t.project.id)
  assert.equal((await sam.post(`/api/projects/${t.project.id}/backlinks`, { links: [{ sourceUrl: 'https://blog.example/post' }] })).status, 201)

  // Account-level actions stay with the owner.
  assert.equal((await sam.post('/api/billing/checkout', { plan: 'agency', cycle: 'monthly' })).status, 403)
  assert.equal((await sam.get('/api/google/connect')).status, 403)
  assert.equal((await sam.post('/api/team/invites', { email: 'x@y.com' })).status, 403)

  const team = (await t.owner.get('/api/team')).json
  assert.equal(team.members.length, 1)
  assert.deepEqual(team.seats, { used: 2, limit: 3 })

  // Removing the member cuts access immediately.
  await t.owner.del(`/api/team/members/${team.members[0].id}`)
  assert.equal((await sam.get('/api/projects')).json.projects.length, 0)
})

test('invites respect seats, the invited email and existing projects', async () => {
  const t = await agency()
  await invite(t, 'a@agency.com')
  const tokenB = await invite(t, 'b@agency.com')
  const third = await t.owner.post('/api/team/invites', { email: 'c@agency.com' })
  assert.equal(third.status, 402, 'owner + 2 pending invites = 3 seats')

  const wrong = client(t.ctx)
  await wrong.post('/api/auth/signup', { email: 'mallory@evil.com', name: 'M', password: 'correct horse battery' })
  assert.equal((await wrong.post('/api/team/join', { token: tokenB })).status, 403)

  const b = client(t.ctx)
  await b.post('/api/auth/signup', { email: 'b@agency.com', name: 'B', password: 'correct horse battery' })
  await b.post('/api/projects', { domain: 'mine.com' })
  assert.equal((await b.post('/api/team/join', { token: tokenB })).status, 409)

  t.ctx.db.run("UPDATE users SET plan = 'starter' WHERE email = 'boss@agency.com'")
  assert.equal((await t.owner.post('/api/team/invites', { email: 'd@agency.com' })).status, 402)
})

test('downgrade suspends members beyond the seat limit without deleting them; they can still leave', async () => {
  const t = await agency()
  const token = await invite(t, 'sam@agency.com')
  const sam = client(t.ctx)
  await sam.post('/api/auth/signup', { email: 'sam@agency.com', name: 'Sam', password: 'correct horse battery' })
  await sam.post('/api/team/join', { token })

  t.ctx.db.run("UPDATE users SET plan = 'starter' WHERE email = 'boss@agency.com'")
  assert.equal((await sam.get('/api/projects')).status, 402)
  assert.equal((await sam.get('/api/auth/me')).json.team.suspended, true)

  t.ctx.db.run("UPDATE users SET plan = 'pro' WHERE email = 'boss@agency.com'")
  assert.equal((await sam.get('/api/projects')).status, 200, 'upgrading restores access')

  assert.equal((await sam.post('/api/team/leave')).status, 204)
  assert.equal((await sam.get('/api/auth/me')).json.team.role, 'owner')
})

test('review regressions: re-invite at the limit keeps the invite, members can’t touch alert settings, no nudges for members', async () => {
  const t = await agency()
  await invite(t, 'a@agency.com')
  await invite(t, 'b@agency.com')
  t.ctx.db.run("UPDATE users SET plan = 'starter' WHERE email = 'boss@agency.com'")
  assert.equal((await t.owner.post('/api/team/invites', { email: 'a@agency.com' })).status, 402)
  assert.equal(t.ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM team_invites WHERE email = 'a@agency.com'")!.n, 1, 'invite not lost')
  t.ctx.db.run("UPDATE users SET plan = 'pro' WHERE email = 'boss@agency.com'")
  assert.equal((await t.owner.post('/api/team/invites', { email: 'a@agency.com' })).status, 201, 're-invite at the limit replaces, not adds')

  const token = await invite(t, 'b@agency.com')
  const sam = client(t.ctx)
  await sam.post('/api/auth/signup', { email: 'b@agency.com', name: 'B', password: 'correct horse battery' })
  await sam.post('/api/team/join', { token })
  assert.equal((await sam.put('/api/alerts/settings', { webhookUrl: 'https://evil.example/hook' })).status, 403)
  assert.equal((await sam.put('/api/alerts/settings', { email: false })).status, 403)

  const { sendActivationEmails } = await import('../src/services/activation.js')
  t.advance(30)
  await sendActivationEmails(t.ctx)
  assert.ok(!t.notifier.sent.some((m) => m.to === 'b@agency.com' && /Add your site/.test(m.text)))
})
