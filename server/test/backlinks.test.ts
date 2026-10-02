import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addBacklinks, sweepDueBacklinks, verifyBacklink, alertForEvents, type BacklinkRow } from '../src/services/backlinks.js'
import { fixtureSite, seedProject, seedUser, testCtx } from './helpers.js'

const withLink = (rel = '') => `<html><body><p>Great tools: <a ${rel ? `rel="${rel}"` : ''} href="https://example.com/tool">Example Tool</a></p></body></html>`
const withoutLink = '<html><body><p>Nothing here anymore.</p></body></html>'

async function setup(plan = 'pro') {
  const site = await fixtureSite()
  const t = testCtx()
  const user = seedUser(t.ctx, plan)
  const project = seedProject(t.ctx, user, 'example.com')
  return { site, ...t, user, project }
}

const row = (ctx: ReturnType<typeof testCtx>['ctx'], id: string) => ctx.db.get<BacklinkRow>('SELECT * FROM backlinks WHERE id = ?', [id])!
const alerts = (ctx: ReturnType<typeof testCtx>['ctx']) => ctx.db.all<{ title: string; severity: string }>('SELECT title, severity FROM alerts ORDER BY created_at, rowid')

test('full lifecycle: verified → missing once (kept) → lost → recovered', async () => {
  const { site, ctx } = await setup()
  site.set('/post', withLink())
  const { created } = addBacklinks(ctx, ctx.db.get<{ id: string }>('SELECT id FROM projects')!.id, [{ sourceUrl: site.url('/post'), authority: 72 }])
  const id = created[0]

  let ev = await verifyBacklink(ctx, id)
  assert.deepEqual(ev.map((e) => e.type), ['verified'])
  let b = row(ctx, id)
  assert.equal(b.status, 'active')
  assert.equal(b.rel, 'dofollow')
  assert.equal(b.anchor, 'Example Tool')
  assert.equal(b.found_target, 'https://example.com/tool')
  assert.ok(b.first_seen)

  site.set('/post', withoutLink)
  ev = await verifyBacklink(ctx, id)
  assert.equal(ev.length, 0, 'a single miss must not raise an alert')
  b = row(ctx, id)
  assert.equal(b.status, 'active')
  assert.equal(b.miss_count, 1)

  ev = await verifyBacklink(ctx, id)
  assert.deepEqual(ev.map((e) => e.type), ['lost'])
  alertForEvents(ctx, ev)
  assert.equal(row(ctx, id).status, 'lost')
  assert.equal(alerts(ctx).at(-1)!.severity, 'critical')
  assert.match(alerts(ctx).at(-1)!.title, /1 backlink was lost/)

  site.set('/post', withLink())
  ev = await verifyBacklink(ctx, id)
  assert.deepEqual(ev.map((e) => e.type), ['recovered'])
  assert.equal(row(ctx, id).miss_count, 0)
  assert.equal(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM backlink_checks WHERE backlink_id = ?', [id])!.n, 4)
  await site.close()
})

test('dofollow → nofollow raises a rel change event', async () => {
  const { site, ctx, project } = await setup()
  site.set('/p', withLink())
  const [id] = addBacklinks(ctx, project, [{ sourceUrl: site.url('/p') }]).created
  await verifyBacklink(ctx, id)
  site.set('/p', withLink('nofollow'))
  const ev = await verifyBacklink(ctx, id)
  assert.equal(ev[0].type, 'rel_changed')
  alertForEvents(ctx, ev)
  assert.match(alerts(ctx)[0].title, /changed from dofollow to nofollow/)
  await site.close()
})

test('linking page 404 twice → broken', async () => {
  const { site, ctx, project } = await setup()
  site.set('/gone', withLink())
  const [id] = addBacklinks(ctx, project, [{ sourceUrl: site.url('/gone') }]).created
  await verifyBacklink(ctx, id)
  site.set('/gone', { status: 404, body: 'nope' })
  await verifyBacklink(ctx, id)
  const ev = await verifyBacklink(ctx, id)
  assert.equal(ev[0].type, 'broken')
  assert.equal(row(ctx, id).status, 'broken')
  assert.equal(row(ctx, id).http_status, 404)
  await site.close()
})

test('robots.txt disallowing our bot → blocked, never "lost"', async () => {
  const { site, ctx, project } = await setup()
  site.set('/robots.txt', { body: 'User-agent: *\nDisallow: /private/', headers: { 'content-type': 'text/plain' } })
  site.set('/private/p', withLink())
  const [id] = addBacklinks(ctx, project, [{ sourceUrl: site.url('/private/p') }]).created
  const ev = await verifyBacklink(ctx, id)
  assert.equal(ev.length, 0)
  assert.equal(row(ctx, id).status, 'blocked')
  assert.ok(!site.hits.includes('/private/p'), 'must not fetch a disallowed page')
  await site.close()
})

test('expected target missing but other link to domain present', async () => {
  const { site, ctx, project } = await setup()
  site.set('/p', withLink())
  const [id] = addBacklinks(ctx, project, [{ sourceUrl: site.url('/p'), targetUrl: 'https://example.com/other' }]).created
  await verifyBacklink(ctx, id)
  assert.match(row(ctx, id).last_error!, /not to the expected URL/)
  await site.close()
})

test('addBacklinks rejects internal links, bad targets, duplicates and over-limit rows', async () => {
  const { ctx, project, site } = await setup('free') // free = 100 backlinks
  await site.close()
  const r = addBacklinks(ctx, project, [
    { sourceUrl: 'https://blog.test/a' },
    { sourceUrl: 'https://blog.test/a' },
    { sourceUrl: 'https://example.com/self' },
    { sourceUrl: 'https://blog.test/b', targetUrl: 'https://other.com/' },
    { sourceUrl: 'not a url at all' },
  ])
  assert.equal(r.created.length, 1)
  assert.deepEqual(r.skipped.map((s) => s.reason).sort(), ['duplicate', 'internal_link', 'invalid_url', 'target_not_on_project_domain'])
  const many = Array.from({ length: 150 }, (_, i) => ({ sourceUrl: `https://site${i}.test/p` }))
  const r2 = addBacklinks(ctx, project, many)
  assert.equal(r2.created.length, 99)
  assert.equal(r2.skipped.filter((s) => s.reason === 'plan_limit').length, 51)
})

test('sweep only checks due links and aggregates alerts per project', async () => {
  const { site, ctx, project, advance } = await setup()
  site.set('/a', withLink())
  site.set('/b', withLink())
  addBacklinks(ctx, project, [{ sourceUrl: site.url('/a') }, { sourceUrl: site.url('/b') }])
  let r = await sweepDueBacklinks(ctx)
  assert.equal(r.checked, 2)
  r = await sweepDueBacklinks(ctx)
  assert.equal(r.checked, 0, 'nothing due right after a check')
  site.set('/a', withoutLink)
  site.set('/b', withoutLink)
  advance(25)
  await sweepDueBacklinks(ctx) // miss 1 → retry in 6h
  advance(7)
  await sweepDueBacklinks(ctx) // miss 2 → lost
  const a = alerts(ctx)
  assert.equal(a.length, 1, 'one aggregated alert, not one per link')
  assert.match(a[0].title, /2 backlinks were lost/)
  await site.close()
})
