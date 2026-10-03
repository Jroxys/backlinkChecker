import type { Ctx } from '../context.js'

/**
 * Monday summary email. Monitoring products become invisible when nothing breaks,
 * and invisible products get cancelled — this is the weekly "here's what we did for you".
 */
export async function sendWeeklySummaries(ctx: Ctx) {
  const nowIso = ctx.now().toISOString()
  const weekAgoDate = new Date(ctx.now().getTime() - 7 * 86_400_000).toISOString().slice(0, 10)
  const users = ctx.db.all<{ id: string; email: string; name: string; email_on: number | null; last_summary_at: string | null }>(
    `SELECT u.id, u.email, u.name, s.email AS email_on, u.last_summary_at FROM users u
       LEFT JOIN notification_settings s ON s.user_id = u.id
      WHERE EXISTS (SELECT 1 FROM projects p WHERE p.user_id = u.id)`,
  )
  let sent = 0
  for (const u of users) {
    if (u.email_on === 0) continue
    if (u.last_summary_at && ctx.now().getTime() - new Date(u.last_summary_at).getTime() < 6 * 86_400_000) continue
    const projects = ctx.db.all<{ id: string; domain: string }>('SELECT id, domain FROM projects WHERE user_id = ?', [u.id])
    const sections: string[] = []
    for (const p of projects) {
      const latest = ctx.db.get<Record<string, number>>('SELECT * FROM daily_stats WHERE project_id = ? ORDER BY date DESC LIMIT 1', [p.id])
      const before = ctx.db.get<Record<string, number>>('SELECT * FROM daily_stats WHERE project_id = ? AND date <= ? ORDER BY date DESC LIMIT 1', [p.id, weekAgoDate])
      if (!latest) continue
      const d = (k: string) => (before ? latest[k] - before[k] : 0)
      const sign = (n: number) => (n > 0 ? `+${n}` : String(n))
      const checks = ctx.db.get<{ n: number }>(
        'SELECT COUNT(*) AS n FROM backlink_checks c JOIN backlinks b ON b.id = c.backlink_id WHERE b.project_id = ? AND c.at >= ?',
        [p.id, new Date(ctx.now().getTime() - 7 * 86_400_000).toISOString()],
      )!.n
      const alerts = ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM alerts WHERE project_id = ? AND created_at >= ?', [p.id, new Date(ctx.now().getTime() - 7 * 86_400_000).toISOString()])!.n
      sections.push(
        [
          `${p.domain}`,
          `  Indexed URLs: ${latest.indexed}${before ? ` (${sign(d('indexed'))})` : ''} · indexable: ${latest.indexable} of ${latest.urls}`,
          `  Live backlinks: ${latest.backlinks}${before ? ` (${sign(d('backlinks'))})` : ''} from ${latest.ref_domains} domains`,
          `  This week we ran ${checks.toLocaleString('en-US')} backlink checks and raised ${alerts} alert${alerts === 1 ? '' : 's'}.`,
        ].join('\n'),
      )
    }
    if (!sections.length) continue
    await ctx.notifier.email(
      u.email,
      'Your week in Indexora',
      `Hi ${u.name.split(' ')[0]},\n\nHere’s what Indexora watched for you this week:\n\n${sections.join('\n\n')}\n\nOpen your dashboard: ${ctx.config.appUrl}/app\n\nYou get this summary every Monday. Turn it off under Alerts → Email alerts.`,
    )
    ctx.db.run('UPDATE users SET last_summary_at = ? WHERE id = ?', [nowIso, u.id])
    sent++
  }
  return { sent }
}
