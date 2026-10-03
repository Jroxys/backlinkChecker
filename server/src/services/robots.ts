import { createHash, } from 'node:crypto'
import { createRequire } from 'node:module'
import type { Ctx } from '../context.js'
import { id } from '../lib/ids.js'
import { createAlert, plural } from './alerts.js'

const robotsParser = createRequire(import.meta.url)('robots-parser') as (url: string, body: string) => { isAllowed(url: string, ua?: string): boolean | undefined }

const norm = (s: string) =>
  s
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean)

/** Lines added/removed between two robots.txt bodies (comments and blank lines ignored). */
export function diffRobots(before: string, after: string) {
  const a = norm(before)
  const b = norm(after)
  return { added: b.filter((l) => !a.includes(l)), removed: a.filter((l) => !b.includes(l)) }
}

/**
 * Snapshot each project's robots.txt; on change, alert with the diff and — most
 * importantly — which monitored URLs Googlebot can no longer crawl.
 */
export async function checkRobots(ctx: Ctx, projectId: string) {
  const p = ctx.db.get<{ domain: string; user_id: string }>('SELECT domain, user_id FROM projects WHERE id = ?', [projectId])
  if (!p) return { changed: false }
  // Prefer the scheme/host the user's URLs actually use
  const sample = ctx.db.get<{ url: string }>("SELECT url FROM monitored_urls WHERE project_id = ? AND http_status = 200 LIMIT 1", [projectId])
  const origin = sample ? new URL(sample.url).origin : `https://${p.domain}`
  const url = `${origin}/robots.txt`
  let status: number | null = null
  let body = ''
  try {
    const res = await ctx.fetcher.fetchPage(url, { accept: 'text/plain,*/*;q=0.5', ownSite: true })
    status = res.status
    body = res.status === 200 ? res.body.slice(0, 500_000) : ''
  } catch {
    return { changed: false, error: true }
  }
  const hash = createHash('sha256').update(`${status}\n${norm(body).join('\n')}`).digest('hex')
  const last = ctx.db.get<{ hash: string; body: string; status: number | null }>('SELECT hash, body, status FROM robots_snapshots WHERE project_id = ? ORDER BY fetched_at DESC LIMIT 1', [projectId])
  if (last && last.hash === hash) return { changed: false }
  ctx.db.run('INSERT INTO robots_snapshots (id, project_id, url, fetched_at, status, hash, body) VALUES (?, ?, ?, ?, ?, ?, ?)', [id('rb'), projectId, url, ctx.now().toISOString(), status, hash, body])
  if (!last) return { changed: false, first: true } // baseline
  ctx.fetcher.forgetRobots(origin) // so the immediate URL re-checks see the new rules

  const { added, removed } = diffRobots(last.body, body)
  // Which monitored URLs flipped from crawlable to blocked for Googlebot?
  const before = robotsParser(url, last.body)
  const after = robotsParser(url, body)
  const urls = ctx.db.all<{ url: string }>('SELECT url FROM monitored_urls WHERE project_id = ?', [projectId]).map((r) => r.url)
  const newlyBlocked = urls.filter((u) => before.isAllowed(u, 'Googlebot') !== false && after.isAllowed(u, 'Googlebot') === false)
  const unblocked = urls.filter((u) => before.isAllowed(u, 'Googlebot') === false && after.isAllowed(u, 'Googlebot') !== false)

  const lines = [
    added.length ? `Added: ${added.slice(0, 5).join(' · ')}${added.length > 5 ? ' …' : ''}` : '',
    removed.length ? `Removed: ${removed.slice(0, 5).join(' · ')}${removed.length > 5 ? ' …' : ''}` : '',
    status !== last.status ? `Status ${last.status ?? '—'} → ${status ?? '—'}.` : '',
  ].filter(Boolean)
  const blockedText = newlyBlocked.length
    ? `${plural(newlyBlocked.length, 'monitored URL')} can no longer be crawled by Googlebot, e.g. ${newlyBlocked.slice(0, 3).map((u) => new URL(u).pathname).join(', ')}. `
    : 'No monitored URL lost crawl access. '
  createAlert(ctx, {
    userId: p.user_id,
    projectId,
    kind: 'robots',
    severity: newlyBlocked.length ? 'critical' : 'warning',
    title: newlyBlocked.length ? `robots.txt now blocks ${plural(newlyBlocked.length, 'URL')} from Google` : 'robots.txt changed',
    body: blockedText + lines.join(' ') + (unblocked.length ? ` ${plural(unblocked.length, 'URL')} became crawlable again.` : ''),
    href: '/app/indexing',
  })
  // Re-check affected URLs now rather than at their next scheduled time
  if (newlyBlocked.length || unblocked.length)
    ctx.db.run(`UPDATE monitored_urls SET next_check_at = ? WHERE project_id = ? AND url IN (${[...newlyBlocked, ...unblocked].map(() => '?').join(',')})`, [ctx.now().toISOString(), projectId, ...newlyBlocked, ...unblocked])
  return { changed: true, added, removed, newlyBlocked }
}
