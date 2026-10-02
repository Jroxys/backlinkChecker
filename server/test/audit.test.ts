import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runAudit } from '../src/services/audit.js'
import { seedProject, seedUser, testCtx } from './helpers.js'

function url(ctx: ReturnType<typeof testCtx>['ctx'], p: string, path: string, f: Record<string, unknown>) {
  const cols = { http_status: 200, indexable: 1, robots: 'allowed', canonical: 'self', title: 'T ' + path, word_count: 800, load_ms: 300, in_sitemap: 1, index_status: 'indexed', ...f }
  ctx.db.run(
    `INSERT INTO monitored_urls (id, project_id, url, created_at, last_checked_at, ${Object.keys(cols).join(', ')})
     VALUES (?, ?, ?, '2026-01-01', '2026-10-01', ${Object.keys(cols).map(() => '?').join(', ')})`,
    ['u' + path, p, 'https://example.com' + path, ...(Object.values(cols) as (string | number | null)[])],
  )
}

test('audit flags each rule with the exact affected URLs and scores proportionally', () => {
  const { ctx } = testCtx()
  const p = seedProject(ctx, seedUser(ctx), 'example.com')
  url(ctx, p, '/ok', {})
  url(ctx, p, '/ok2', {})
  url(ctx, p, '/broken', { http_status: 500, indexable: 0 })
  url(ctx, p, '/staging', { robots: 'noindex', indexable: 0 })
  url(ctx, p, '/dupe-a', { title: 'Same' })
  url(ctx, p, '/dupe-b', { title: 'Same' })
  url(ctx, p, '/thin', { word_count: 120 })
  const r = runAudit(ctx.db, p, '2026-10-02T00:00:00Z')
  const by = Object.fromEntries(r.checks.map((c) => [c.id, c]))
  assert.equal(by.server_errors.affected, 1)
  assert.equal(by.server_errors.samples[0].url, 'https://example.com/broken')
  assert.equal(by.noindex.affected, 1)
  assert.equal(by.sitemap_non_indexable.affected, 2)
  assert.equal(by.duplicate_title.affected, 2)
  assert.equal(by.thin_content.affected, 1)
  assert.equal(by.redirects.affected, 0)
  assert.ok(r.score! < 100 && r.score! > 50, `score ${r.score}`)
  const technical = r.categories.find((c) => c.key === 'technical')!
  assert.equal(technical.errors, 1)
})

test('no crawled URLs yet → no score instead of a fake 100', () => {
  const { ctx } = testCtx()
  const p = seedProject(ctx, seedUser(ctx), 'example.com')
  assert.equal(runAudit(ctx.db, p).score, null)
})
