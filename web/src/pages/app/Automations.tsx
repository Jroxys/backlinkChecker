import { CheckCircle2, Clock3, FileSearch, Link2, Map, Search, Sparkles, Bell, CalendarClock, ArrowRight } from 'lucide-react'
import { useMe, useNotificationSettings } from '@/api/hooks'
import { useSource } from '@/api/source'
import { Link } from '@/lib/router'
import { useProject } from '@/lib/project'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { AutomationsDemo } from './AutomationsDemo'

export function Automations() {
  const { mode } = useSource()
  return mode === 'demo' ? <AutomationsDemo /> : <AutomationsLive />
}

const every = (h: number) => (h === 168 ? 'Every week' : h === 24 ? 'Every 24 hours' : `Every ${h} hours`)

function AutomationsLive() {
  const me = useMe().data
  const notif = useNotificationSettings().data
  const { project } = useProject()
  const l = me?.plan.limits
  const gsc = !!project?.gscProperty
  const items = [
    { icon: FileSearch, title: 'Indexability checks', desc: 'Status code, noindex, canonical and Googlebot robots rules for every monitored URL.', freq: l ? every(l.urlCheckHours) : '—', on: true },
    { icon: Search, title: 'Google index inspection', desc: 'Asks Search Console whether each URL is indexed (within Google’s daily quota).', freq: 'Every 24 hours', on: gsc, cta: gsc ? null : { to: '/app/settings?tab=integrations', label: 'Connect Search Console' } },
    { icon: Link2, title: 'Backlink verification', desc: 'Opens every linking page and confirms your link, anchor and rel are still there.', freq: l ? every(l.backlinkCheckHours) : '—', on: true },
    { icon: Map, title: 'Sitemap watcher', desc: 'Re-reads your sitemaps and starts monitoring any new URLs.', freq: 'Every 24 hours', on: true },
    { icon: Sparkles, title: 'New backlink discovery', desc: 'Pulls newly found links from a backlink index and verifies them before showing them.', freq: l?.discovery ? 'Every week' : 'Pro plan', on: !!l?.discovery, cta: l?.discovery ? null : { to: '/app/settings?tab=billing', label: 'Upgrade' } },
    { icon: CalendarClock, title: 'Daily snapshot', desc: 'Stores index coverage and link counts so every chart has history.', freq: 'Every hour (one point per day)', on: true },
    { icon: Bell, title: notif?.digest ? 'Daily digest email' : 'Instant alerts', desc: notif?.digest ? 'One summary email every morning at 08:00.' : 'Changes are batched and sent within five minutes.', freq: notif?.digest ? 'Daily · 08:00' : 'Every 5 minutes', on: true, cta: { to: '/app/alerts', label: 'Notification settings' } },
  ]
  return (
    <>
      <PageHeader title="Automations" description="What Indexora runs for you in the background. Frequencies follow your plan; you’re only notified when something changes." />
      <Card className="overflow-hidden">
        <div className="divide-y divide-line-soft">
          {items.map((it) => (
            <div key={it.title} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border ${it.on ? 'border-primary/20 bg-primary-soft text-primary' : 'border-line bg-surface-3 text-fg-4'}`}>
                  <it.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-fg">{it.title}</div>
                  <p className="mt-0.5 text-[12.5px] text-fg-3">{it.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:w-72 sm:justify-end">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-2">
                  <Clock3 className="size-3.5 text-fg-4" /> {it.freq}
                </span>
                {it.on ? (
                  <Badge size="xs" tone="success" icon={<CheckCircle2 />}>
                    Active
                  </Badge>
                ) : (
                  <Badge size="xs" tone="outline">
                    Off
                  </Badge>
                )}
              </div>
              {it.cta && (
                <Link to={it.cta.to} className="sm:w-44 sm:text-right">
                  <Button size="xs" variant="ghost" rightIcon={<ArrowRight />}>
                    {it.cta.label}
                  </Button>
                </Link>
              )}
              {!it.cta && <span className="hidden sm:block sm:w-44" />}
            </div>
          ))}
        </div>
      </Card>
      <p className="mt-4 text-[12.5px] text-fg-4">Custom automations (your own schedules, conditions and channels) are on the roadmap. Tell us what you’d automate first.</p>
    </>
  )
}
