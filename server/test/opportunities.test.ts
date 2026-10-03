import { test } from 'node:test'
import assert from 'node:assert/strict'
import { opportunitiesFor } from '../src/services/opportunities.js'
import { seedProject, seedUser, testCtx } from './helpers.js'

test('opportunities: reclaim lost dofollow links and redirect 404 targets; gap needs competitors', async () => {
  const { ctx } = testCtx()
  const p = seedProject(ctx, seedUser(ctx), 'example.com')
  const bl = (id: string, f: Record<string, string | number | null>) => {
    const cols = { source_url: `https://${id}.test/post`, source_domain: `${id}.test`, target_url: '', status: 'active', rel: 'dofollow', authority: 50, last_seen: '2026-09-20', created_at: '2026-01-01', ...f }
    ctx.db.run(`INSERT INTO backlinks (id, project_id, ${Object.keys(cols).join(',')}) VALUES (?, ?, ${Object.keys(cols).map(() => '?').join(',')})`, [id, p, ...Object.values(cols)])
  }
  bl('gone', { status: 'lost', authority: 80, anchor: 'great tool' })
  bl('nofollow-gone', { status: 'lost', rel: 'nofollow' })
  bl('points-at-404', { found_target: 'https://example.com/old-guide/', authority: 80 })
  bl('fine', { found_target: 'https://example.com/live' })
  ctx.db.run("INSERT INTO monitored_urls (id, project_id, url, http_status, created_at) VALUES ('u1', ?, 'https://example.com/old-guide', 404, '2026-01-01')", [p])

  const r = await opportunitiesFor(ctx, p)
  const kinds = r.opportunities.map((o) => `${o.kind}:${o.domain}`)
  assert.deepEqual(kinds.sort(), ['reclaim:gone.test', 'redirect:points-at-404.test'])
  assert.equal(r.opportunities[0].kind, 'redirect', 'no-outreach fix ranks first at equal authority')
  assert.equal(r.gapStatus, 'no_competitors')
})
