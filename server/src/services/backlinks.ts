import { enqueue } from '../jobs/queue.js'
import type { Ctx } from '../context.js'
import { FetchError } from '../lib/fetcher.js'
import { analyzeHtml, findBacklink, type Rel } from '../lib/html.js'
import { addHours, id } from '../lib/ids.js'
import { normalizeDomain, parseHttpUrl, rootDomain } from '../lib/url.js'
import { getPlan } from '../plans.js'
import { createAlert, plural } from './alerts.js'
import { recordPageLinks } from './linkgraph.js'

export type BacklinkStatus = 'pending' | 'active' | 'lost' | 'broken' | 'blocked'

export interface BacklinkRow {
  paused: number
  id: string
  project_id: string
  source_url: string
  source_domain: string
  target_url: string
  found_target: string | null
  anchor: string | null
  rel: Rel | null
  status: BacklinkStatus
  origin: string
  authority: number | null
  page_noindex: number
  http_status: number | null
  last_error: string | null
  miss_count: number
  first_seen: string | null
  last_seen: string | null
  last_checked_at: string | null
  next_check_at: string | null
  created_at: string
}

/** A link is declared lost only after this many consecutive misses (avoids flapping on A/B tests, caches, outages). */
export const LOST_AFTER_MISSES = 2
/** Network-level failures are noisier; give them more room. */
export const BROKEN_AFTER_FAILURES = 3

export class LimitError extends Error {
  constructor(
    message: string,
    readonly limit: string,
  ) {
    super(message)
  }
}

export interface NewBacklinkInput {
  sourceUrl: string
  targetUrl?: string
  authority?: number | null
}

/** Adds backlinks to a project, de-duplicating and enforcing the owner's plan limit. Returns ids of new rows. */
export function addBacklinks(ctx: Ctx, projectId: string, items: NewBacklinkInput[], origin: 'manual' | 'import' | 'discovery' = 'manual') {
  const project = ctx.db.get<{ id: string; domain: string; user_id: string; plan: string; paused: number }>(
    'SELECT p.id, p.domain, p.user_id, p.paused, u.plan FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = ?',
    [projectId],
  )
  if (!project) throw new Error('Project not found')
  const plan = getPlan(project.plan)
  const used = ctx.db.get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM backlinks b JOIN projects p ON p.id = b.project_id WHERE p.user_id = ?',
    [project.user_id],
  )!.n

  const created: string[] = []
  const skipped: { sourceUrl: string; reason: string }[] = []
  const at = ctx.now().toISOString()

  ctx.db.tx(() => {
    for (const item of items) {
      const src = parseHttpUrl(item.sourceUrl)
      if (!src) {
        skipped.push({ sourceUrl: item.sourceUrl, reason: 'invalid_url' })
        continue
      }
      const srcDomain = normalizeDomain(src.hostname)!
      if (srcDomain === project.domain || srcDomain.endsWith('.' + project.domain)) {
        skipped.push({ sourceUrl: item.sourceUrl, reason: 'internal_link' })
        continue
      }
      let target = ''
      if (item.targetUrl) {
        const t = parseHttpUrl(item.targetUrl)
        const tDomain = t && normalizeDomain(t.hostname)
        if (!t || !tDomain || !(tDomain === project.domain || tDomain.endsWith('.' + project.domain))) {
          skipped.push({ sourceUrl: item.sourceUrl, reason: 'target_not_on_project_domain' })
          continue
        }
        target = t.href
      }
      if (project.paused || used + created.length >= plan.limits.backlinks) {
        skipped.push({ sourceUrl: item.sourceUrl, reason: 'plan_limit' })
        continue
      }
      const blId = id('bl')
      const res = ctx.db.run(
        `INSERT OR IGNORE INTO backlinks (id, project_id, source_url, source_domain, target_url, origin, authority, status, next_check_at, created_at)
         VALUES (:id, :project, :src, :domain, :target, :origin, :authority, 'pending', :at, :at)`,
        { id: blId, project: projectId, src: src.href, domain: srcDomain, target, origin, authority: item.authority ?? null, at },
      )
      if (res.changes) created.push(blId)
      else skipped.push({ sourceUrl: item.sourceUrl, reason: 'duplicate' })
    }
  })
  // Check new entries now rather than at the next periodic sweep (same dedupe key, so never doubled).
  if (created.length) enqueue(ctx.db, 'backlinks.sweep', {}, { dedupeKey: 'periodic:backlinks.sweep' })
  return { created, skipped }
}

export type BacklinkEvent =
  | { type: 'verified'; bl: BacklinkRow }
  | { type: 'new'; bl: BacklinkRow }
  | { type: 'recovered'; bl: BacklinkRow }
  | { type: 'lost'; bl: BacklinkRow; reason: string }
  | { type: 'broken'; bl: BacklinkRow; reason: string }
  | { type: 'rel_changed'; bl: BacklinkRow; from: Rel; to: Rel }
  | { type: 'noindexed'; bl: BacklinkRow }

/**
 * Re-checks one backlink: fetch the linking page, look for the link, update state.
 *
 * State machine
 *   found                        -> active   (first time: "verified"/"new"; after lost/broken: "recovered")
 *   page ok, link missing        -> miss_count++; lost after LOST_AFTER_MISSES
 *   page 4xx/5xx                 -> miss_count++; broken after LOST_AFTER_MISSES
 *   timeout / DNS / network      -> miss_count++; broken after BROKEN_AFTER_FAILURES
 *   robots.txt disallows us      -> blocked (we can't verify; we don't guess)
 */
export async function verifyBacklink(ctx: Ctx, backlinkId: string): Promise<BacklinkEvent[]> {
  const bl = ctx.db.get<BacklinkRow>('SELECT * FROM backlinks WHERE id = ?', [backlinkId])
  if (!bl) return []
  const project = ctx.db.get<{ domain: string; plan: string }>(
    'SELECT p.domain, u.plan FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = ?',
    [bl.project_id],
  )
  if (!project) return []

  const at = ctx.now().toISOString()
  const hours = getPlan(project.plan).limits.backlinkCheckHours
  // ±10% jitter so a big import doesn't come due in one burst forever after
  const next = addHours(at, hours * (0.9 + Math.random() * 0.2))
  const events: BacklinkEvent[] = []

  let httpStatus: number | null = null
  let found = false
  let anchor: string | null = bl.anchor
  let rel: Rel | null = bl.rel
  let foundTarget: string | null = bl.found_target
  let noindex = bl.page_noindex
  let error: string | null = null
  let status: BacklinkStatus = bl.status
  let miss = bl.miss_count

  try {
    const res = await ctx.fetcher.fetchPage(bl.source_url)
    httpStatus = res.status
    if (res.status >= 200 && res.status < 300) {
      const page = analyzeHtml(res.body, res.finalUrl, res.headers)
      // Feed the link graph: this page's other outbound links are free data
      try {
        recordPageLinks(ctx, res.finalUrl, page, { requestedUrl: bl.source_url })
      } catch (e) {
        console.error('[linkgraph] record failed', e)
      }
      const match = findBacklink(page, project.domain, bl.target_url || undefined)
      noindex = page.noindex ? 1 : 0
      if (match.found) {
        found = true
        anchor = match.anchor ?? null
        rel = match.rel ?? 'dofollow'
        foundTarget = match.href ?? null
      } else {
        error = match.matches ? `Page links to ${project.domain} but not to the expected URL` : `No link to ${project.domain} found on page`
      }
    } else {
      error = `Linking page returned HTTP ${res.status}`
    }
  } catch (e) {
    if (e instanceof FetchError && e.code === 'robots') {
      status = 'blocked'
      error = 'robots.txt disallows our crawler on this page'
    } else {
      error = (e as Error).message
    }
  }

  if (found) {
    if (bl.status === 'pending') events.push({ type: bl.origin === 'discovery' ? 'new' : 'verified', bl })
    else if (bl.status === 'lost' || bl.status === 'broken') events.push({ type: 'recovered', bl })
    if (bl.status === 'active' && bl.rel && rel && bl.rel !== rel) events.push({ type: 'rel_changed', bl, from: bl.rel, to: rel })
    if (bl.status === 'active' && !bl.page_noindex && noindex) events.push({ type: 'noindexed', bl })
    status = 'active'
    miss = 0
  } else if (status !== 'blocked') {
    miss += 1
    const networkFailure = httpStatus === null
    const pageGone = httpStatus !== null && httpStatus >= 400
    const threshold = networkFailure ? BROKEN_AFTER_FAILURES : LOST_AFTER_MISSES
    if (miss >= threshold) {
      const newStatus: BacklinkStatus = networkFailure || pageGone ? 'broken' : 'lost'
      if (bl.status === 'active') events.push({ type: newStatus, bl, reason: error ?? 'unknown' })
      status = bl.status === 'pending' && newStatus === 'lost' ? 'lost' : newStatus
    }
    // below threshold: keep the previous status, retry sooner than the normal schedule
  }

  const retrySoon = !found && status !== 'blocked' && miss > 0 && miss < (httpStatus === null ? BROKEN_AFTER_FAILURES : LOST_AFTER_MISSES)

  ctx.db.tx(() => {
    ctx.db.run(
      `UPDATE backlinks SET status = :status, http_status = :http, anchor = :anchor, rel = :rel, found_target = :ft,
         page_noindex = :noindex, last_error = :error, miss_count = :miss, last_checked_at = :at, next_check_at = CASE WHEN paused = 1 THEN NULL ELSE :next END,
         first_seen = CASE WHEN :found = 1 AND first_seen IS NULL THEN :at ELSE first_seen END,
         last_seen = CASE WHEN :found = 1 THEN :at ELSE last_seen END
       WHERE id = :id`,
      {
        id: bl.id,
        status,
        http: httpStatus,
        anchor,
        rel,
        ft: foundTarget,
        noindex,
        error: found ? null : error,
        miss,
        at,
        next: retrySoon ? addHours(at, 6) : next,
        found: found ? 1 : 0,
      },
    )
    ctx.db.run(
      'INSERT INTO backlink_checks (id, backlink_id, at, http_status, found, rel, anchor, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id('bc'), bl.id, at, httpStatus, found ? 1 : 0, found ? rel : null, found ? anchor : null, found ? null : error],
    )
  })
  return events
}

/** Turn a batch of per-link events into a few readable alerts per project. */
export function alertForEvents(ctx: Ctx, events: BacklinkEvent[]) {
  const byProject = new Map<string, BacklinkEvent[]>()
  for (const e of events) {
    const xs = byProject.get(e.bl.project_id) ?? []
    xs.push(e)
    byProject.set(e.bl.project_id, xs)
  }
  for (const [projectId, evs] of byProject) {
    const p = ctx.db.get<{ user_id: string; domain: string }>('SELECT user_id, domain FROM projects WHERE id = ?', [projectId])
    if (!p) continue
    const of = <T extends BacklinkEvent['type']>(t: T) => evs.filter((e): e is Extract<BacklinkEvent, { type: T }> => e.type === t)
    const describe = (bl: BacklinkRow) => `${bl.source_domain}${bl.authority ? ` (authority ${bl.authority})` : ''}`
    const top = (xs: { bl: BacklinkRow }[]) =>
      [...xs].sort((a, b) => (b.bl.authority ?? 0) - (a.bl.authority ?? 0)).slice(0, 3).map((x) => describe(x.bl)).join(', ')

    const lost = [...of('lost'), ...of('broken')]
    if (lost.length) {
      const followed = lost.filter((e) => e.bl.rel === 'dofollow').length
      createAlert(ctx, {
        userId: p.user_id,
        projectId,
        kind: 'backlink',
        severity: followed ? 'critical' : 'warning',
        title: `${plural(lost.length, 'backlink')} ${lost.length === 1 ? 'was' : 'were'} lost`,
        body: `Including ${top(lost)}. ${followed ? `${plural(followed, 'dofollow link')} affected. ` : ''}Each was missing on ${LOST_AFTER_MISSES} consecutive checks.`,
        href: '/app/backlinks?status=lost',
      })
    }
    const fresh = of('new')
    if (fresh.length)
      createAlert(ctx, {
        userId: p.user_id,
        projectId,
        kind: 'backlink',
        severity: 'success',
        title: `${plural(fresh.length, 'new backlink')} found`,
        body: `New links from ${top(fresh)} pointing to ${p.domain}.`,
        href: '/app/backlinks?status=new',
      })
    const recovered = of('recovered')
    if (recovered.length)
      createAlert(ctx, {
        userId: p.user_id,
        projectId,
        kind: 'backlink',
        severity: 'success',
        title: `${plural(recovered.length, 'backlink')} recovered`,
        body: `Links are back on ${top(recovered)}.`,
        href: '/app/backlinks',
      })
    const relChanged = of('rel_changed').filter((e) => e.from === 'dofollow')
    if (relChanged.length)
      createAlert(ctx, {
        userId: p.user_id,
        projectId,
        kind: 'backlink',
        severity: 'warning',
        title: `${plural(relChanged.length, 'link')} changed from dofollow to ${relChanged[0].to}`,
        body: `${top(relChanged)} still link to you, but no longer pass full link equity.`,
        href: '/app/backlinks',
      })
    const noindexed = of('noindexed')
    if (noindexed.length)
      createAlert(ctx, {
        userId: p.user_id,
        projectId,
        kind: 'backlink',
        severity: 'warning',
        title: `${plural(noindexed.length, 'linking page')} became noindex`,
        body: `${top(noindexed)} added a noindex directive; Google may drop those pages and the links with them.`,
        href: '/app/backlinks',
      })
  }
}

/** Verify every backlink that is due, a bounded batch at a time. Different hosts run in parallel; the fetcher serialises per host. */
export async function sweepDueBacklinks(ctx: Ctx, { limit = 200, concurrency = 8 } = {}) {
  const due = ctx.db.all<{ id: string; source_domain: string }>(
    `SELECT b.id, b.source_domain FROM backlinks b JOIN projects p ON p.id = b.project_id
      WHERE b.paused = 0 AND p.paused = 0 AND b.next_check_at IS NOT NULL AND b.next_check_at <= ? ORDER BY b.next_check_at LIMIT ?`,
    [ctx.now().toISOString(), limit],
  )
  // Interleave hosts so one big referring domain doesn't block the pool
  const byHost = new Map<string, string[]>()
  for (const d of due) byHost.set(rootDomain(d.source_domain), [...(byHost.get(rootDomain(d.source_domain)) ?? []), d.id])
  const order: string[] = []
  for (let i = 0; order.length < due.length; i++) for (const ids of byHost.values()) if (ids[i]) order.push(ids[i])

  const events: BacklinkEvent[] = []
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, order.length) }, async () => {
      while (cursor < order.length) {
        const blId = order[cursor++]
        try {
          events.push(...(await verifyBacklink(ctx, blId)))
        } catch (e) {
          console.error('[backlinks] verify failed', blId, e)
        }
      }
    }),
  )
  alertForEvents(ctx, events)
  return { checked: order.length, events: events.length }
}
