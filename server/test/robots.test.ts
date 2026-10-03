import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRobots, diffRobots } from '../src/services/robots.js'
import { addUrls } from '../src/services/urls.js'
import { fixtureSite, seedProject, seedUser, testCtx } from './helpers.js'

test('diffRobots ignores comments and whitespace', () => {
  assert.deepEqual(diffRobots('User-agent: *\n# hi\nDisallow: /a\n', 'User-agent: *\nDisallow: /a  \nDisallow: /blog\n'), { added: ['Disallow: /blog'], removed: [] })
})

test('robots.txt change → critical alert naming the monitored URLs Google can no longer crawl', async (t) => {
  const site = await fixtureSite()
  t.after(() => site.close())
  const { ctx } = testCtx()
  const p = seedProject(ctx, seedUser(ctx), '127.0.0.1')
  addUrls(ctx, p, [site.url('/'), site.url('/blog/post'), site.url('/pricing')])
  ctx.db.run('UPDATE monitored_urls SET http_status = 200')
  site.set('/robots.txt', { body: 'User-agent: *\nDisallow: /admin\n', headers: { 'content-type': 'text/plain' } })
  assert.equal((await checkRobots(ctx, p)).changed, false, 'first snapshot is the baseline')
  assert.equal((await checkRobots(ctx, p)).changed, false, 'unchanged')

  site.set('/robots.txt', { body: 'User-agent: *\nDisallow: /admin\nDisallow: /blog\n', headers: { 'content-type': 'text/plain' } })
  // the fetcher caches robots.txt for its own checks; checkRobots reads the file directly
  const r = await checkRobots(ctx, p)
  assert.equal(r.changed, true)
  assert.deepEqual(r.newlyBlocked, [site.url('/blog/post')])
  const a = ctx.db.get<{ title: string; severity: string; body: string }>('SELECT title, severity, body FROM alerts')!
  assert.equal(a.severity, 'critical')
  assert.match(a.title, /blocks 1 URL from Google/)
  assert.match(a.body, /\/blog\/post/)
  assert.match(a.body, /Added: Disallow: \/blog/)
})
