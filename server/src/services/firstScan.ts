import type { Ctx } from '../context.js'
import { runAudit } from './audit.js'

const HOUR = 3_600_000

/**
 * "Here's what your first scan found" — once per project, as soon as every URL has been
 * checked (or after 6 hours, whichever comes first). The product proves itself without the
 * user having to come back and look.
 */
export async function sendFirstScanEmails(ctx: Ctx) {
  const now = ctx.now()
  const projects = ctx.db.all<{ id: string; domain: string; created_at: string; email: string; name: string; email_on: number | null }>(
    `SELECT p.id, p.domain, p.created_at, u.email, u.name, s.email AS email_on
       FROM projects p JOIN users u ON u.id = p.user_id LEFT JOIN notification_settings s ON s.user_id = u.id
      WHERE p.first_scan_sent_at IS NULL AND p.created_at >= ?`,
    [new Date(now.getTime() - 72 * HOUR).toISOString()],
  )
  let sent = 0
  for (const p of projects) {
    const c = ctx.db.get<{ total: number; checked: number }>(
      'SELECT COUNT(*) AS total, SUM(last_checked_at IS NOT NULL) AS checked FROM monitored_urls WHERE project_id = ? AND paused = 0',
      [p.id],
    )!
    const checked = c.checked ?? 0
    const age = now.getTime() - new Date(p.created_at).getTime()
    if (!checked || (checked < c.total && age < 6 * HOUR)) continue
    // Mark first: never send twice, even if the mail server hiccups.
    ctx.db.run('UPDATE projects SET first_scan_sent_at = ? WHERE id = ?', [now.toISOString(), p.id])
    if (p.email_on === 0) continue

    const n = (sql: string) => ctx.db.get<{ n: number }>(sql, [p.id])!.n
    const findings = [
      [n("SELECT COUNT(*) AS n FROM monitored_urls WHERE project_id = ? AND robots = 'noindex'"), 'marked noindex — Google is told not to index them'],
      [n('SELECT COUNT(*) AS n FROM monitored_urls WHERE project_id = ? AND http_status >= 400'), 'return an error (4xx/5xx)'],
      [n("SELECT COUNT(*) AS n FROM monitored_urls WHERE project_id = ? AND robots = 'blocked'"), 'blocked for Googlebot by robots.txt'],
      [n("SELECT COUNT(*) AS n FROM monitored_urls WHERE project_id = ? AND canonical = 'other'"), 'point their canonical to a different URL'],
      [n('SELECT COUNT(*) AS n FROM monitored_urls WHERE project_id = ? AND http_status BETWEEN 300 AND 399'), 'redirect somewhere else'],
    ].filter(([count]) => (count as number) > 0) as [number, string][]
    const audit = runAudit(ctx.db, p.id, now.toISOString())
    const bl = ctx.db.get<{ total: number; active: number; missing: number }>(
      "SELECT COUNT(*) AS total, SUM(status = 'active') AS active, SUM(status IN ('lost','broken')) AS missing FROM backlinks WHERE project_id = ?",
      [p.id],
    )!
    const plural = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`

    const lines = [
      `Hi ${p.name.split(' ')[0] || 'there'},`,
      '',
      `The first scan of ${p.domain} is done. We checked ${plural(checked, 'URL')}${audit.score !== null ? ` and gave the site an audit score of ${audit.score}/100` : ''}.`,
      '',
      findings.length ? 'What needs attention:' : 'Good news: every URL we checked is reachable and indexable.',
      ...findings.map(([k, what]) => `  • ${plural(k, 'URL')} ${what}`),
      ...(bl.total
        ? ['', `Backlinks: ${bl.active ?? 0} of ${bl.total} verified live so far${bl.missing ? `, ${bl.missing} missing or broken` : ''} (the rest are still being checked).`]
        : ['', `Next step: import the backlinks you already have — Search Console → Links → Latest links → Export works. We’ll verify each one daily.`]),
      '',
      `See every finding with the exact URLs: ${ctx.config.appUrl}/app/audit`,
      '',
      'From now on we keep checking on our own and only email you when something changes.',
    ]
    try {
      await ctx.notifier.email(p.email, findings.length ? `First scan of ${p.domain}: ${plural(findings.reduce((a, [k]) => a + k, 0), 'issue')} found` : `First scan of ${p.domain}: all clear`, lines.join('\n'))
      sent++
    } catch (e) {
      console.error('[first-scan] email failed', p.id, e)
    }
  }
  return { sent }
}
