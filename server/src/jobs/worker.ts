import type { Ctx } from '../context.js'
import { sweepDueBacklinks, addBacklinks } from '../services/backlinks.js'
import { sweepDueUrls } from '../services/urls.js'
import { discoverSitemaps, syncSitemap } from '../services/sitemaps.js'
import { deliverPendingAlerts } from '../services/notifier.js'
import { getPlan } from '../plans.js'
import { snapshotAll } from '../services/stats.js'
import { sendWeeklySummaries } from '../services/summary.js'
import { claim, complete, enqueue, fail, prune, recoverStale, type Job } from './queue.js'

type Handler = (ctx: Ctx, payload: Record<string, unknown>) => Promise<unknown>

export const handlers: Record<string, Handler> = {
  'backlinks.sweep': (ctx) => sweepDueBacklinks(ctx),
  'urls.sweep': (ctx) => sweepDueUrls(ctx),
  'alerts.deliver': (ctx) => deliverPendingAlerts(ctx),
  'alerts.digest': (ctx) => deliverPendingAlerts(ctx, { digest: true }),
  'sitemaps.discover': async (ctx, p) => {
    await discoverSitemaps(ctx, String(p.projectId))
    const ids = ctx.db.all<{ id: string }>('SELECT id FROM sitemaps WHERE project_id = ?', [String(p.projectId)])
    for (const s of ids) enqueue(ctx.db, 'sitemaps.sync', { sitemapId: s.id }, { dedupeKey: `sitemap:${s.id}` })
  },
  'sitemaps.sync': (ctx, p) => syncSitemap(ctx, String(p.sitemapId)),
  'sitemaps.sweep': async (ctx) => {
    const due = ctx.db.all<{ id: string }>("SELECT id FROM sitemaps WHERE last_fetched_at IS NULL OR last_fetched_at < datetime('now', '-1 day')")
    for (const s of due) enqueue(ctx.db, 'sitemaps.sync', { sitemapId: s.id }, { dedupeKey: `sitemap:${s.id}` })
    return { queued: due.length }
  },
  /** Pull newest backlinks from the discovery provider for projects whose plan includes it. */
  'discovery.sweep': async (ctx) => {
    if (!ctx.provider) return { skipped: 'no provider configured' }
    const projects = ctx.db.all<{ id: string; domain: string; plan: string; last: string | null }>(
      `SELECT p.id, p.domain, u.plan, (SELECT MAX(created_at) FROM backlinks b WHERE b.project_id = p.id AND b.origin = 'discovery') AS last
         FROM projects p JOIN users u ON u.id = p.user_id WHERE u.plan IN ('pro', 'agency')`,
    )
    let added = 0
    for (const p of projects) {
      const every = getPlan(p.plan).limits.discovery === 'daily' ? 24 : 168
      if (p.last && Date.now() - new Date(p.last).getTime() < every * 3_600_000) continue
      const found = await ctx.provider.discover(p.domain, { limit: 100 })
      // Discovered links still go through our own verification before anyone sees them as "new".
      added += addBacklinks(ctx, p.id, found.map((f) => ({ sourceUrl: f.sourceUrl, targetUrl: f.targetUrl, authority: f.authority })), 'discovery').created.length
    }
    return { added }
  },
  'stats.snapshot': async (ctx) => snapshotAll(ctx),
  'summary.weekly': (ctx) => sendWeeklySummaries(ctx),
  'maintenance': async (ctx) => {
    recoverStale(ctx.db)
    prune(ctx.db)
    ctx.db.run('DELETE FROM sessions WHERE expires_at < ?', [new Date().toISOString()])
    ctx.db.run("DELETE FROM oauth_states WHERE created_at < datetime('now', '-1 hour')")
    ctx.db.run("DELETE FROM backlink_checks WHERE at < datetime('now', '-180 days')")
  },
}

/** Periodic jobs and how often to queue them. */
const schedule: { kind: string; everyMinutes: number }[] = [
  { kind: 'backlinks.sweep', everyMinutes: 1 },
  { kind: 'urls.sweep', everyMinutes: 1 },
  { kind: 'alerts.deliver', everyMinutes: 5 },
  { kind: 'sitemaps.sweep', everyMinutes: 60 },
  { kind: 'discovery.sweep', everyMinutes: 60 },
  { kind: 'stats.snapshot', everyMinutes: 60 },
  { kind: 'maintenance', everyMinutes: 30 },
]

export async function runOne(ctx: Ctx, job: Job) {
  const h = handlers[job.kind]
  if (!h) return fail(ctx.db, job, new Error(`No handler for ${job.kind}`), 1)
  try {
    await h(ctx, JSON.parse(job.payload))
    complete(ctx.db, job.id)
  } catch (e) {
    console.error(`[worker] ${job.kind} failed`, e)
    fail(ctx.db, job, e)
  }
}

export function startWorker(ctx: Ctx, { concurrency = 3, pollMs = 2000 } = {}) {
  let stopped = false
  const lastQueued = new Map<string, number>()
  recoverStale(ctx.db, 0)

  const tick = () => {
    const t = Date.now()
    for (const s of schedule) {
      if (t - (lastQueued.get(s.kind) ?? 0) >= s.everyMinutes * 60_000) {
        enqueue(ctx.db, s.kind, {}, { dedupeKey: `periodic:${s.kind}` })
        lastQueued.set(s.kind, t)
      }
    }
    // Daily digest at 08:00 server time
    const d = new Date()
    if (d.getHours() === 8 && d.getMinutes() === 0) enqueue(ctx.db, 'alerts.digest', {}, { dedupeKey: `digest:${d.toDateString()}` })
    // Weekly summary on Monday mornings (per-user guard prevents duplicates)
    if (d.getDay() === 1 && d.getHours() === 8 && d.getMinutes() < 2) enqueue(ctx.db, 'summary.weekly', {}, { dedupeKey: `summary:${d.toDateString()}` })
  }

  const loops = Array.from({ length: concurrency }, async () => {
    while (!stopped) {
      const job = claim(ctx.db)
      if (job) await runOne(ctx, job)
      else await new Promise((r) => setTimeout(r, pollMs))
    }
  })
  tick()
  const timer = setInterval(tick, 30_000)
  return {
    async stop() {
      stopped = true
      clearInterval(timer)
      await Promise.all(loops)
    },
  }
}
