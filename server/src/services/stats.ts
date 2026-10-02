import type { Ctx } from '../context.js'
import type { Db } from '../db/index.js'

/** Current point-in-time numbers for a project. */
export function projectSnapshot(db: Db, projectId: string, nowIso = new Date().toISOString()) {
  const idx = db.get<Record<string, number>>(
    `SELECT COUNT(*) AS urls,
            SUM(index_status = 'indexed') AS indexed,
            SUM(index_status = 'crawled') AS crawled,
            SUM(index_status = 'discovered') AS discovered,
            SUM(index_status IN ('blocked', 'error')) AS not_indexed,
            SUM(index_status = 'unknown') AS unknown,
            SUM(indexable = 1) AS indexable,
            SUM(indexable = 0) AS issues
       FROM monitored_urls WHERE project_id = ?`,
    [projectId],
  )!
  const since = new Date(new Date(nowIso).getTime() - 30 * 86_400_000).toISOString()
  const bl = db.get<Record<string, number>>(
    `SELECT SUM(status = 'active') AS backlinks,
            COUNT(DISTINCT CASE WHEN status = 'active' THEN source_domain END) AS ref_domains,
            SUM(status = 'active' AND first_seen >= :since) AS gained,
            SUM(status IN ('lost', 'broken') AND last_seen >= :since) AS lost,
            SUM(status = 'active' AND rel = 'dofollow') AS dofollow,
            SUM(status = 'pending') AS pending,
            COUNT(*) AS tracked
       FROM backlinks WHERE project_id = :p`,
    { p: projectId, since },
  )!
  const n = (v: number | null | undefined) => v ?? 0
  return {
    urls: n(idx.urls),
    indexed: n(idx.indexed),
    crawled: n(idx.crawled),
    discovered: n(idx.discovered),
    notIndexed: n(idx.not_indexed),
    unknown: n(idx.unknown),
    indexable: n(idx.indexable),
    issues: n(idx.issues),
    backlinks: n(bl.backlinks),
    refDomains: n(bl.ref_domains),
    gained30d: n(bl.gained),
    lost30d: n(bl.lost),
    dofollow: n(bl.dofollow),
    pendingBacklinks: n(bl.pending),
    trackedBacklinks: n(bl.tracked),
  }
}

export function snapshotAll(ctx: Ctx) {
  const date = ctx.now().toISOString().slice(0, 10)
  const dayStart = date + 'T00:00:00.000Z'
  const projects = ctx.db.all<{ id: string }>('SELECT id FROM projects')
  for (const p of projects) {
    const s = projectSnapshot(ctx.db, p.id, ctx.now().toISOString())
    const today = ctx.db.get<{ gained: number; lost: number }>(
      `SELECT SUM(first_seen >= :d) AS gained, SUM(status IN ('lost','broken') AND last_checked_at >= :d AND miss_count >= 2) AS lost FROM backlinks WHERE project_id = :p`,
      { p: p.id, d: dayStart },
    )
    ctx.db.run(
      `INSERT INTO daily_stats (project_id, date, urls, indexed, crawled, discovered, not_indexed, indexable, backlinks, ref_domains, gained, lost, issues)
       VALUES (:p, :date, :urls, :indexed, :crawled, :discovered, :ni, :indexable, :bl, :rd, :gained, :lost, :issues)
       ON CONFLICT(project_id, date) DO UPDATE SET urls = :urls, indexed = :indexed, crawled = :crawled, discovered = :discovered,
         not_indexed = :ni, indexable = :indexable, backlinks = :bl, ref_domains = :rd, gained = :gained, lost = :lost, issues = :issues`,
      {
        p: p.id,
        date,
        urls: s.urls,
        indexed: s.indexed,
        crawled: s.crawled,
        discovered: s.discovered,
        ni: s.notIndexed,
        indexable: s.indexable,
        bl: s.backlinks,
        rd: s.refDomains,
        gained: today?.gained ?? 0,
        lost: today?.lost ?? 0,
        issues: s.issues,
      },
    )
  }
  return { projects: projects.length }
}
