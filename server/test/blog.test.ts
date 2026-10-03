import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { client, testCtx } from './helpers.js'
import { createApp } from '../src/app.js'

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'ix-blog-'))
  const blog = join(root, 'content', 'blog')
  const dist = join(root, 'dist')
  mkdirSync(blog, { recursive: true })
  mkdirSync(dist)
  writeFileSync(join(dist, 'index.html'), '<!doctype html><html><head><title>x</title></head><body><div id="root"></div></body></html>')
  const post = (slug: string, fm: string, body = 'Hello **world** <script>x</script>') => writeFileSync(join(blog, `${slug}.md`), `---\n${fm}\n---\n${body}\n`)
  post('live-post', 'title: Live </title> post\ndescription: A live post.\ndate: 2026-09-30')
  post('newer-post', 'title: Newer\ndescription: Newer one.\ndate: 2026-10-01\nupdated: 2026-10-02')
  post('scheduled', 'title: Later\ndescription: Not yet.\ndate: 2026-12-01')
  post('draft-post', 'title: Draft\ndescription: Hidden.\ndate: 2026-09-01\ndraft: true')
  post('broken', 'title: No date\ndescription: Missing date.')
  const { ctx } = testCtx()
  ctx.config = { ...ctx.config, contentDir: blog, webDist: dist }
  return { ctx }
}

test('blog API lists published posts only, newest first, with neighbours for "read next"', async () => {
  const { ctx } = setup()
  const api = client(ctx)
  const list = (await api.get('/api/blog')).json.posts
  assert.deepEqual(list.map((p: { slug: string }) => p.slug), ['newer-post', 'live-post'])
  assert.equal(list[0].html, undefined, 'list has no bodies')
  const one = (await api.get('/api/blog/live-post')).json
  assert.match(one.post.html, /<strong>world<\/strong>/)
  assert.deepEqual(one.more.map((p: { slug: string }) => p.slug), ['newer-post'])
  for (const hidden of ['scheduled', 'draft-post', 'broken', '..%2Fsecret']) assert.equal((await api.get(`/api/blog/${hidden}`)).status, 404, hidden)
})

test('article pages are pre-rendered for crawlers with Article JSON-LD, and listed in the sitemap', async () => {
  const { ctx } = setup()
  const app = createApp(ctx)
  const html = await (await app.request('/blog/live-post')).text()
  assert.match(html, /<title>Live &lt;\/title&gt; post \| Indexora<\/title>/)
  assert.match(html, /<meta property="og:type" content="article" \/>/)
  assert.match(html, /"@type":"Article"/)
  assert.ok(!/"headline":"Live <\/title>/.test(html), 'JSON-LD escapes </')
  assert.match(html, /<div id="root"><article><h1>Live &lt;\/title&gt; post<\/h1><p>Hello <strong>world<\/strong>/)
  assert.equal((await app.request('/blog/scheduled')).status, 404)
  const sitemap = await (await app.request('/sitemap.xml')).text()
  assert.match(sitemap, /\/blog\/newer-post<\/loc><lastmod>2026-10-02<\/lastmod>/)
  assert.ok(!sitemap.includes('scheduled'))
})
