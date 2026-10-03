import { enqueue } from '../jobs/queue.js'
import type { Ctx } from '../context.js'
import { analyzeHtml } from '../lib/html.js'
import { addHours, id } from '../lib/ids.js'
import { hostMatches, normalizeDomain, parseHttpUrl, urlKey } from '../lib/url.js'
import { getPlan } from '../plans.js'
import { createAlert, plural } from './alerts.js'
import { accessTokenFor, type IndexStatus } from './google.js'

export interface UrlRow {
  paused: number
  id: string
  project_id: string
  url: string
  source: string
  http_status: number | null
  indexable: number | null
  robots: string | null
  canonical: string | null
  canonical_url: string | null
  title: string | null
  word_count: number | null
  load_ms: number | null
  in_sitemap: number
  index_status: IndexStatus
  coverage_state: string | null
  google_canonical: string | null
  last_crawled_by_google: string | null
  last_checked_at: string | null
  index_checked_at: string | null
  next_check_at: string | null
  created_at: string
}

const GOOGLEBOT = 'Googlebot'

export function addUrls(ctx: Ctx, projectId: string, rawUrls: string[], source: 'manual' | 'sitemap' | 'import' = 'manual') {
  const project = ctx.db.get<{ domain: string; user_id: string; plan: string }>(
    'SELECT p.domain, p.user_id, u.plan FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = ?',
    [projectId],
  )
  if (!project) throw new Error('Project not found')
  const limit = getPlan(project.plan).limits.urls
  const used = ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM monitored_urls m JOIN projects p ON p.id = m.project_id WHERE p.user_id = ?', [project.user_id])!.n
  const at = ctx.now().toISOString()
  const created: string[] = []
  const skipped: { url: string; reason: string }[] = []
  ctx.db.tx(() => {
    for (const raw of rawUrls) {
      const u = parseHttpUrl(raw)
      const host = u && normalizeDomain(u.hostname)
      if (!u || !host || !hostMatches(host, project.domain)) {
        skipped.push({ url: raw, reason: u ? 'not_on_project_domain' : 'invalid_url' })
        continue
      }
      if (used + created.length >= limit) {
        skipped.push({ url: raw, reason: 'plan_limit' })
        continue
      }
      const urlId = id('url')
      const r = ctx.db.run(
        `INSERT OR IGNORE INTO monitored_urls (id, project_id, url, source, in_sitemap, next_check_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [urlId, projectId, u.href, source, source === 'sitemap' ? 1 : 0, at, at],
      )
      if (r.changes) created.push(urlId)
      else {
        if (source === 'sitemap') ctx.db.run('UPDATE monitored_urls SET in_sitemap = 1 WHERE project_id = ? AND url = ?', [projectId, u.href])
        skipped.push({ url: raw, reason: 'duplicate' })
      }
    }
  })
  // Check new entries now rather than at the next periodic sweep (same dedupe key, so never doubled).
  if (created.length) enqueue(ctx.db, 'urls.sweep', {}, { dedupeKey: 'periodic:urls.sweep' })
  return { created, skipped }
}

export interface UrlChange {
  url: UrlRow
  kind: 'became_non_indexable' | 'became_indexable' | 'server_error' | 'not_found' | 'canonical_changed' | 'indexed' | 'deindexed'
  detail: string
}

/** Technical checks we can run ourselves, from the outside, like Googlebot would. */
export async function checkUrl(ctx: Ctx, urlId: string): Promise<UrlChange[]> {
  const row = ctx.db.get<UrlRow>('SELECT * FROM monitored_urls WHERE id = ?', [urlId])
  if (!row) return []
  const owner = ctx.db.get<{ plan: string }>('SELECT u.plan FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = ?', [row.project_id])
  const hours = getPlan(owner?.plan).limits.urlCheckHours
  const at = ctx.now().toISOString()
  const changes: UrlChange[] = []

  let http: number | null = null
  let robots: 'allowed' | 'blocked' | 'noindex' = 'allowed'
  let canonical: 'self' | 'other' | 'missing' = 'missing'
  let canonicalUrl: string | null = null
  let title: string | null = row.title
  let words: number | null = row.word_count
  let loadMs: number | null = null
  let detailError: string | null = null

  try {
    const u = new URL(row.url)
    const googlebotAllowed = await ctx.fetcher.allowedByRobots(u, GOOGLEBOT)
    const res = await ctx.fetcher.fetchPage(row.url, { ownSite: true })
    loadMs = res.timeMs
    http = res.redirects.length ? res.redirects[0].status : res.status
    if (!googlebotAllowed) robots = 'blocked'
    if (res.status >= 200 && res.status < 300 && /html/i.test(res.contentType || 'text/html')) {
      const page = analyzeHtml(res.body, res.finalUrl, res.headers)
      title = page.title || null
      words = page.wordCount
      if (page.noindex && robots === 'allowed') robots = 'noindex'
      if (page.canonical) {
        canonicalUrl = page.canonical
        canonical = urlKey(page.canonical) === urlKey(row.url) ? 'self' : 'other'
      }
    }
  } catch (e) {
    detailError = (e as Error).message
  }

  const indexable = http === 200 && robots === 'allowed' && canonical !== 'other' ? 1 : 0
  const first = row.last_checked_at === null

  if (!first) {
    if (row.indexable === 1 && indexable === 0) {
      const why =
        http === null ? `unreachable (${detailError})` : http >= 500 ? `server error ${http}` : http >= 400 ? `HTTP ${http}` : http >= 300 ? `redirects (${http})` : robots === 'noindex' ? 'noindex directive added' : robots === 'blocked' ? 'blocked by robots.txt for Googlebot' : `canonicalised to ${canonicalUrl}`
      changes.push({ url: row, kind: http !== null && http >= 500 ? 'server_error' : http === 404 || http === 410 ? 'not_found' : 'became_non_indexable', detail: why })
    } else if (row.indexable === 0 && indexable === 1) {
      changes.push({ url: row, kind: 'became_indexable', detail: 'Page is indexable again' })
    }
    if (row.canonical_url && canonicalUrl && urlKey(row.canonical_url) !== urlKey(canonicalUrl))
      changes.push({ url: row, kind: 'canonical_changed', detail: `Canonical changed ${row.canonical_url} → ${canonicalUrl}` })
  }

  ctx.db.tx(() => {
    ctx.db.run(
      `UPDATE monitored_urls SET http_status = :http, indexable = :indexable, robots = :robots, canonical = :canonical, canonical_url = :curl,
         title = :title, word_count = :words, load_ms = :load, last_checked_at = :at, next_check_at = :next WHERE id = :id`,
      { id: row.id, http, indexable, robots, canonical, curl: canonicalUrl, title, words, load: loadMs, at, next: addHours(at, hours) },
    )
    if (first) ctx.db.run('INSERT INTO url_events (id, url_id, at, kind, detail) VALUES (?, ?, ?, ?, ?)', [id('ue'), row.id, at, 'first_check', `First check: HTTP ${http ?? '—'}, ${indexable ? 'indexable' : 'not indexable'}`])
    for (const c of changes) ctx.db.run('INSERT INTO url_events (id, url_id, at, kind, detail) VALUES (?, ?, ?, ?, ?)', [id('ue'), row.id, at, c.kind, c.detail])
  })
  return changes
}

/** Ask Google what it thinks (URL Inspection API). Requires a connected Search Console property. */
export async function inspectUrl(ctx: Ctx, urlId: string): Promise<UrlChange[]> {
  const row = ctx.db.get<UrlRow & { user_id: string; gsc_property: string | null }>(
    'SELECT m.*, p.user_id, p.gsc_property FROM monitored_urls m JOIN projects p ON p.id = m.project_id WHERE m.id = ?',
    [urlId],
  )
  if (!row || !row.gsc_property || !ctx.google.configured) return []
  const token = await accessTokenFor(ctx.db, ctx.google, row.user_id)
  if (!token) return []
  const r = await ctx.google.inspect(token, row.gsc_property, row.url)
  const at = ctx.now().toISOString()
  const changes: UrlChange[] = []
  if (row.index_checked_at) {
    if (row.index_status !== 'indexed' && r.status === 'indexed') changes.push({ url: row, kind: 'indexed', detail: r.coverageState })
    if (row.index_status === 'indexed' && r.status !== 'indexed') changes.push({ url: row, kind: 'deindexed', detail: r.coverageState })
  }
  ctx.db.tx(() => {
    ctx.db.run(
      `UPDATE monitored_urls SET index_status = ?, coverage_state = ?, google_canonical = ?, last_crawled_by_google = ?, index_checked_at = ? WHERE id = ?`,
      [r.status, r.coverageState, r.googleCanonical, r.lastCrawlTime, at, row.id],
    )
    for (const c of changes) ctx.db.run('INSERT INTO url_events (id, url_id, at, kind, detail) VALUES (?, ?, ?, ?, ?)', [id('ue'), row.id, at, c.kind, c.detail])
  })
  return changes
}

export function alertForUrlChanges(ctx: Ctx, changes: UrlChange[]) {
  const byProject = new Map<string, UrlChange[]>()
  for (const c of changes) byProject.set(c.url.project_id, [...(byProject.get(c.url.project_id) ?? []), c])
  for (const [projectId, cs] of byProject) {
    const p = ctx.db.get<{ user_id: string; domain: string }>('SELECT user_id, domain FROM projects WHERE id = ?', [projectId])
    if (!p) continue
    const path = (c: UrlChange) => {
      try {
        return new URL(c.url.url).pathname
      } catch {
        return c.url.url
      }
    }
    const list = (xs: UrlChange[]) => xs.slice(0, 3).map(path).join(', ') + (xs.length > 3 ? ` and ${xs.length - 3} more` : '')
    const group = (k: UrlChange['kind'][]) => cs.filter((c) => k.includes(c.kind))
    const href = (xs: UrlChange[]) => (xs.length === 1 ? `/app/indexing/${xs[0].url.id}` : '/app/indexing')

    const errs = group(['server_error', 'not_found'])
    if (errs.length)
      createAlert(ctx, { userId: p.user_id, projectId, kind: 'technical', severity: 'critical', title: `${plural(errs.length, 'URL')} started returning errors`, body: `${list(errs)} — ${errs[0].detail}. Google will drop pages that keep failing.`, href: href(errs) })
    const nonIdx = group(['became_non_indexable'])
    if (nonIdx.length)
      createAlert(ctx, { userId: p.user_id, projectId, kind: 'technical', severity: 'warning', title: `${plural(nonIdx.length, 'URL')} became non-indexable`, body: `${list(nonIdx)}: ${nonIdx[0].detail}.`, href: href(nonIdx) })
    const canon = group(['canonical_changed'])
    if (canon.length)
      createAlert(ctx, { userId: p.user_id, projectId, kind: 'technical', severity: 'warning', title: 'Canonical tag changed', body: `${list(canon)}. ${canon[0].detail}.`, href: href(canon) })
    const deidx = group(['deindexed'])
    if (deidx.length)
      createAlert(ctx, { userId: p.user_id, projectId, kind: 'index', severity: 'critical', title: `${plural(deidx.length, 'URL')} dropped out of Google’s index`, body: `${list(deidx)} — now “${deidx[0].detail}”.`, href: href(deidx) })
    const idx = group(['indexed'])
    if (idx.length)
      createAlert(ctx, { userId: p.user_id, projectId, kind: 'index', severity: 'success', title: `${plural(idx.length, 'URL')} became indexed`, body: `${list(idx)} ${idx.length === 1 ? 'is' : 'are'} now indexed by Google.`, href: href(idx) })
  }
}

/** Search Console allows 2,000 inspections/day per property; we stay well below it. */
export const DAILY_INSPECTIONS_PER_PROPERTY = 1500

export async function sweepDueUrls(ctx: Ctx, { limit = 200, concurrency = 4 } = {}) {
  const nowIso = ctx.now().toISOString()
  const due = ctx.db.all<{ id: string; index_checked_at: string | null; project_id: string; gsc_property: string | null }>(
    `SELECT m.id, m.index_checked_at, m.project_id, p.gsc_property FROM monitored_urls m JOIN projects p ON p.id = m.project_id
      WHERE m.next_check_at IS NOT NULL AND m.next_check_at <= ? ORDER BY m.next_check_at LIMIT ?`,
    [nowIso, limit],
  )
  const dayAgo = addHours(nowIso, -24)
  const inspectedToday = new Map<string, number>()
  const changes: UrlChange[] = []
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, due.length) }, async () => {
      while (cursor < due.length) {
        const d = due[cursor++]
        try {
          changes.push(...(await checkUrl(ctx, d.id)))
          // Google index status at most once per 24h per URL, within the property quota
          if (d.gsc_property && (!d.index_checked_at || d.index_checked_at < dayAgo)) {
            const used =
              inspectedToday.get(d.project_id) ??
              ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM monitored_urls WHERE project_id = ? AND index_checked_at > ?', [d.project_id, dayAgo])!.n
            if (used < DAILY_INSPECTIONS_PER_PROPERTY) {
              inspectedToday.set(d.project_id, used + 1)
              changes.push(...(await inspectUrl(ctx, d.id)))
            }
          }
        } catch (e) {
          console.error('[urls] check failed', d.id, e)
        }
      }
    }),
  )
  alertForUrlChanges(ctx, changes)
  return { checked: due.length, changes: changes.length }
}
