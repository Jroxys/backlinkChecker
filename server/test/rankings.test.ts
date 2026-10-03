import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client, fixtureSite, testCtx } from './helpers.js'
import { saveConnection, type AnalyticsQuery, type GoogleClient } from '../src/services/google.js'
import { comparePages, pageFacts, todo } from '../src/lib/onpage.js'
import { syncGscPositions, sweepRankings } from '../src/services/rankings.js'
import type { SerpProvider } from '../src/services/serp.js'

test('on-page comparison: keyword placement, depth, schema; to-do sorted by importance', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')
  const mine = pageFacts(`<html><head><title>Our tools</title></head><body><h1>Tools</h1><p>${words(300)}</p><img src=a.png></body></html>`, 'https://me.example/tools', 1900)
  const theirs = pageFacts(
    `<html lang="tr"><head><title>En İyi SEO Araçları 2026</title><meta name="description" content="Ücretsiz seo araçları listesi"><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Article"},{"@type":"FAQPage"}]}</script></head>
     <body><h1>SEO araçları</h1><p>seo araçları ${words(1400)}</p><h2>a</h2><h2>b</h2><h2>c</h2><a href="/x">x</a><a href="https://other.example/">o</a></body></html>`,
    'https://them.example/seo-araclari',
    400,
  )
  assert.deepEqual(theirs.schemaTypes, ['Article', 'FAQPage'])
  assert.equal(theirs.internalLinks, 1)
  const checks = comparePages('SEO araçları', mine, theirs)
  const v = Object.fromEntries(checks.map((c) => [c.id, c.verdict]))
  assert.equal(v.title, 'behind')
  assert.equal(v.h1, 'behind')
  assert.equal(v.url, 'behind', 'accent-folded slug “seo-araclari” matches “SEO araçları”')
  assert.equal(v.words, 'behind')
  assert.equal(v.schema, 'behind')
  assert.equal(v.speed, 'behind')
  const list = todo(checks)
  assert.equal(list[0].id, 'title', 'most important first')
  assert.ok(list.some((t) => /FAQPage/.test(t.advice)))
})

function fakeGoogle(seen: AnalyticsQuery[]): GoogleClient {
  return {
    configured: true,
    authUrl: () => '',
    exchangeCode: async () => ({ accessToken: 'a', expiresIn: 3600, scope: '' }),
    refresh: async () => ({ accessToken: 'a', expiresIn: 3600 }),
    listSites: async () => [],
    inspect: async () => {
      throw new Error('unused')
    },
    listSitemaps: async () => [],
    searchAnalytics: async (_t, _s, q) => {
      seen.push(q)
      if (q.dimensions[0] === 'date')
        return [
          { keys: ['2026-09-20', 'backlink checker'], clicks: 3, impressions: 120, ctr: 0.02, position: 9.4 },
          { keys: ['2026-09-29', 'backlink checker'], clicks: 8, impressions: 200, ctr: 0.04, position: 6.16 },
          { keys: ['2026-09-29', 'Seo Audit'], clicks: 1, impressions: 40, ctr: 0.02, position: 14 },
        ]
      return [
        { keys: ['backlink checker', 'https://example.com/tools/backlink-checker'], clicks: 11, impressions: 320, ctr: 0.03, position: 7 },
        { keys: ['backlink checker', 'https://example.com/'], clicks: 2, impressions: 90, ctr: 0.02, position: 12 },
      ]
    },
  }
}

async function setup() {
  const seen: AnalyticsQuery[] = []
  const t = testCtx({ google: fakeGoogle(seen) })
  const api = client(t.ctx)
  await api.post('/api/auth/signup', { email: 'r@example.com', name: 'R', password: 'correct horse battery' })
  t.ctx.db.run("UPDATE users SET plan = 'pro'")
  const project = (await api.post('/api/projects', { domain: 'example.com' })).json.project
  const userId = t.ctx.db.get<{ id: string }>('SELECT id FROM users')!.id
  t.ctx.db.run("UPDATE projects SET gsc_property = 'sc-domain:example.com'")
  saveConnection(t.ctx.db, userId, { accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600, scope: 'x' })
  return { ...t, api, project, seen }
}

test('tracked keywords: Search Console backfill via a regex filter, best page, change over 7 days', async () => {
  const { ctx, api, project, seen } = await setup()
  const r = await api.post(`/api/projects/${project.id}/rankings`, { keywords: ['Backlink  Checker', 'seo audit', 'backlink checker'] })
  assert.equal(r.status, 201)
  assert.equal(r.json.created.length, 2, 'normalised and de-duplicated')
  await syncGscPositions(ctx, project.id, 90)
  assert.equal(seen[0].filters?.[0].operator, 'includingRegex')
  assert.equal(seen[0].filters?.[0].expression, '^(backlink checker|seo audit)$')
  assert.equal(seen[0].startDate, '2026-07-03')

  const list = (await api.get(`/api/projects/${project.id}/rankings`)).json
  const bc = list.keywords.find((k: { keyword: string }) => k.keyword === 'backlink checker')
  assert.equal(bc.position, 6.2)
  assert.equal(bc.change7d, 3.2, 'improved from 9.4 to 6.2')
  assert.equal(bc.bestPage, 'https://example.com/tools/backlink-checker')
  assert.equal(bc.clicks30d, 11)
  assert.equal(list.keywords.find((k: { keyword: string }) => k.keyword === 'seo audit').position, 14)
  assert.equal(list.serpConfigured, false)
  assert.equal(list.limit, 250)
})

test('live SERP: top 10 stored, our position recorded, competitor shown; plan limit on keywords', async () => {
  const { ctx, api, project } = await setup()
  const serp: SerpProvider = {
    name: 'fake',
    search: async () => [
      { position: 1, url: 'https://rival.example/backlink-checker', domain: 'rival.example', title: 'Rival' },
      { position: 2, url: 'https://www.example.com/tools/backlink-checker', domain: 'www.example.com', title: 'Us' },
    ],
  }
  ctx.serp = serp
  const kid = (await api.post(`/api/projects/${project.id}/rankings`, { keywords: ['backlink checker'] })).json.created[0]
  assert.deepEqual(await sweepRankings(ctx), { gsc: 1, serp: 1 })
  const list = (await api.get(`/api/projects/${project.id}/rankings`)).json
  assert.equal(list.keywords[0].position, 2)
  assert.equal(list.keywords[0].source, 'serp')
  assert.deepEqual(list.keywords[0].topCompetitor, { domain: 'rival.example', url: 'https://rival.example/backlink-checker', position: 1 })
  assert.equal((await api.post(`/api/keywords/${kid}/serp`)).status, 429, 'once a day per keyword')
  assert.equal((await api.get(`/api/keywords/${kid}`)).json.serp.results.length, 2)

  ctx.db.run("UPDATE users SET plan = 'free'")
  const many = Array.from({ length: 12 }, (_, i) => `kw ${i}`)
  const r = (await api.post(`/api/projects/${project.id}/rankings`, { keywords: many })).json
  assert.equal(r.created.length, 9, 'free tracks 10 keywords')
  assert.equal(r.skipped.filter((s: { reason: string }) => s.reason === 'plan_limit').length, 3)
})

test('compare: fetches both pages (ours as owner, theirs politely) and returns checks + to-do', async (t) => {
  const site = await fixtureSite()
  t.after(() => site.close())
  site.set('/robots.txt', { body: 'User-agent: *\nDisallow: /secret', headers: { 'content-type': 'text/plain' } })
  site.set('/mine', '<title>Tools</title><h1>Our tools</h1><p>short page</p>')
  site.set('/theirs', '<title>Backlink checker — free</title><h1>Backlink checker</h1><p>backlink checker ' + 'text '.repeat(600) + '</p>')
  site.set('/secret', '<title>x</title>')
  const { api, project } = await setup()
  const r = await api.post(`/api/projects/${project.id}/compare`, { keyword: 'backlink checker', myUrl: site.url('/mine'), theirUrl: site.url('/theirs') })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.equal(r.json.checks.find((c: { id: string }) => c.id === 'title').verdict, 'behind')
  assert.ok(r.json.todo.length >= 3)
  assert.equal(r.json.mine.text, undefined, 'page text is not returned')

  const blocked = await api.post(`/api/projects/${project.id}/compare`, { keyword: 'secret page', myUrl: site.url('/mine'), theirUrl: site.url('/secret') })
  assert.equal(blocked.status, 422)
  assert.match(blocked.json.error.message, /robots\.txt/)
  const none = await api.post(`/api/projects/${project.id}/compare`, { keyword: 'no competitor' })
  assert.equal(none.status, 422)
  assert.equal(none.json.error.code, 'no_competitor')
})
