import { ownedProject, requireUser, router, type C } from '../http.js'
import { toCsv } from '../lib/csv.js'

/** CSV exports of everything we monitor for a project. Your data is yours. */
export const exportRoutes = router()
exportRoutes.use('/projects/:id/export/*', requireUser)

const send = (c: C, name: string, csv: string) => {
  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="${name}"`)
  return c.body(csv)
}
const stamp = (c: C) => c.var.ctx.now().toISOString().slice(0, 10)

exportRoutes.get('/projects/:id/export/backlinks.csv', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const rows = c.var.ctx.db.all<Record<string, string | number | null>>(
    `SELECT source_url, source_domain, COALESCE(NULLIF(found_target, ''), NULLIF(target_url, '')) AS target, anchor, rel, status, http_status,
            page_noindex, authority, origin, first_seen, last_seen, last_checked_at
       FROM backlinks WHERE project_id = ? ORDER BY source_domain, source_url`,
    [p.id],
  )
  const header = ['source_url', 'source_domain', 'target_url', 'anchor', 'rel', 'status', 'http_status', 'linking_page_noindex', 'authority', 'origin', 'first_seen', 'last_seen', 'last_checked']
  return send(
    c,
    `${p.domain}-backlinks-${stamp(c)}.csv`,
    toCsv(header, rows.map((r) => [r.source_url, r.source_domain, r.target, r.anchor, r.rel, r.status, r.http_status, r.page_noindex ? 'yes' : 'no', r.authority, r.origin, r.first_seen, r.last_seen, r.last_checked_at])),
  )
})

exportRoutes.get('/projects/:id/export/urls.csv', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const rows = c.var.ctx.db.all<Record<string, string | number | null>>(
    `SELECT url, index_status, coverage_state, indexable, http_status, robots, canonical, canonical_url, google_canonical, title, word_count, load_ms,
            in_sitemap, last_crawled_by_google, last_checked_at
       FROM monitored_urls WHERE project_id = ? ORDER BY url`,
    [p.id],
  )
  const header = ['url', 'google_index_status', 'google_coverage', 'indexable', 'http_status', 'robots', 'canonical', 'canonical_url', 'google_canonical', 'title', 'words', 'load_ms', 'in_sitemap', 'last_crawled_by_google', 'last_checked']
  return send(
    c,
    `${p.domain}-urls-${stamp(c)}.csv`,
    toCsv(header, rows.map((r) => [r.url, r.index_status, r.coverage_state, r.indexable === null ? '' : r.indexable ? 'yes' : 'no', r.http_status, r.robots, r.canonical, r.canonical_url, r.google_canonical, r.title, r.word_count, r.load_ms, r.in_sitemap ? 'yes' : 'no', r.last_crawled_by_google, r.last_checked_at])),
  )
})
