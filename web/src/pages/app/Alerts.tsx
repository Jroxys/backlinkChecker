import { useMemo, useState } from 'react'
import { Link } from '@/lib/router'
import { ArrowRight, BellOff, CheckCheck, Mail, MessageSquare, Settings2, Inbox } from 'lucide-react'
import type { Alert } from '@/types'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Select } from '@/components/ui/Dropdown'
import { Switch } from '@/components/ui/Controls'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { AlertIcon } from '@/components/AlertIcon'
import { alerts as initial } from '@/data/alerts'
import { formatTime, formatDate, NOW } from '@/utils/format'

type View = 'all' | 'unread' | 'critical'

function dayLabel(iso: string) {
  const d = new Date(iso)
  const diff = Math.floor((Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 86400000)
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : formatDate(iso)
}

export function Alerts() {
  const [list, setList] = useState<Alert[]>(initial)
  const [view, setView] = useState<View>('all')
  const [kind, setKind] = useState<'all' | Alert['kind']>('all')
  const [prefs, setPrefs] = useState({ lost: true, index: true, technical: true, digest: false })
  const toast = useToast()

  const shown = list.filter(
    (a) => (view === 'all' || (view === 'unread' ? !a.read : a.severity === 'critical')) && (kind === 'all' || a.kind === kind),
  )
  const groups = useMemo(() => {
    const g: Record<string, Alert[]> = {}
    shown.forEach((a) => (g[dayLabel(a.time)] ??= []).push(a))
    return Object.entries(g)
  }, [shown])

  const unread = list.filter((a) => !a.read).length
  const markRead = (id: string) => setList((l) => l.map((a) => (a.id === id ? { ...a, read: true } : a)))

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Changes that need a decision. Each alert explains what happened and what to do next."
        actions={
          <Button
            leftIcon={<CheckCheck />}
            disabled={!unread}
            onClick={() => {
              setList((l) => l.map((a) => ({ ...a, read: true })))
              toast({ title: 'All alerts marked as read' })
            }}
          >
            Mark all as read
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
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
            {groups.length === 0 ? (
              <EmptyState
                icon={view === 'unread' ? <Inbox /> : <BellOff />}
                title={view === 'unread' ? 'You’re all caught up' : 'No alerts of this type'}
                description={
                  view === 'unread'
                    ? 'New changes to indexing, backlinks and technical health will appear here as soon as an automation detects them.'
                    : 'Nothing matched this filter in the last 30 days. That’s usually a good sign.'
                }
                action={
                  <Link to="/app/automations">
                    <Button size="sm">Review automations</Button>
                  </Link>
                }
              />
            ) : (
              groups.map(([day, items]) => (
                <div key={day}>
                  <div className="sticky top-14 z-[1] border-b border-line-soft bg-surface-2/95 px-5 py-2 text-[11.5px] font-medium text-fg-3 backdrop-blur">{day}</div>
                  <div className="divide-y divide-line-soft">
                    {items.map((a) => (
                      <div
                        key={a.id}
                        className={cn('group relative flex gap-4 px-5 py-4 transition-colors hover:bg-surface-2', !a.read && 'bg-primary-soft/35')}
                      >
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
                            <Link to={a.href} onClick={() => markRead(a.id)}>
                              <Button size="xs" variant={a.severity === 'critical' ? 'primary' : 'secondary'} rightIcon={<ArrowRight />}>
                                {a.action}
                              </Button>
                            </Link>
                            <span className="text-[12px] text-fg-4">
                              {a.project} · <span className="tnum">{formatTime(a.time)}</span>
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

        <div className="space-y-4">
          <Card>
            <CardHeader title="Notify me about" icon={<Settings2 />} />
            <div className="mt-3 divide-y divide-line-soft border-t border-line-soft">
              {(
                [
                  ['lost', 'Lost backlinks', 'Authority 40+ only'],
                  ['index', 'Index status changes', 'Priority URLs'],
                  ['technical', 'New technical errors', 'Errors, not warnings'],
                  ['digest', 'Daily digest instead', 'One email at 08:00'],
                ] as const
              ).map(([k, t, d]) => (
                <div key={k} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="text-[13px] font-medium text-fg">{t}</div>
                    <div className="text-[12px] text-fg-4">{d}</div>
                  </div>
                  <Switch size="sm" label={t} checked={prefs[k]} onChange={(v) => setPrefs((p) => ({ ...p, [k]: v }))} />
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-[13px] font-semibold text-fg">Delivery channels</div>
            <div className="mt-3 space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2"><Mail className="size-4 text-fg-4" /> Email</span>
                <Badge size="xs" tone="success" dot>Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2"><MessageSquare className="size-4 text-fg-4" /> Slack · #seo-alerts</span>
                <Badge size="xs" tone="success" dot>Active</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
