import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractLinks, parseCsv } from '../src/lib/csv.js'

test('parses quoted fields with commas and escaped quotes', () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","say ""hi"""\n'), [
    ['a', 'b'],
    ['x, y', 'say "hi"'],
  ])
})

test('Search Console "Latest links" export', () => {
  const r = extractLinks('Linking page,Last crawled\nhttps://blog.test/a,2026-09-20\nhttps://news.test/b,2026-09-18\n')
  assert.equal(r.format, 'search-console')
  assert.deepEqual(r.links.map((l) => l.sourceUrl), ['https://blog.test/a', 'https://news.test/b'])
})

test('backlink tool export with target and authority columns', () => {
  const r = extractLinks('Referring page URL;Target URL;Domain rating;Anchor\nhttps://blog.test/a;https://example.com/x;71;hello\n')
  assert.equal(r.format, 'backlink-tool')
  assert.deepEqual(r.links[0], { sourceUrl: 'https://blog.test/a', targetUrl: 'https://example.com/x', authority: 71 })
})

test('plain URL list without header', () => {
  const r = extractLinks('https://a.test/1\nhttps://b.test/2\n')
  assert.equal(r.links.length, 2)
})

test('domain-only rows are reported, not imported', () => {
  const r = extractLinks('Site,Linking pages,Target pages\nblog.test,12,3\n')
  assert.equal(r.links.length, 0)
  assert.deepEqual(r.domainOnly, ['blog.test'])
})

test('CSV export: quoting, formula neutralising, and a round trip through our own parser', async () => {
  const { toCsv, parseCsv } = await import('../src/lib/csv.js')
  const csv = toCsv(['a', 'b'], [['=HYPERLINK("http://x")', 'say "hi", ok'], [null, 42]])
  assert.ok(csv.startsWith('﻿'))
  const rows = parseCsv(csv)
  assert.deepEqual(rows[1], ['\'=HYPERLINK("http://x")', 'say "hi", ok'])
  assert.deepEqual(rows[2], ['', '42'])
})

test('project exports are scoped to the owner and download as CSV', async () => {
  const { client, testCtx } = await import('./helpers.js')
  const { ctx } = testCtx()
  const api = client(ctx)
  await api.post('/api/auth/signup', { email: 'x@example.com', name: 'X', password: 'correct horse battery' })
  const p = (await api.post('/api/projects', { domain: 'example.com' })).json.project
  await api.post(`/api/projects/${p.id}/backlinks`, { links: [{ sourceUrl: 'https://blog.example.org/post' }] })
  const res = await api.call('GET', `/api/projects/${p.id}/export/backlinks.csv`)
  assert.equal(res.status, 200)
  const other = client(ctx)
  await other.post('/api/auth/signup', { email: 'y@example.com', name: 'Y', password: 'correct horse battery' })
  assert.equal((await other.get(`/api/projects/${p.id}/export/backlinks.csv`)).status, 404)
})
