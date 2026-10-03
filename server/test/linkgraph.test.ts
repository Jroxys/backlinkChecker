import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { analyzeHtml } from '../src/lib/html.js'
import { recordPageLinks, refDomainsFor } from '../src/services/linkgraph.js'
import { importDomainGraph, importTargets } from '../src/services/commoncrawl.js'
import { graphOpportunities } from '../src/services/opportunities.js'
import { client, seedProject, seedUser, testCtx } from './helpers.js'

const page = (links: string[]) => analyzeHtml(`<html><body>${links.map((h, i) => `<a href="${h}">link ${i}</a>`).join('')}</body></html>`, 'https://blog.example.org/best-tools')

test('recording a page: external links only, replaced on re-crawl, and links to a customer become discovered backlinks', () => {
  const { ctx } = testCtx()
  const owner = seedProject(ctx, seedUser(ctx), 'acme.com')

  const r = recordPageLinks(ctx, 'https://blog.example.org/best-tools', page(['https://www.acme.com/pricing', 'https://rival.com/', 'https://example.org/about', '/internal', 'mailto:x@y.z']))
  assert.equal(r.links, 2, 'internal and non-http links skipped')
  assert.equal(r.discovered, 1)
  const bl = ctx.db.get<{ source_url: string; target_url: string; origin: string; status: string }>('SELECT source_url, target_url, origin, status FROM backlinks WHERE project_id = ?', [owner])!
  assert.deepEqual({ ...bl }, { source_url: 'https://blog.example.org/best-tools', target_url: 'https://www.acme.com/pricing', origin: 'discovery', status: 'pending' })

  // Re-crawl: rival dropped, still only one backlink row (already known)
  const again = recordPageLinks(ctx, 'https://blog.example.org/best-tools', page(['https://acme.com/']))
  assert.equal(again.discovered, 0)
  assert.equal(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM page_links')!.n, 1)
  assert.equal(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM backlinks')!.n, 1)

  assert.equal(refDomainsFor(ctx, 'www.acme.com'), 1)
  assert.equal(refDomainsFor(ctx, 'rival.com'), 1, 'domain-level edge kept from the first crawl')
  assert.equal(refDomainsFor(ctx, 'never-seen.com'), null, 'no data is not zero')
})

test('Common Crawl import streams the graph and keeps only edges into watched domains', async () => {
  const { ctx } = testCtx()
  const user = seedUser(ctx)
  const p = seedProject(ctx, user, 'example.com')
  ctx.db.run("INSERT INTO competitors (id, project_id, domain, created_at) VALUES ('c1', ?, 'rival.com', '2026-01-01')", [p])
  ctx.db.run("INSERT INTO competitors (id, project_id, domain, created_at) VALUES ('c2', ?, 'lonely.com', '2026-01-01')", [p])

  const dir = mkdtempSync(join(tmpdir(), 'cc-'))
  const vertices = join(dir, 'v.txt.gz')
  const edges = join(dir, 'e.txt.gz')
  writeFileSync(vertices, gzipSync(['0\tcom.a\t5', '1\tcom.example\t1', '2\tcom.lonely\t1', '3\tcom.rival\t3', '4\torg.big\t900', '5\tnet.unrelated\t2'].join('\n') + '\n'))
  writeFileSync(edges, gzipSync(['0\t3', '1\t3', '3\t3', '4\t1', '4\t3', '5\t0'].join('\n') + '\n'))

  const targets = importTargets(ctx)
  assert.deepEqual(targets.sort(), ['example.com', 'lonely.com', 'rival.com'])
  const r = await importDomainGraph(ctx, { release: 'cc-test', vertices, edges, targets })
  assert.equal(r.edges, 4, 'self-links and edges into unwatched domains dropped')

  const into = (d: string) => ctx.db.all<{ src_domain: string }>("SELECT src_domain FROM domain_links WHERE dst_domain = ? AND source = 'cc' ORDER BY src_domain", [d]).map((x) => x.src_domain)
  assert.deepEqual(into('rival.com'), ['a.com', 'big.org', 'example.com'])
  assert.deepEqual(into('example.com'), ['big.org'])
  assert.equal(refDomainsFor(ctx, 'rival.com'), 3)
  assert.equal(refDomainsFor(ctx, 'lonely.com'), 0, 'imported and genuinely unlinked')
  assert.equal(ctx.db.get<{ hosts: number }>("SELECT hosts FROM graph_domains WHERE domain = 'big.org'")!.hosts, 900)

  // Re-import replaces the previous release instead of piling up
  await importDomainGraph(ctx, { release: 'cc-test-2', vertices, edges, targets })
  assert.equal(into('rival.com').length, 3)
})

test('graph opportunities: gaps (page-level beats domain-level), broken competitor links, outreach won → monitored', async () => {
  const { ctx } = testCtx()
  const api = client(ctx)
  await api.post('/api/auth/signup', { email: 'o@example.com', name: 'O', password: 'correct horse battery' })
  ctx.db.run("UPDATE users SET plan = 'pro'")
  const project = (await api.post('/api/projects', { domain: 'example.com' })).json.project
  assert.equal((await api.post(`/api/projects/${project.id}/competitors`, { domain: 'rival.com' })).status, 201)

  const at = '2026-09-01'
  const edge = (src: string, dst: string, source = 'cc') => ctx.db.run('INSERT INTO domain_links (dst_domain, src_domain, source, seen_at) VALUES (?, ?, ?, ?)', [dst, src, source, at])
  edge('deep.com', 'rival.com') // domain-level only
  edge('both.com', 'rival.com')
  edge('both.com', 'example.com') // already links to us → not a gap
  edge('facebook.com', 'rival.com') // platform → ignored
  recordPageLinks(ctx, 'https://lists.net/seo-tools', analyzeHtml('<a href="https://rival.com/tool">Rival tool</a><a href="https://rival.com/old-guide">guide</a>', 'https://lists.net/seo-tools'))
  ctx.db.run("INSERT INTO link_targets (url, status, checked_at) VALUES ('https://rival.com/old-guide', 404, ?)", [at])

  const opps = graphOpportunities(ctx, 'example.com', ['rival.com'])
  const byId = new Map(opps.map((o) => [o.id, o]))
  assert.ok(!byId.has('gap:both.com') && !byId.has('gap:facebook.com'))
  assert.equal(byId.get('gap:lists.net')?.evidence, 'page')
  assert.equal(byId.get('gap:lists.net')?.sourceUrl, 'https://lists.net/seo-tools')
  assert.equal(byId.get('gap:deep.com')?.evidence, 'domain')
  assert.ok(opps.findIndex((o) => o.id === 'gap:lists.net') < opps.findIndex((o) => o.id === 'gap:deep.com'), 'a known page ranks higher')
  assert.ok(opps.some((o) => o.kind === 'broken-link' && o.domain === 'lists.net' && /404/.test(o.headline)))
  assert.ok(ctx.db.get("SELECT 1 FROM crawl_frontier WHERE domain = 'deep.com'"), 'domain-level gap queued for a probe')

  const res = await api.get(`/api/projects/${project.id}/opportunities`)
  assert.equal(res.json.gapStatus, 'ok')
  assert.equal(res.json.graph.pagesCrawled, 1)

  const won = await api.put(`/api/projects/${project.id}/opportunities/status`, { key: 'gap:lists.net', domain: 'lists.net', status: 'won', linkUrl: 'https://lists.net/seo-tools' })
  assert.equal(won.status, 200)
  assert.ok(won.json.backlinkId, 'the new link is now monitored')
  assert.equal(ctx.db.get<{ status: string }>("SELECT status FROM outreach WHERE opp_key = 'gap:lists.net'")!.status, 'won')
  const after = await api.get(`/api/projects/${project.id}/opportunities`)
  const kept = after.json.opportunities.find((o: { id: string }) => o.id === 'gap:lists.net')
  assert.equal(kept?.status, 'won', 'stays visible under Won after it stops being a gap')
  assert.match(kept.headline, /Link won/)
  assert.equal((await api.put(`/api/projects/${project.id}/opportunities/status`, { key: 'gap:deep.com', domain: 'deep.com', status: 'won', linkUrl: 'https://example.com/x' })).status, 422)
})
