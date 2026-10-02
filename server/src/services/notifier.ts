import type { Ctx } from '../context.js'

export interface OutgoingAlert {
  id: string
  title: string
  body: string
  severity: string
  href: string | null
  project: string | null
}

export interface Notifier {
  email(to: string, subject: string, text: string): Promise<void>
  slack(webhookUrl: string, text: string): Promise<void>
  webhook(url: string, payload: unknown): Promise<void>
}

/** Real delivery. Email uses SMTP via nodemailer when SMTP_URL is set; otherwise logs. */
export async function createNotifier(smtpUrl: string, from: string): Promise<Notifier> {
  let send: ((to: string, subject: string, text: string) => Promise<void>) | null = null
  if (smtpUrl) {
    const nodemailer = await import('nodemailer')
    const transport = nodemailer.createTransport(smtpUrl)
    send = async (to, subject, text) => {
      await transport.sendMail({ from, to, subject, text })
    }
  }
  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`Webhook ${url} answered ${res.status}`)
  }
  return {
    async email(to, subject, text) {
      if (send) await send(to, subject, text)
      else console.log(`[mail:dev] to=${to} subject=${subject}\n${text}\n`)
    },
    slack: (url, text) => post(url, { text }),
    webhook: (url, payload) => post(url, payload),
  }
}

/** In-memory notifier for tests. */
export function memoryNotifier() {
  const sent: { channel: string; to: string; text: string }[] = []
  const n: Notifier & { sent: typeof sent } = {
    sent,
    async email(to, subject, text) {
      sent.push({ channel: 'email', to, text: subject + '\n' + text })
    },
    async slack(to, text) {
      sent.push({ channel: 'slack', to, text })
    },
    async webhook(to, payload) {
      sent.push({ channel: 'webhook', to, text: JSON.stringify(payload) })
    },
  }
  return n
}

const rank: Record<string, number> = { info: 0, success: 0, warning: 1, critical: 2 }

/**
 * Deliver alerts that haven't been sent yet. Respects each user's minimum severity
 * and digest preference (digest users get one email per day, sent by the 08:00 job).
 */
export async function deliverPendingAlerts(ctx: Ctx, { digest = false } = {}) {
  const rows = ctx.db.all<{
    id: string
    user_id: string
    email: string
    title: string
    body: string
    severity: string
    href: string | null
    domain: string | null
    s_email: number | null
    slack_webhook: string | null
    webhook_url: string | null
    s_digest: number | null
    min_severity: string | null
  }>(
    `SELECT a.id, a.user_id, u.email, a.title, a.body, a.severity, a.href, p.domain,
            s.email AS s_email, s.slack_webhook, s.webhook_url, s.digest AS s_digest, s.min_severity
       FROM alerts a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN projects p ON p.id = a.project_id
       LEFT JOIN notification_settings s ON s.user_id = a.user_id
      WHERE a.notified_at IS NULL
      ORDER BY a.created_at LIMIT 500`,
  )
  const byUser = new Map<string, typeof rows>()
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r])

  const at = ctx.now().toISOString()
  let delivered = 0
  for (const [, items] of byUser) {
    const u = items[0]
    const isDigest = (u.s_digest ?? 0) === 1
    if (isDigest !== digest && isDigest) continue // digest users wait for the daily run
    const min = rank[u.min_severity ?? 'warning'] ?? 1
    const relevant = items.filter((i) => (rank[i.severity] ?? 0) >= min || i.severity === 'success')
    const link = (h: string | null) => (h ? ctx.config.appUrl + h : ctx.config.appUrl + '/app/alerts')
    try {
      if (relevant.length) {
        if ((u.s_email ?? 1) === 1) {
          const subject = relevant.length === 1 ? `[Indexora] ${relevant[0].title}` : `[Indexora] ${relevant.length} updates on your websites`
          const text = relevant.map((i) => `• ${i.title}${i.domain ? ` — ${i.domain}` : ''}\n  ${i.body}\n  ${link(i.href)}`).join('\n\n')
          await ctx.notifier.email(u.email, subject, text + '\n\nManage notifications: ' + ctx.config.appUrl + '/app/alerts')
        }
        if (u.slack_webhook)
          await ctx.notifier.slack(u.slack_webhook, relevant.map((i) => `*${i.title}*${i.domain ? ` · ${i.domain}` : ''}\n${i.body}\n<${link(i.href)}|Open in Indexora>`).join('\n\n'))
        if (u.webhook_url)
          await ctx.notifier.webhook(u.webhook_url, { alerts: relevant.map((i) => ({ id: i.id, title: i.title, body: i.body, severity: i.severity, project: i.domain, url: link(i.href) })) })
      }
      for (const i of items) ctx.db.run('UPDATE alerts SET notified_at = ? WHERE id = ?', [at, i.id])
      delivered += relevant.length
    } catch (e) {
      console.error('[notify] delivery failed for', u.email, e) // retried next run
    }
  }
  return { delivered }
}
