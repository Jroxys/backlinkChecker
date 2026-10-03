import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client, fixtureSite, testCtx } from './helpers.js'

test('free backlink checker finds the link and its rel; rate-limited per IP', async (t) => {
  const site = await fixtureSite()
  t.after(() => site.close())
  site.set('/post', '<p>See <a rel="nofollow" href="https://www.example.com/pricing">pricing</a></p>')
  const { ctx } = testCtx()
  const api = client(ctx)
  const r = await api.post('/api/tools/backlink-check', { pageUrl: site.url('/post'), target: 'example.com' })
  assert.equal(r.status, 200)
  assert.equal(r.json.found, true)
  assert.equal(r.json.rel, 'nofollow')
  assert.equal(r.json.anchor, 'pricing')
  assert.equal(r.json.pageTitle, '')
  const miss = await api.post('/api/tools/backlink-check', { pageUrl: site.url('/post'), target: 'https://example.com/blog/other' })
  assert.equal(miss.json.found, false)
  assert.equal(miss.json.linksToDomain, 1)
  for (let i = 0; i < 8; i++) await api.post('/api/tools/backlink-check', { pageUrl: site.url('/post'), target: 'example.com' })
  const limited = await api.post('/api/tools/backlink-check', { pageUrl: site.url('/post'), target: 'example.com' })
  assert.equal(limited.status, 429)
})

test('free indexability checker explains every blocker', async (t) => {
  const site = await fixtureSite()
  t.after(() => site.close())
  site.set('/robots.txt', { body: 'User-agent: Googlebot\nDisallow: /hidden', headers: { 'content-type': 'text/plain' } })
  site.set('/hidden', '<title>x</title><meta name="robots" content="noindex"><p>hi</p>')
  site.set('/ok', `<title>Fine</title><link rel="canonical" href="${site.url('/ok')}"><p>${'word '.repeat(400)}</p>`)
  const { ctx } = testCtx()
  const api = client(ctx)
  const bad = await api.post('/api/tools/indexability', { url: site.url('/hidden') })
  assert.equal(bad.json.indexable, false)
  assert.equal(bad.json.googlebotAllowed, false)
  assert.equal(bad.json.noindex, true)
  assert.ok(bad.json.reasons.length >= 3)
  const good = await api.post('/api/tools/indexability', { url: site.url('/ok') })
  assert.equal(good.json.indexable, true)
  assert.deepEqual(good.json.reasons, [])
})

test('free tools refuse private addresses in production mode', async () => {
  const { ctx } = testCtx()
  const { PoliteFetcher } = await import('../src/lib/fetcher.js')
  ctx.fetcher = new PoliteFetcher({ userAgent: 'x', perHostDelayMs: 0 })
  const r = await client(ctx).post('/api/tools/indexability', { url: 'http://169.254.169.254/latest/meta-data/' })
  assert.equal(r.json.ok, false)
  assert.match(r.json.problem, /can’t be checked/)
})

test('redirect checker flags chains, temporary redirects and plain-HTTP finals', async (t) => {
  const site = await fixtureSite()
  t.after(() => site.close())
  site.set('/old', { status: 302, headers: { location: site.url('/older') } })
  site.set('/older', { status: 301, headers: { location: site.url('/new') } })
  site.set('/new', '<title>New</title><p>hello</p>')
  const { ctx } = testCtx()
  const r = await client(ctx).post('/api/tools/redirect-check', { url: site.url('/old') })
  assert.equal(r.status, 200)
  assert.equal(r.json.chain.hops.length, 2)
  assert.equal(r.json.chain.finalUrl, site.url('/new'))
  const issues: string = r.json.issues.join('\n')
  assert.match(issues, /2 redirects in a row/)
  assert.match(issues, /temporary redirect \(302\)/)
  assert.match(issues, /plain HTTP/)
  assert.equal(r.json.variants.length, 4)
})

test('SSL checker reports days left and explains verification errors', async () => {
  const { ctx } = testCtx()
  const soon = new Date(ctx.now().getTime() + 5 * 86_400_000).toISOString()
  ctx.probes = {
    certificate: async (host) => (host === 'bad.example' ? { host, expiresAt: soon, issuer: 'Acme', error: 'ERR_TLS_CERT_ALTNAME_INVALID' } : { host, expiresAt: soon, issuer: "Let's Encrypt", error: null }),
    domain: async () => ({ expiresAt: null, registrar: null }),
  }
  const api = client(ctx)
  const ok = await api.post('/api/tools/ssl-check', { host: 'https://www.good.example/page' })
  assert.equal(ok.json.host, 'www.good.example')
  assert.equal(ok.json.valid, true)
  assert.equal(ok.json.daysLeft, 5)
  assert.match(ok.json.explanation, /expires in 5 days/)
  const bad = await api.post('/api/tools/ssl-check', { host: 'bad.example' })
  assert.equal(bad.json.valid, false)
  assert.match(bad.json.explanation, /different hostname/)
  assert.equal((await api.post('/api/tools/ssl-check', { host: 'not a host' })).status, 422)
})

test('SSL checker refuses IP literals (tls.connect bypasses DNS-based SSRF checks)', async () => {
  const { ctx } = testCtx()
  const api = client(ctx)
  for (const host of ['127.0.0.1', '169.254.169.254', 'https://10.0.0.1/']) assert.equal((await api.post('/api/tools/ssl-check', { host })).status, 422, host)
  const { defaultProbes } = await import('../src/services/health.js')
  assert.equal((await defaultProbes(false).certificate('127.0.0.1')).error, 'Private address')
})
