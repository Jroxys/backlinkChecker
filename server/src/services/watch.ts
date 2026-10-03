import { randomBytes } from 'node:crypto'
import type { Ctx } from '../context.js'
import { enqueue } from '../jobs/queue.js'
import { FetchError } from '../lib/fetcher.js'
import { id } from '../lib/ids.js'
import { urlKey } from '../lib/url.js'
import { getPlan } from '../plans.js'
import { createAlert } from './alerts.js'
import { checkRobots } from './robots.js'
import { addUrls } from './urls.js'

const MIN = 60_000

/**
 * Near real-time watch. Daily checks catch slow problems; these catch the expensive ones
 * the day they happen: the site going down, a deploy adding noindex to key pages, robots.txt
 * blocking Google. Intervals follow the plan (Free hourly … Pro/Agency every 5 minutes).
 */

/**
 * Keep each project's priority pages in line with the plan: the home page, then the pages that
 * earn the most clicks in Search Console, then the shortest sitemap URLs. Manual picks stay.
 */
export function selectPriorityPages(ctx: Ctx, projectId: string) {
  const p = ctx.db.get<{ id: string; domain: string; plan: string }>('SELECT p.id, p.domain, u.plan FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = ?', [projectId])
  if (!p) return []
  const limit = getPlan(p.plan).limits.priorityPages
  let urls = ctx.db.all<{ id: string; url: string; priority_manual: number; in_sitemap: number }>(
    'SELECT id, url, priority_manual, in_sitemap FROM monitored_urls WHERE project_id = ? AND paused = 0',
    [p.id],
  )
  // The home page is always watched; add it if the sitemap didn't list it.
  const isHome = (u: string) => new URL(u).pathname === '/'
  if (!urls.some((u) => isHome(u.url))) {
    addUrls(ctx, p.id, [`https://${p.domain}/`], 'manual')
    urls = ctx.db.all('SELECT id, url, priority_manual, in_sitemap FROM monitored_urls WHERE project_id = ? AND paused = 0', [p.id])
  }
  const clicks = new Map<string, number>()
  const cached = ctx.db.get<{ body: string }>("SELECT body FROM gsc_cache WHERE project_id = ? AND key = 'queries:28d'", [p.id])
  if (cached) {
    for (const r of (JSON.parse(cached.body) as { rows?: { page: string | null; clicks: number }[] }).rows ?? []) {
      if (!r.page) continue
      try {
        const k = urlKey(r.page)
        clicks.set(k, (clicks.get(k) ?? 0) + r.clicks)
      } catch {
        /* skip malformed */
      }
    }
  }
  const score = (u: { url: string; in_sitemap: number }) => {
    const k = urlKey(u.url)
    return [isHome(u.url) ? 1 : 0, clicks.get(k) ?? 0, u.in_sitemap, -new URL(u.url).pathname.length] as const
  }
  const manual = urls.filter((u) => u.priority_manual)
  const auto = urls
    .filter((u) => !u.priority_manual)
    .sort((a, b) => {
      const [x, y] = [score(a), score(b)]
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]
      return 0
    })
  const chosen = new Set([...manual, ...auto].slice(0, limit).map((u) => u.id))
  ctx.db.tx(() => {
    for (const u of urls) ctx.db.run('UPDATE monitored_urls SET priority = ? WHERE id = ?', [chosen.has(u.id) ? 1 : 0, u.id])
  })
  return [...chosen]
}

/** Is the home page answering? Two failures in a row (a minute apart) before we call it down. */
export async function checkUptime(ctx: Ctx, projectId: string) {
  const p = ctx.db.get<{ id: string; user_id: string; domain: string }>('SELECT id, user_id, domain FROM projects WHERE id = ?', [projectId])
  if (!p) return null
  // The project's home page as we actually reach it (scheme, www and port included); prefer one that answered 200
  const home = ctx.db
    .all<{ url: string; http_status: number | null }>('SELECT url, http_status FROM monitored_urls WHERE project_id = ? ORDER BY http_status = 200 DESC', [p.id])
    .find((r) => new URL(r.url).pathname === '/')
  const url = home?.url ?? `https://${p.domain}/`
  ctx.db.run("INSERT OR IGNORE INTO uptime (project_id, url, state) VALUES (?, ?, 'unknown')", [p.id, url])
  const row = ctx.db.get<{ state: string; fails: number; since: string | null }>('SELECT state, fails, since FROM uptime WHERE project_id = ?', [p.id])!
  const nowIso = ctx.now().toISOString()

  let ok = false
  let error: string | null = null
  let ms: number | null = null
  try {
    const res = await ctx.fetcher.fetchPage(url, { ownSite: true })
    ms = res.timeMs
    ok = res.status < 500
    if (!ok) error = `HTTP ${res.status}`
  } catch (e) {
    error = e instanceof FetchError ? (e.code === 'timeout' ? 'No response within 15 seconds' : e.message) : 'Connection failed'
  }

  if (ok) {
    if (row.state === 'down') {
      const mins = row.since ? Math.max(1, Math.round((ctx.now().getTime() - new Date(row.since).getTime()) / MIN)) : null
      ctx.db.run('UPDATE outages SET ended_at = ? WHERE project_id = ? AND ended_at IS NULL', [nowIso, p.id])
      createAlert(ctx, { userId: p.user_id, projectId: p.id, kind: 'technical', severity: 'success', title: `${p.domain} is back up`, body: `The site answers again${mins ? ` after about ${mins} minute${mins === 1 ? '' : 's'} down` : ''}.`, href: '/app' })
    }
    ctx.db.run("UPDATE uptime SET url = ?, state = 'up', fails = 0, since = CASE WHEN state = 'up' THEN since ELSE ? END, checked_at = ?, response_ms = ?, last_error = NULL WHERE project_id = ?", [url, nowIso, nowIso, ms, p.id])
    return { state: 'up' as const }
  }

  const fails = row.fails + 1
  const goesDown = fails >= 2 && row.state !== 'down'
  if (goesDown) {
    ctx.db.run('INSERT INTO outages (id, project_id, started_at, error) VALUES (?, ?, ?, ?)', [id('out'), p.id, nowIso, error])
    createAlert(ctx, {
      userId: p.user_id,
      projectId: p.id,
      kind: 'technical',
      severity: 'critical',
      title: `${p.domain} is down`,
      body: `${url} failed twice in a row: ${error}. Visitors and Googlebot can’t reach the site; if it stays down for days, pages start dropping out of Google.`,
      href: '/app',
    })
  }
  ctx.db.run('UPDATE uptime SET url = ?, state = ?, fails = ?, since = CASE WHEN ? THEN ? ELSE since END, checked_at = ?, response_ms = NULL, last_error = ? WHERE project_id = ?', [
    url,
    goesDown || row.state === 'down' ? 'down' : row.state,
    fails,
    goesDown ? 1 : 0,
    nowIso,
    nowIso,
    error,
    p.id,
  ])
  return { state: goesDown || row.state === 'down' ? ('down' as const) : ('unconfirmed' as const) }
}

/**
 * Every minute: run uptime and robots.txt checks for projects that are due on their plan's
 * interval. After a failed uptime check we look again one minute later to confirm.
 */
export async function sweepWatch(ctx: Ctx) {
  const now = ctx.now().getTime()
  const projects = ctx.db.all<{ id: string; plan: string; checked_at: string | null; fails: number | null; robots_checked_at: string | null }>(
    `SELECT p.id, u.plan, w.checked_at, w.fails, p.robots_checked_at
       FROM projects p JOIN users u ON u.id = p.user_id LEFT JOIN uptime w ON w.project_id = p.id
      WHERE p.paused = 0`,
  )
  let uptime = 0
  let robots = 0
  for (const p of projects) {
    const every = getPlan(p.plan).limits.watchMinutes * MIN
    const due = (iso: string | null, ms: number) => !iso || now - new Date(iso).getTime() >= ms - 5_000
    if (due(p.checked_at, (p.fails ?? 0) > 0 ? MIN : every)) {
      await checkUptime(ctx, p.id).catch((e) => console.error('[watch] uptime', p.id, e))
      uptime++
    }
    if (due(p.robots_checked_at, every)) {
      ctx.db.run('UPDATE projects SET robots_checked_at = ? WHERE id = ?', [ctx.now().toISOString(), p.id])
      await checkRobots(ctx, p.id).catch((e) => console.error('[watch] robots', p.id, e))
      robots++
    }
  }
  return { uptime, robots }
}

/** Daily: refresh which pages get the fast interval (new top pages, plan changes). */
export function refreshPriorityPages(ctx: Ctx) {
  const ps = ctx.db.all<{ id: string }>('SELECT id FROM projects WHERE paused = 0')
  for (const p of ps) selectPriorityPages(ctx, p.id)
  return { projects: ps.length }
}

/** "I just deployed": check priority pages, robots.txt and the home page right now. */
export function triggerDeployCheck(ctx: Ctx, projectId: string) {
  const at = ctx.now().toISOString()
  const pages = ctx.db.run('UPDATE monitored_urls SET next_check_at = ? WHERE project_id = ? AND priority = 1 AND paused = 0', [at, projectId]).changes
  ctx.db.run('UPDATE projects SET robots_checked_at = NULL WHERE id = ?', [projectId])
  ctx.db.run('UPDATE uptime SET checked_at = NULL WHERE project_id = ?', [projectId])
  enqueue(ctx.db, 'urls.sweep', {}, { dedupeKey: 'periodic:urls.sweep' })
  enqueue(ctx.db, 'watch.sweep', {}, { dedupeKey: 'periodic:watch.sweep' })
  return { pages }
}

export const newDeployToken = () => 'dep_' + randomBytes(18).toString('base64url')
