import type { Ctx } from '../context.js'
import { getPlan } from '../plans.js'
import { runAudit } from './audit.js'
import { projectSnapshot } from './stats.js'
import type { KeywordRow } from './keywords.js'

const DAY = 86_400_000

/**
 * Everything a client report shows, for one project. Used by the shared report page and
 * the monthly email. Reads only stored data: a public link must never trigger Google calls.
 */
export function buildReport(ctx: Ctx, projectId: string) {
  const { db } = ctx
  const p = db.get<{ id: string; name: string; domain: string; user_id: string; plan: string; brand_name: string | null; brand_logo_url: string | null; brand_color: string | null }>(
    `SELECT p.id, p.name, p.domain, p.user_id, u.plan, u.brand_name, u.brand_logo_url, u.brand_color
       FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
    [projectId],
  )
  if (!p) return null
  const nowIso = ctx.now().toISOString()
  const end = ctx.now()
  const start = new Date(end.getTime() - 29 * DAY)
  const stats = projectSnapshot(db, p.id, nowIso)
  const history = db.all<{ date: string; indexed: number; indexable: number; backlinks: number; ref_domains: number }>(
    'SELECT date, indexed, indexable, backlinks, ref_domains FROM daily_stats WHERE project_id = ? AND date >= ? ORDER BY date',
    [p.id, start.toISOString().slice(0, 10)],
  )
  const audit = runAudit(db, p.id, nowIso)
  const issues = audit.checks
    .filter((c) => c.affected > 0)
    .sort((a, b) => (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1) || b.affected - a.affected)
    .slice(0, 5)
    .map((c) => ({ id: c.id, title: c.title, severity: c.severity, affected: c.affected, fix: c.fix }))
  const cached = db.get<{ body: string }>("SELECT body FROM gsc_cache WHERE project_id = ? AND key = 'queries:28d'", [p.id])
  const queries = cached
    ? ((JSON.parse(cached.body) as { rows?: KeywordRow[] }).rows ?? []).slice(0, 8).map((r) => ({ query: r.query, position: r.position, clicks: r.clicks, impressions: r.impressions }))
    : []
  const whiteLabel = getPlan(p.plan).features.whiteLabel
  return {
    project: { name: p.name, domain: p.domain },
    period: { start: start.toISOString(), end: end.toISOString() },
    gsc: stats.unknown < stats.urls,
    stats,
    history,
    audit: { score: audit.score, issues },
    queries,
    branding: whiteLabel ? { name: p.brand_name, logoUrl: p.brand_logo_url, color: p.brand_color } : null,
    generatedAt: nowIso,
  }
}

export type Report = NonNullable<ReturnType<typeof buildReport>>

/**
 * First of the month: a plain-text report per project for plans that include reports.
 * Paid plans only, opt-out under Alerts, and at most once per calendar month per user.
 */
export async function sendMonthlyReports(ctx: Ctx) {
  const month = ctx.now().toISOString().slice(0, 7)
  const users = ctx.db.all<{ id: string; email: string; name: string; plan: string; enabled: number | null; last: string | null }>(
    `SELECT u.id, u.email, u.name, u.plan, s.monthly_report AS enabled, u.last_report_month AS last
       FROM users u LEFT JOIN notification_settings s ON s.user_id = u.id
      WHERE u.plan != 'free' AND EXISTS (SELECT 1 FROM projects p WHERE p.user_id = u.id)`,
  )
  let sent = 0
  for (const u of users) {
    if (u.enabled === 0 || u.last === month || !getPlan(u.plan).features.reports) continue
    const projects = ctx.db.all<{ id: string; report_token: string | null }>('SELECT id, report_token FROM projects WHERE user_id = ? ORDER BY created_at', [u.id])
    const sections = projects.map((p) => reportText(ctx, buildReport(ctx, p.id)!, p.report_token))
    ctx.db.run('UPDATE users SET last_report_month = ? WHERE id = ?', [month, u.id])
    await ctx.notifier.email(
      u.email,
      `Your monthly SEO report — ${new Date(ctx.now().getTime() - DAY).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
      `Hi ${u.name.split(' ')[0] || 'there'},\n\nHere’s the last 30 days for your sites.\n\n${sections.join('\n\n')}\n\n` +
        `Open the full printable report: ${ctx.config.appUrl}/app/reports\n\nYou get this on the 1st of each month. Turn it off under Alerts → Email alerts.`,
    )
    sent++
  }
  return { sent }
}

function reportText(ctx: Ctx, r: Report, token: string | null) {
  const s = r.stats
  const first = r.history[0]
  const delta = (now: number, then: number | undefined) => (then === undefined ? '' : ` (${now - then >= 0 ? '+' : ''}${now - then})`)
  return [
    r.project.domain,
    r.gsc
      ? `  Indexed by Google: ${s.indexed} of ${s.urls}${delta(s.indexed, first?.indexed)}`
      : `  Indexable: ${s.indexable} of ${s.urls}${delta(s.indexable, first?.indexable)}`,
    `  Live backlinks: ${s.backlinks}${delta(s.backlinks, first?.backlinks)} from ${s.refDomains} domains · ${s.gained30d} new, ${s.lost30d} lost`,
    `  Audit score: ${r.audit.score ?? '—'}${r.audit.issues[0] ? ` · top issue: ${r.audit.issues[0].title} (${r.audit.issues[0].affected})` : ''}`,
    ...(token ? [`  Client link: ${ctx.config.appUrl}/r/${token}`] : []),
  ].join('\n')
}
