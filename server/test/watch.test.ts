import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client, fixtureSite, seedProject, seedUser, testCtx } from './helpers.js'
import { checkUptime, selectPriorityPages, sweepWatch } from '../src/services/watch.js'
import { addUrls, checkUrl } from '../src/services/urls.js'

test('uptime: one failure is only "unconfirmed"; two in a row raise a down alert; recovery reports the duration', async (t) => {
  const site = await fixtureSite()
  t.after(() => site.close())
  site.set('/', '<title>Home</title>')
  const { ctx, advance } = testCtx()
  const projectId = seedProject(ctx, seedUser(ctx), '127.0.0.1')
  addUrls(ctx, projectId, [site.url('/')], 'manual')
  ctx.db.run('UPDATE monitored_urls SET http_status = 200')
  const alerts = () => ctx.db.all<{ title: string; severity: string; body: string }>('SELECT title, severity, body FROM alerts ORDER BY rowid')

  assert.deepEqual(await checkUptime(ctx, projectId), { state: 'up' })
  site.set('/', { status: 503, body: 'maintenance' })
  assert.deepEqual(await checkUptime(ctx, projectId), { state: 'unconfirmed' })
  assert.equal(alerts().length, 0, 'a single blip does not alert')
  advance(1 / 60)
  assert.deepEqual(await checkUptime(ctx, projectId), { state: 'down' })
  assert.deepEqual(alerts().map((a) => a.severity), ['critical'])
  assert.match(alerts()[0].title, /is down/)
  assert.equal((await checkUptime(ctx, projectId))?.state, 'down')
  assert.equal(alerts().length, 1, 'no repeat while down')

  advance(0.5)
  site.set('/', '<title>Home</title>')
  await checkUptime(ctx, projectId)
  assert.match(alerts().at(-1)!.title, /is back up/)
  assert.match(alerts().at(-1)!.body ?? '', /about 3[01] minutes/)
  const outage = ctx.db.get<{ ended_at: string | null }>('SELECT ended_at FROM outages')!
  assert.ok(outage.ended_at)
})

test('priority pages: home first, then Search Console clicks, manual pins kept; they run on the fast interval', async () => {
  const { ctx } = testCtx()
  const userId = seedUser(ctx, 'starter') // 5 priority pages, 15-minute watch
  const projectId = seedProject(ctx, userId, 'example.com')
  const paths = ['/', '/a', '/b', '/c', '/d', '/e', '/f', '/very/long/path/page']
  addUrls(ctx, projectId, paths.map((p) => `https://example.com${p}`), 'sitemap')
  const report = { rows: [{ query: 'x', page: 'https://example.com/f', clicks: 90 }, { query: 'y', page: 'https://www.example.com/e/', clicks: 40 }] }
  ctx.db.run("INSERT INTO gsc_cache (project_id, key, body, fetched_at) VALUES (?, 'queries:28d', ?, ?)", [projectId, JSON.stringify(report), ctx.now().toISOString()])
  ctx.db.run("UPDATE monitored_urls SET priority_manual = 1 WHERE url = 'https://example.com/very/long/path/page'")

  selectPriorityPages(ctx, projectId)
  const chosen = ctx.db.all<{ url: string }>('SELECT url FROM monitored_urls WHERE priority = 1 ORDER BY url').map((r) => new URL(r.url).pathname)
  assert.equal(chosen.length, 5)
  for (const p of ['/', '/f', '/e', '/very/long/path/page']) assert.ok(chosen.includes(p), p)

  const home = ctx.db.get<{ id: string }>("SELECT id FROM monitored_urls WHERE url = 'https://example.com/'")!.id
  ctx.fetcher.fetchPage = async () => { throw new Error('offline') } // the schedule is what we're testing
  await checkUrl(ctx, home)
  const next = ctx.db.get<{ next_check_at: string }>('SELECT next_check_at FROM monitored_urls WHERE id = ?', [home])!.next_check_at
  assert.equal(new Date(next).getTime() - ctx.now().getTime(), 15 * 60_000)
})

test('watch sweep follows the plan interval; the deploy hook makes everything due now', async () => {
  const { ctx, advance } = testCtx()
  const api = client(ctx)
  await api.post('/api/auth/signup', { email: 'w@example.com', name: 'W', password: 'correct horse battery' })
  ctx.db.run("UPDATE users SET plan = 'pro'")
  const project = (await api.post('/api/projects', { domain: 'example.com' })).json.project
  let fetches = 0
  ctx.fetcher.fetchPage = async (url: string) => {
    fetches++
    return { url, finalUrl: url, status: 200, headers: new Headers(), body: '<title>x</title>', contentType: 'text/html', redirects: [], timeMs: 50 }
  }
  assert.deepEqual(await sweepWatch(ctx), { uptime: 1, robots: 1 })
  advance(2 / 60)
  assert.deepEqual(await sweepWatch(ctx), { uptime: 0, robots: 0 }, 'Pro watches every 5 minutes')
  advance(4 / 60)
  assert.deepEqual(await sweepWatch(ctx), { uptime: 1, robots: 1 })

  const watch = (await api.get(`/api/projects/${project.id}/watch`)).json
  assert.equal(watch.watchMinutes, 5)
  assert.equal(watch.uptime.state, 'up')
  assert.equal(watch.priority.pages.length, 1, 'home page is watched from the start')
  assert.equal(watch.deployHook, null)

  const hook: string = (await api.post(`/api/projects/${project.id}/deploy-hook`)).json.url
  const token = hook.split('/api/hooks/deploy/')[1]
  const anon = client(ctx)
  const r = await anon.call('POST', `/api/hooks/deploy/${token}`, {}, { origin: '' })
  assert.equal(r.status, 202)
  assert.equal(r.json.queued.pages, 1)
  assert.deepEqual(await sweepWatch(ctx), { uptime: 1, robots: 1 }, 'deploy makes uptime and robots due immediately')
  assert.equal((await anon.call('POST', '/api/hooks/deploy/dep_nope', {})).status, 404)
  void fetches
})

test('pinning a page counts toward the plan’s priority pages', async () => {
  const { ctx } = testCtx()
  const api = client(ctx)
  await api.post('/api/auth/signup', { email: 'p@example.com', name: 'P', password: 'correct horse battery' })
  const project = (await api.post('/api/projects', { domain: 'example.com' })).json.project // free: 1 priority page
  const ids = (await api.post(`/api/projects/${project.id}/urls`, { urls: ['https://example.com/a', 'https://example.com/b'] })).json.created
  assert.equal((await api.post(`/api/urls/${ids[0]}/priority`, { on: true })).json.url.priority, true)
  assert.equal((await api.post(`/api/urls/${ids[1]}/priority`, { on: true })).status, 402)
})
