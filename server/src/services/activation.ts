import type { Ctx } from '../context.js'

const DAY = 86_400_000

interface Candidate {
  id: string
  email: string
  name: string
  created_at: string
  email_on: number | null
  projects: number
  backlinks: number
  google: number
  last_sent: string | null
}

interface Nudge {
  kind: string
  afterDays: number
  applies: (u: Candidate, ctx: Ctx) => boolean
  subject: string
  body: (u: Candidate, ctx: Ctx) => string
}

/**
 * Onboarding nudges, in order. Each targets the next missing step of the activation funnel
 * and goes out at most once; most signups that never add a site simply forgot.
 */
const nudges: Nudge[] = [
  {
    kind: 'no_project',
    afterDays: 1,
    applies: (u) => u.projects === 0,
    subject: 'Add your site to Indexora (2 minutes)',
    body: (u, ctx) =>
      `Hi ${first(u)},\n\nYou signed up for Indexora yesterday but haven’t added a site yet.\n\n` +
      `Enter your domain and we’ll read your sitemap, check every page for noindex, canonical and robots problems, ` +
      `and start watching for changes. It takes about two minutes:\n\n${ctx.config.appUrl}/app/onboarding\n\n` +
      `If something got in the way, just reply — I read every message.`,
  },
  {
    kind: 'no_backlinks',
    afterDays: 3,
    applies: (u) => u.projects > 0 && u.backlinks === 0,
    subject: 'Are your backlinks still there?',
    body: (u, ctx) =>
      `Hi ${first(u)},\n\nYour site is being monitored, but you haven’t added any backlinks yet.\n\n` +
      `Links you paid for or earned disappear quietly: pages get edited, links turn nofollow, sites go down. ` +
      `Paste the URLs of pages that link to you (or upload a CSV export from any SEO tool) and we’ll check each one ` +
      `and alert you the day it changes:\n\n${ctx.config.appUrl}/app/backlinks\n\n` +
      `Want to try it first? Check a single link for free: ${ctx.config.appUrl}/tools/backlink-checker`,
  },
  {
    kind: 'no_gsc',
    afterDays: 5,
    applies: (u, ctx) => u.projects > 0 && u.google === 0 && ctx.google.configured,
    subject: 'See what Google actually indexed',
    body: (u, ctx) =>
      `Hi ${first(u)},\n\nRight now Indexora checks whether your pages *can* be indexed. Connect Google Search Console ` +
      `and we’ll also show whether Google *did* index them, plus your top queries and positions.\n\n` +
      `Access is read-only and you can disconnect at any time:\n\n${ctx.config.appUrl}/app/settings?tab=integrations`,
  },
]

const first = (u: Candidate) => u.name.split(' ')[0] || 'there'
const footer = (ctx: Ctx) =>
  `\n\n—\nYou’re getting this because you recently created an Indexora account. Turn off emails under Alerts → Email alerts: ${ctx.config.appUrl}/app/alerts`

/** Hourly. Sends at most one nudge per user, at least two days apart, only during their first two weeks. */
export async function sendActivationEmails(ctx: Ctx) {
  const now = ctx.now().getTime()
  const users = ctx.db.all<Candidate>(
    `SELECT u.id, u.email, u.name, u.created_at, s.email AS email_on,
            (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS projects,
            (SELECT COUNT(*) FROM backlinks b JOIN projects p ON p.id = b.project_id WHERE p.user_id = u.id) AS backlinks,
            (SELECT COUNT(*) FROM google_connections g WHERE g.user_id = u.id) AS google,
            (SELECT MAX(sent_at) FROM activation_emails a WHERE a.user_id = u.id) AS last_sent
       FROM users u LEFT JOIN notification_settings s ON s.user_id = u.id
      WHERE u.created_at >= ? AND u.plan = 'free'
        AND u.id NOT IN (SELECT member_id FROM team_members)`,
    [new Date(now - 14 * DAY).toISOString()],
  )
  let sent = 0
  for (const u of users) {
    if (u.email_on === 0) continue
    if (u.last_sent && now - new Date(u.last_sent).getTime() < 2 * DAY) continue
    const age = now - new Date(u.created_at).getTime()
    const done = new Set(ctx.db.all<{ kind: string }>('SELECT kind FROM activation_emails WHERE user_id = ?', [u.id]).map((r) => r.kind))
    const nudge = nudges.find((n) => !done.has(n.kind) && age >= n.afterDays * DAY && n.applies(u, ctx))
    if (!nudge) continue
    // Record first: a crash after sending must not lead to a duplicate on the next run.
    ctx.db.run('INSERT OR IGNORE INTO activation_emails (user_id, kind, sent_at) VALUES (?, ?, ?)', [u.id, nudge.kind, ctx.now().toISOString()])
    await ctx.notifier.email(u.email, nudge.subject, nudge.body(u, ctx) + footer(ctx))
    sent++
  }
  return { sent }
}
