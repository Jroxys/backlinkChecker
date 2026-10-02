import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addUrls, checkUrl, alertForUrlChanges, type UrlRow } from '../src/services/urls.js'
import { parseSitemap, syncSitemap } from '../src/services/sitemaps.js'
import { mapCoverage } from '../src/services/google.js'
import { fixtureSite, seedProject, seedUser, testCtx } from './helpers.js'

const html = (head = '', body = '<h1>Hi</h1><p>some words here</p>') => `<html><head><title>T</title>${head}</head><body>${body}</body></html>`

test('technical check: indexable page, then noindex added → change + alert', async () => {
  const site = await fixtureSite()
  const { ctx } = testCtx()
  const p = seedProject(ctx, seedUser(ctx), '127.0.0.1')
  site.set('/page', html(`<link rel="canonical" href="${site.url('/page')}">`))
  const [id] = addUrls(ctx, p, [site.url('/page')]).created
  assert.deepEqual(await checkUrl(ctx, id), [])
  let row = ctx.db.get<UrlRow>('SELECT * FROM monitored_urls WHERE id = ?', [id])!
  assert.equal(row.indexable, 1)
  assert.equal(row.canonical, 'self')
  assert.equal(row.http_status, 200)
  assert.equal(row.title, 'T')

  site.set('/page', html('<meta name="robots" content="noindex">'))
  const changes = await checkUrl(ctx, id)
  assert.equal(changes[0].kind, 'became_non_indexable')
  assert.match(changes[0].detail, /noindex/)
  alertForUrlChanges(ctx, changes)
  assert.match(ctx.db.get<{ title: string }>('SELECT title FROM alerts')!.title, /became non-indexable/)
  row = ctx.db.get<UrlRow>('SELECT * FROM monitored_urls WHERE id = ?', [id])!
  assert.equal(row.robots, 'noindex')
  await site.close()
})

test('robots.txt blocking Googlebot makes a page non-indexable even though we can fetch it', async () => {
  const site = await fixtureSite()
  const { ctx } = testCtx()
  const p = seedProject(ctx, seedUser(ctx), '127.0.0.1')
  site.set('/robots.txt', { body: 'User-agent: Googlebot\nDisallow: /secret', headers: { 'content-type': 'text/plain' } })
  site.set('/secret', html())
  const [id] = addUrls(ctx, p, [site.url('/secret')]).created
  await checkUrl(ctx, id)
  const row = ctx.db.get<UrlRow>('SELECT * FROM monitored_urls WHERE id = ?', [id])!
  assert.equal(row.robots, 'blocked')
  assert.equal(row.indexable, 0)
  await site.close()
})

test('redirects and canonicals pointing elsewhere are not indexable', async () => {
  const site = await fixtureSite()
  const { ctx } = testCtx()
  const p = seedProject(ctx, seedUser(ctx), '127.0.0.1')
  site.set('/old', { status: 301, headers: { location: '/new' } })
  site.set('/new', html())
  site.set('/dupe', html(`<link rel="canonical" href="${site.url('/new')}">`))
  const ids = addUrls(ctx, p, [site.url('/old'), site.url('/dupe')]).created
  for (const id of ids) await checkUrl(ctx, id)
  const rows = ctx.db.all<UrlRow>('SELECT * FROM monitored_urls ORDER BY url')
  const dupe = rows.find((r) => r.url.endsWith('/dupe'))!
  const old = rows.find((r) => r.url.endsWith('/old'))!
  assert.equal(old.http_status, 301)
  assert.equal(old.indexable, 0)
  assert.equal(dupe.canonical, 'other')
  assert.equal(dupe.indexable, 0)
  await site.close()
})

test('sitemap index → child sitemaps → URLs enrolled; second read alerts on new URLs', async () => {
  const site = await fixtureSite()
  const { ctx } = testCtx()
  const p = seedProject(ctx, seedUser(ctx), '127.0.0.1')
  const xml = (body: string) => ({ body: `<?xml version="1.0"?>${body}`, headers: { 'content-type': 'application/xml' } })
  site.set('/sitemap.xml', xml(`<sitemapindex><sitemap><loc>${site.url('/s1.xml')}</loc></sitemap></sitemapindex>`))
  site.set('/s1.xml', xml(`<urlset><url><loc>${site.url('/a')}</loc></url><url><loc>${site.url('/b')}</loc></url></urlset>`))
  ctx.db.run("INSERT INTO sitemaps (id, project_id, url, created_at) VALUES ('sm1', ?, ?, '2026-01-01')", [p, site.url('/sitemap.xml')])
  const r1 = await syncSitemap(ctx, 'sm1')
  assert.equal(r1.added, 2)
  assert.equal(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM alerts')!.n, 0, 'first read is baseline, no alert')

  site.set('/s1.xml', xml(`<urlset><url><loc>${site.url('/a')}</loc></url><url><loc>${site.url('/b')}</loc></url><url><loc>${site.url('/c')}</loc></url></urlset>`))
  const r2 = await syncSitemap(ctx, 'sm1')
  assert.equal(r2.added, 1)
  assert.match(ctx.db.get<{ title: string }>('SELECT title FROM alerts')!.title, /1 new URL detected/)
  await site.close()
})

test('parseSitemap ignores off-schema noise', () => {
  const r = parseSitemap('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc> https://x.test/a </loc><lastmod>2026</lastmod></url></urlset>')
  assert.deepEqual(r.urls, ['https://x.test/a'])
})

test('Search Console coverage states map to our buckets', () => {
  assert.equal(mapCoverage('Submitted and indexed', 'PASS'), 'indexed')
  assert.equal(mapCoverage('Indexed, not submitted in sitemap', 'PASS'), 'indexed')
  assert.equal(mapCoverage('Crawled - currently not indexed', 'NEUTRAL'), 'crawled')
  assert.equal(mapCoverage('Discovered - currently not indexed', 'NEUTRAL'), 'discovered')
  assert.equal(mapCoverage("Excluded by 'noindex' tag", 'NEUTRAL'), 'blocked')
  assert.equal(mapCoverage('Blocked by robots.txt', 'NEUTRAL'), 'blocked')
  assert.equal(mapCoverage('Not found (404)', 'FAIL'), 'error')
  assert.equal(mapCoverage('Server error (5xx)', 'FAIL'), 'error')
  assert.equal(mapCoverage('URL is unknown to Google', 'NEUTRAL'), 'unknown')
  assert.equal(mapCoverage('Alternate page with proper canonical tag', 'NEUTRAL'), 'crawled')
})
