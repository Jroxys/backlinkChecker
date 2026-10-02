import { test } from 'node:test'
import assert from 'node:assert/strict'
import { keywordsFor } from '../src/services/keywords.js'
import { saveConnection, type GoogleClient } from '../src/services/google.js'
import { seedProject, seedUser, testCtx } from './helpers.js'

function fakeGoogle(calls: { n: number }): GoogleClient {
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
      calls.n++
      if (q.dimensions.includes('page'))
        return [
          { keys: ['seo audit tool', 'https://example.com/audit'], clicks: 40, impressions: 900, ctr: 0.044, position: 6.24 },
          { keys: ['seo audit tool', 'https://example.com/blog/audit'], clicks: 5, impressions: 300, ctr: 0.016, position: 14 },
          { keys: ['backlink checker', 'https://example.com/'], clicks: 12, impressions: 2000, ctr: 0.006, position: 18.5 },
        ]
      return [{ keys: ['seo audit tool'], clicks: 20, impressions: 700, ctr: 0.03, position: 9.1 }]
    },
  }
}

test('keywords: best page per query, previous-period comparison, cached for 6h', async () => {
  const calls = { n: 0 }
  const { ctx, advance } = testCtx({ google: fakeGoogle(calls) })
  const user = seedUser(ctx)
  const p = seedProject(ctx, user, 'example.com')
  ctx.db.run("UPDATE projects SET gsc_property = 'sc-domain:example.com' WHERE id = ?", [p])
  saveConnection(ctx.db, user, { accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600, scope: 'x' })

  const r = await keywordsFor(ctx, p)
  assert.equal(r.connected, true)
  assert.equal(r.rows.length, 2)
  const audit = r.rows.find((x: { query: string }) => x.query === 'seo audit tool')!
  assert.equal(audit.page, 'https://example.com/audit')
  assert.equal(audit.position, 6.2)
  assert.equal(audit.prevPosition, 9.1)
  assert.equal(r.rows[0].query, 'seo audit tool', 'sorted by clicks')
  assert.equal(calls.n, 2)

  await keywordsFor(ctx, p)
  assert.equal(calls.n, 2, 'served from cache')
  advance(7)
  await keywordsFor(ctx, p)
  assert.equal(calls.n, 4, 'refreshed after 6h')
})

test('keywords: not connected → empty, no Google calls', async () => {
  const calls = { n: 0 }
  const { ctx } = testCtx({ google: fakeGoogle(calls) })
  const p = seedProject(ctx, seedUser(ctx), 'example.com')
  const r = await keywordsFor(ctx, p)
  assert.equal(r.connected, false)
  assert.equal(calls.n, 0)
})
