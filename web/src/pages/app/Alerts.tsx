import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BellOff, CheckCheck, Mail, MessageSquare, Settings2, Inbox, Webhook } from 'lucide-react'
import type { Alert } from '@/api/types'
import { useAction, useAlerts, useMe, useNotificationSettings } from '@/api/hooks'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Select } from '@/components/ui/Dropdown'
import { Input, Label, Switch } from '@/components/ui/Controls'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AlertIcon } from '@/components/AlertIcon'
import { formatTime, formatDate } from '@/utils/format'

type View = 'all' | 'unread' | 'critical'

function dayLabel(iso: string, now: Date) {
  const d = new Date(iso)
  const diff = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 86400000)
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : formatDate(iso)
}

export function Alerts() {
  const q = useAlerts()
  const [view, setView] = useState<View>('all')
  const [kind, setKind] = useState<'all' | Alert['kind']>('all')
  const markRead = useAction((s) => s.markAlertRead, { invalidate: ['alerts'] })
  const markAll = useAction((s) => s.markAllAlertsRead, { invalidate: ['alerts'], success: () => ({ title: 'All alerts marked as read' }) })
  const list = q.data?.alerts ?? []
  const now = new Date()

  const shown = list.filter((a) => (view === 'all' || (view === 'unread' ? !a.read : a.severity === 'critical')) && (kind === 'all' || a.kind === kind))
  const groups = useMemo(() => {
    const g: Record<string, Alert[]> = {}
    shown.forEach((a) => (g[dayLabel(a.time, now)] ??= []).push(a))
    return Object.entries(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])
  const unread = list.filter((a) => !a.read).length

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Changes that need a decision. Each alert explains what happened and what to do next."
        actions={
          <Button leftIcon={<CheckCheck />} disabled={!unread} loading={markAll.isPending} onClick={() => markAll.mutate([])}>
            Mark all as read
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-3">
            <Tabs<View>
              className="flex-1 !border-b-0"
              value={view}
              onChange={setView}
              items={[
                { value: 'all', label: 'All', count: list.length },
                { value: 'unread', label: 'Unread', count: unread },
                { value: 'critical', label: 'Critical', count: list.filter((a) => a.severity === 'critical').length },
              ]}
            />
            <div className="pb-2.5">
              <Select
                size="sm"
                align="right"
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'all', label: 'All types' },
                  { value: 'index', label: 'Indexing' },
                  { value: 'backlink', label: 'Backlinks' },
                  { value: 'technical', label: 'Technical' },
                  { value: 'sitemap', label: 'Sitemaps' },
                  { value: 'robots', label: 'robots.txt' },
                  { value: 'competitor', label: 'Competitors' },
                ]}
              />
            </div>
          </div>
          <div className="border-t border-line">
            {q.isLoading ? (
              <div className="space-y-4 p-5">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <EmptyState
                icon={view === 'unread' ? <Inbox /> : <BellOff />}
                title={list.length === 0 ? 'No alerts yet' : view === 'unread' ? 'You’re all caught up' : 'No alerts of this type'}
                description={
                  list.length === 0
                    ? 'Alerts appear when something changes: a lost backlink, a page dropping out of the index, a new server error or new URLs in your sitemap.'
                    : 'Nothing matched this filter. That’s usually a good sign.'
                }
              />
            ) : (
              groups.map(([day, items]) => (
                <div key={day}>
                  <div className="sticky top-14 z-[1] border-b border-line-soft bg-surface-2/95 px-5 py-2 text-[11.5px] font-medium text-fg-3 backdrop-blur">{day}</div>
                  <div className="divide-y divide-line-soft">
                    {items.map((a) => (
                      <div key={a.id} className={cn('group relative flex gap-4 px-5 py-4 transition-colors hover:bg-surface-2', !a.read && 'bg-primary-soft/35')}>
                        {!a.read && <span className="absolute top-0 bottom-0 left-0 w-0.5 bg-primary" />}
                        <AlertIcon alert={a} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[14px] font-semibold text-fg">{a.title}</h3>
                            {a.severity === 'critical' && (
                              <Badge size="xs" tone="error">
                                Action needed
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{a.description}</p>
                          <div className="mt-2.5 flex flex-wrap items-center gap-3">
                            {a.href && (
                              <Link to={a.href} onClick={() => !a.read && markRead.mutate([a.id])}>
                                <Button size="xs" variant={a.severity === 'critical' ? 'primary' : 'secondary'} rightIcon={<ArrowRight />}>
                                  Open
                                </Button>
                              </Link>
                            )}
                            {!a.read && (
                              <button onClick={() => markRead.mutate([a.id])} className="text-[12px] font-medium text-fg-3 hover:text-fg">
                                Mark read
                              </button>
                            )}
                            <span className="text-[12px] text-fg-4">
                              {a.project ?? 'Account'} · <span className="tnum">{formatTime(a.time)}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <NotificationPrefs />
      </div>
    </>
  )
}

function NotificationPrefs() {
  const q = useNotificationSettings()
  const me = useMe().data
  const save = useAction((s) => s.saveNotificationSettings, { invalidate: ['notificationSettings'], success: () => ({ title: 'Notification settings saved' }) })
  const [slack, setSlack] = useState('')
  const [hook, setHook] = useState('')
  useEffect(() => {
    if (q.data) {
      setSlack(q.data.slackWebhook ?? '')
      setHook(q.data.webhookUrl ?? '')
    }
  }, [q.data])
  const s = q.data
  const canSlack = me?.plan.features.slack
  const canHook = me?.plan.features.webhooks

  const member = me?.team?.role === 'member'
  return (
    <fieldset disabled={member} className={cn('min-w-0 space-y-4', member && 'opacity-70')}>
      {member && <p className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-[13px] text-fg-2">Notification settings belong to {me?.team?.ownerName}, the workspace owner.</p>}
      <Card>
        <CardHeader title="How we notify you" icon={<Settings2 />} />
        <div className="mt-3 divide-y divide-line-soft border-t border-line-soft">
          <Row title="Email alerts" desc={me?.team?.role === 'member' ? `Sent to ${me.team.ownerName}, the workspace owner` : (me?.user.email ?? '')} icon={<Mail className="size-4 text-fg-4" />}>
            <Switch size="sm" label="Email alerts" checked={!!s?.email} onChange={(v) => save.mutate([{ email: v }])} />
          </Row>
          <Row title="Daily digest" desc="One email at 08:00 instead of instant alerts">
            <Switch size="sm" label="Daily digest" checked={!!s?.digest} onChange={(v) => save.mutate([{ digest: v }])} />
          </Row>
          {me?.plan.features.reports && (
            <Row title="Monthly report" desc="A 30-day summary of every project on the 1st of each month">
              <Switch size="sm" label="Monthly report" checked={(s?.monthlyReport ?? 1) !== 0} onChange={(v) => save.mutate([{ monthlyReport: v }])} />
            </Row>
          )}
          <div className="px-5 py-3">
            <Label>Minimum severity</Label>
            <Select
              size="sm"
              value={s?.minSeverity ?? 'warning'}
              onChange={(v) => save.mutate([{ minSeverity: v }])}
              width={260}
              options={[
                { value: 'info', label: 'Everything (incl. new URLs)' },
                { value: 'warning', label: 'Warnings and critical' },
                { value: 'critical', label: 'Critical only' },
              ]}
            />
            <p className="mt-1.5 text-[11.5px] text-fg-4">Good news (newly indexed pages, new or recovered links) is always included.</p>
          </div>
        </div>
      </Card>
      <Card className="p-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
          <MessageSquare className="size-4 text-fg-4" /> Slack
          {!canSlack && <Badge size="xs" tone="primary">Starter+</Badge>}
        </div>
        <p className="mt-1 text-[12px] text-fg-3">Paste an incoming-webhook URL for the channel that should get alerts.</p>
        <Input className="mt-3" disabled={!canSlack} value={slack} onChange={(e) => setSlack(e.target.value)} placeholder="https://hooks.slack.com/services/…" />
        <div className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-fg">
          <Webhook className="size-4 text-fg-4" /> Webhook
          {!canHook && <Badge size="xs" tone="primary">Pro+</Badge>}
        </div>
        <p className="mt-1 text-[12px] text-fg-3">We POST a JSON payload with each batch of alerts.</p>
        <Input className="mt-3" disabled={!canHook} value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://example.com/hooks/indexora" />
        <div className="mt-4 flex justify-between">
          {!canSlack ? (
            <Link to="/app/settings?tab=billing" className="self-center text-[12.5px] font-medium text-primary-ink hover:underline">
              Compare plans
            </Link>
          ) : (
            <span />
          )}
          <Button
            size="sm"
            variant="primary"
            disabled={!canSlack}
            loading={save.isPending}
            onClick={() => save.mutate([{ ...(canSlack ? { slackWebhook: slack || null } : {}), ...(canHook ? { webhookUrl: hook || null } : {}) }])}
          >
            Save channels
          </Button>
        </div>
      </Card>
    </fieldset>
  )
}

function Row({ title, desc, icon, children }: { title: string; desc: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5">{icon}</span>}
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-fg">{title}</div>
          <div className="truncate text-[12px] text-fg-4">{desc}</div>
        </div>
      </div>
      {children}
    </div>
  )
}
