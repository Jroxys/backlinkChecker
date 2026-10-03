import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client, testCtx } from './helpers.js'
import { sendMonthlyReports } from '../src/services/report.js'

async function setup(plan = 'starter') {
  const t = testCtx()
  const api = client(t.ctx)
  await api.post('/api/auth/signup', { email: 'own@example.com', name: 'Olu Owner', password: 'correct horse battery' })
  t.ctx.db.run('UPDATE users SET plan = ?', [plan])
  const project = (await api.post('/api/projects', { domain: 'client.com' })).json.project
  return { ...t, api, project }
}

test('share link: off by default, public when on, rotates, dies when revoked or plan drops reports', async () => {
  const t = await setup()
  assert.equal((await t.api.get(`/api/projects/${t.project.id}/share`)).json.url, null)
  const url1: string = (await t.api.post(`/api/projects/${t.project.id}/share`)).json.url
  assert.match(url1, /^http:\/\/app\.test\/r\/[\w-]{20,}$/)
  const token1 = url1.split('/r/')[1]

  const anon = client(t.ctx)
  const r = await anon.get(`/api/reports/${token1}`)
  assert.equal(r.status, 200)
  assert.equal(r.json.project.domain, 'client.com')
  assert.equal(r.json.branding, null, 'no white-label below Agency')
  assert.ok(Array.isArray(r.json.audit.issues))

  const token2 = (await t.api.post(`/api/projects/${t.project.id}/share`)).json.url.split('/r/')[1]
  assert.equal((await anon.get(`/api/reports/${token1}`)).status, 404, 'rotated link stops working')
  assert.equal((await anon.get(`/api/reports/${token2}`)).status, 200)

  t.ctx.db.run("UPDATE users SET plan = 'free'")
  assert.equal((await anon.get(`/api/reports/${token2}`)).status, 404)
  t.ctx.db.run("UPDATE users SET plan = 'starter'")
  await t.api.del(`/api/projects/${t.project.id}/share`)
  assert.equal((await anon.get(`/api/reports/${token2}`)).status, 404)
})

test('free plan cannot create share links; agency reports carry branding', async () => {
  const t = await setup('free')
  assert.equal((await t.api.post(`/api/projects/${t.project.id}/share`)).status, 402)
  t.ctx.db.run("UPDATE users SET plan = 'agency', brand_name = 'Northwind', brand_color = '#0F766E'")
  const token = (await t.api.post(`/api/projects/${t.project.id}/share`)).json.url.split('/r/')[1]
  const r = await client(t.ctx).get(`/api/reports/${token}`)
  assert.deepEqual(r.json.branding, { name: 'Northwind', logoUrl: null, color: '#0F766E' })
})

test('monthly report: paid plans, once per month, respects opt-out, includes the client link', async () => {
  const t = await setup()
  const url = (await t.api.post(`/api/projects/${t.project.id}/share`)).json.url
  assert.equal((await sendMonthlyReports(t.ctx)).sent, 1)
  const mail = t.notifier.sent.at(-1)!.text
  assert.match(mail, /^Your monthly SEO report/)
  assert.match(mail, /client\.com/)
  assert.ok(mail.includes(url))
  assert.equal((await sendMonthlyReports(t.ctx)).sent, 0, 'same month')

  t.advance(24 * 31)
  await t.api.put('/api/alerts/settings', { monthlyReport: false })
  assert.equal((await sendMonthlyReports(t.ctx)).sent, 0, 'opted out')

  t.ctx.db.run("UPDATE users SET plan = 'free'")
  await t.api.put('/api/alerts/settings', { monthlyReport: true })
  assert.equal((await sendMonthlyReports(t.ctx)).sent, 0, 'free plan')
})
