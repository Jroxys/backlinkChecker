import type { Ctx } from '../context.js'
import { sweepDueBacklinks, addBacklinks } from '../services/backlinks.js'
import { sweepDueUrls } from '../services/urls.js'
import { discoverSitemaps, syncSitemap } from '../services/sitemaps.js'
import { deliverPendingAlerts } from '../services/notifier.js'
import { getPlan } from '../plans.js'
import { snapshotAll } from '../services/stats.js'
import { sendWeeklySummaries } from '../services/summary.js'
import { sendActivationEmails } from '../services/activation.js'
import { sendMonthlyReports } from '../services/report.js'
import { sweepHealth } from '../services/health.js'
import { sweepCwv } from '../services/cwv.js'
import { processTrials } from '../services/plan.js'
import { sendFirstScanEmails } from '../services/firstScan.js'
import { refreshPriorityPages, sweepWatch } from '../services/watch.js'
import { refreshSerp, sweepRankings, syncGscPositions } from '../services/rankings.js'
import { checkRobots } from '../services/robots.js'
import { checkLinkTargets, sweepFrontier } from '../services/linkgraph.js'
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
    const due = ctx.db.all<{ id: string }>(
      "SELECT s.id FROM sitemaps s JOIN projects p ON p.id = s.project_id WHERE p.paused = 0 AND (s.last_fetched_at IS NULL OR s.last_fetched_at < datetime('now', '-1 day'))",
    )
    for (const s of due) enqueue(ctx.db, 'sitemaps.sync', { sitemapId: s.id }, { dedupeKey: `sitemap:${s.id}` })
    return { queued: due.length }
  },
  /** Pull newest backlinks from the discovery provider for projects whose plan includes it. */
  'discovery.sweep': async (ctx) => {
    if (!ctx.provider) return { skipped: 'no provider configured' }
    // Discovery is a paid API call per project: paying plans only (not trials), and timed per project
    // so a provider that returns nothing new doesn't get called again every hour.
    const projects = ctx.db.all<{ id: string; domain: string; plan: string; last: string | null }>(
      `SELECT p.id, p.domain, u.plan, p.discovery_checked_at AS last
         FROM projects p JOIN users u ON u.id = p.user_id
        WHERE u.plan IN ('pro', 'agency') AND u.trial_ends_at IS NULL AND p.paused = 0`,
    )
    let added = 0
    for (const p of projects) {
      const every = getPlan(p.plan).limits.discovery === 'daily' ? 24 : 168
      if (p.last && Date.now() - new Date(p.last).getTime() < every * 3_600_000) continue
      ctx.db.run('UPDATE projects SET discovery_checked_at = ? WHERE id = ?', [new Date().toISOString(), p.id])
      const found = await ctx.provider.discover(p.domain, { limit: 100 })
      // Discovered links still go through our own verification before anyone sees them as "new".
      added += addBacklinks(ctx, p.id, found.map((f) => ({ sourceUrl: f.sourceUrl, targetUrl: f.targetUrl, authority: f.authority })), 'discovery').created.length
    }
    return { added }
  },
  'stats.snapshot': async (ctx) => snapshotAll(ctx),
  'summary.weekly': (ctx) => sendWeeklySummaries(ctx),
  'activation.sweep': (ctx) => sendActivationEmails(ctx),
  'reports.monthly': (ctx) => sendMonthlyReports(ctx),
  /** SSL certificate (daily) and domain registration (weekly) expiry; per-project timestamps gate the real work. */
  'health.sweep': (ctx) => sweepHealth(ctx, ctx.probes),
  /** Core Web Vitals field data; CrUX updates weekly, so each project refreshes every 6 days. */
  'cwv.sweep': (ctx) => sweepCwv(ctx),
  'trials.process': (ctx) => processTrials(ctx),
  'firstscan.sweep': (ctx) => sendFirstScanEmails(ctx),
  /** Near real-time: uptime and robots.txt on each plan's watch interval (checked every minute). */
  'watch.sweep': (ctx) => sweepWatch(ctx),
  'priority.refresh': async (ctx) => refreshPriorityPages(ctx),
  /** New keywords: backfill Search Console history, then live results if configured and due. */
  'rankings.sync': async (ctx, p) => {
    const projectId = String(p.projectId)
    await syncGscPositions(ctx, projectId, Number(p.days ?? 10))
    if (ctx.serp) {
      const fresh = ctx.db.all<{ id: string }>(
        "SELECT k.id FROM tracked_keywords k JOIN projects pr ON pr.id = k.project_id JOIN users u ON u.id = pr.user_id WHERE k.project_id = ? AND k.serp_checked_at IS NULL AND u.plan != 'free' LIMIT 50",
        [projectId],
      )
      for (const k of fresh) await refreshSerp(ctx, k.id).catch((e) => console.error('[rankings] serp', k.id, e))
    }
  },
  'rankings.sweep': (ctx) => sweepRankings(ctx),
  /** Link graph: visit domains that link to competitors to find the exact page; check competitor URLs others link to. */
  'linkgraph.frontier': (ctx) => sweepFrontier(ctx),
  'linkgraph.targets': (ctx) => checkLinkTargets(ctx),
  /** robots.txt for every project, hourly: a bad Disallow can de-index a site overnight. */
  'robots.sweep': async (ctx) => {
    const ps = ctx.db.all<{ id: string }>('SELECT id FROM projects WHERE paused = 0')
    let changed = 0
    for (const p of ps) if ((await checkRobots(ctx, p.id)).changed) changed++
    return { projects: ps.length, changed }
  },
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
  // Every minute so a "site is down" alert isn't held back
  { kind: 'alerts.deliver', everyMinutes: 1 },
  { kind: 'sitemaps.sweep', everyMinutes: 60 },
  { kind: 'discovery.sweep', everyMinutes: 60 },
  { kind: 'stats.snapshot', everyMinutes: 60 },
  { kind: 'watch.sweep', everyMinutes: 1 },
  { kind: 'priority.refresh', everyMinutes: 360 },
  { kind: 'rankings.sweep', everyMinutes: 360 },
  { kind: 'linkgraph.frontier', everyMinutes: 30 },
  { kind: 'linkgraph.targets', everyMinutes: 60 },
  { kind: 'activation.sweep', everyMinutes: 60 },
  { kind: 'health.sweep', everyMinutes: 60 },
  { kind: 'cwv.sweep', everyMinutes: 360 },
  { kind: 'trials.process', everyMinutes: 60 },
  { kind: 'firstscan.sweep', everyMinutes: 5 },
  // Monthly report: hourly, but it only sends on days 1–3 (UTC) and once per user per month.
  { kind: 'reports.monthly', everyMinutes: 60 },
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
    // Daily digest at 08:00 UTC
    const d = new Date()
    if (d.getUTCHours() === 8 && d.getUTCMinutes() === 0) enqueue(ctx.db, 'alerts.digest', {}, { dedupeKey: `digest:${d.toISOString().slice(0, 10)}` })
    // Weekly summary on Monday mornings (per-user guard prevents duplicates)
    if (d.getUTCDay() === 1 && d.getUTCHours() === 8 && d.getUTCMinutes() < 2) enqueue(ctx.db, 'summary.weekly', {}, { dedupeKey: `summary:${d.toISOString().slice(0, 10)}` })
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
