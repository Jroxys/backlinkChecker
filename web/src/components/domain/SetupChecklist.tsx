import { useState } from 'react'
import { Check, X, ArrowRight } from 'lucide-react'
import type { Project } from '@/api/types'
import { useMe, useNotificationSettings } from '@/api/hooks'
import { useSource } from '@/api/source'
import { Link } from '@/lib/router'
import { cn } from '@/lib/cn'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Controls'

/**
 * The activation steps from docs/LANSMAN.md, on the dashboard until they're done.
 * Every step is something that makes Indexora catch more for this user.
 */
export function SetupChecklist({ project }: { project: Project | undefined }) {
  const source = useSource()
  const me = useMe().data
  const notif = useNotificationSettings().data
  const key = `indexora-setup-dismissed:${project?.id}`
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  if (source.mode !== 'live' || !project || !me || dismissed || me.team?.role === 'member') return null

  const steps = [
    { done: true, title: 'Add your site', desc: `${project.domain} is being monitored.`, to: '/app/projects' },
    { done: !!project.gscProperty, title: 'Connect Search Console', desc: 'See whether Google actually indexed each page, not just whether it could.', to: '/app/settings?tab=integrations' },
    { done: (project.stats?.trackedBacklinks ?? 0) > 0, title: 'Import your backlinks', desc: 'Paste URLs or upload a CSV from Search Console, Ahrefs or Semrush.', to: '/app/backlinks' },
    ...(me.plan.features.slack
      ? [{ done: !!notif?.slackWebhook, title: 'Send alerts to Slack', desc: 'Get changes where you already work.', to: '/app/alerts' }]
      : []),
  ]
  const done = steps.filter((s) => s.done).length
  if (done === steps.length) return null

  return (
    <Card className="mb-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-fg">Finish setting up</h2>
          <p className="mt-0.5 text-[13px] text-fg-3">
            {done} of {steps.length} done — each step lets Indexora catch more for you.
          </p>
        </div>
        <button
          aria-label="Hide setup checklist"
          className="rounded-lg p-1.5 text-fg-4 hover:bg-surface-3 hover:text-fg"
          onClick={() => {
            setDismissed(true)
            try {
              localStorage.setItem(key, '1')
            } catch {
              /* ignore */
            }
          }}
        >
          <X className="size-4" />
        </button>
      </div>
      <ProgressBar value={(done / steps.length) * 100} className="mt-3" />
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <li key={s.title}>
            <Link
              to={s.to}
              className={cn('group flex h-full gap-3 rounded-xl border p-3.5 transition-colors', s.done ? 'border-line bg-surface-2' : 'border-line hover:border-primary/40 hover:bg-primary-soft/40')}
            >
              <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border', s.done ? 'border-success bg-success text-white' : 'border-line-strong')}>
                {s.done && <Check className="size-3" />}
              </span>
              <span className="min-w-0">
                <span className={cn('flex items-center gap-1 text-[13px] font-medium', s.done ? 'text-fg-3 line-through' : 'text-fg')}>
                  {s.title}
                  {!s.done && <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />}
                </span>
                <span className="mt-0.5 block text-[12px] text-fg-3">{s.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  )
}
