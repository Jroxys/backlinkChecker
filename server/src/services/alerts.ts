import type { Ctx } from '../context.js'
import { id } from '../lib/ids.js'

export type AlertKind = 'index' | 'backlink' | 'technical' | 'sitemap' | 'competitor' | 'robots'
export type Severity = 'critical' | 'warning' | 'info' | 'success'

export interface NewAlert {
  userId: string
  projectId?: string | null
  kind: AlertKind
  severity: Severity
  title: string
  body: string
  href?: string
}

export function createAlert(ctx: Ctx, a: NewAlert) {
  const alertId = id('al')
  ctx.db.run(
    `INSERT INTO alerts (id, user_id, project_id, kind, severity, title, body, href, created_at)
     VALUES (:id, :user, :project, :kind, :severity, :title, :body, :href, :at)`,
    {
      id: alertId,
      user: a.userId,
      project: a.projectId ?? null,
      kind: a.kind,
      severity: a.severity,
      title: a.title,
      body: a.body,
      href: a.href ?? null,
      at: ctx.now().toISOString(),
    },
  )
  return alertId
}

export function plural(n: number, one: string, many = one + 's') {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}
