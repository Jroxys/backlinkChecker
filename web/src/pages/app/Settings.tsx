import { useState } from 'react'
import { Check, KeyRound, Copy, Moon, Sun, Monitor } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/theme'
import { currentUser } from '@/lib/user'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Input, Label, ProgressBar, Switch } from '@/components/ui/Controls'
import { Avatar } from '@/components/ui/Avatar'
import { Select } from '@/components/ui/Dropdown'
import { useToast } from '@/components/ui/Toast'

type Tab = 'general' | 'team' | 'integrations' | 'billing' | 'api'

export function Settings() {
  const [tab, setTab] = useState<Tab>('general')
  const { theme, setTheme } = useTheme()
  const toast = useToast()
  const save = () => toast({ title: 'Settings saved' })

  return (
    <>
      <PageHeader title="Settings" description="Manage your workspace, team, integrations and billing." />
      <Tabs<Tab>
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'general', label: 'General' },
          { value: 'team', label: 'Team', count: 4 },
          { value: 'integrations', label: 'Integrations' },
          { value: 'billing', label: 'Billing' },
          { value: 'api', label: 'API' },
        ]}
      />
      <div key={tab} className="max-w-3xl animate-rise space-y-4">
        {tab === 'general' && (
          <>
            <Card>
              <CardHeader title="Profile" description="How you appear to teammates and in client reports" />
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-4">
                  <Avatar initials={currentUser.initials} size={48} />
                  <Button size="sm">Change photo</Button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>First name</Label>
                    <Input defaultValue={currentUser.firstName} />
                  </div>
                  <div>
                    <Label>Last name</Label>
                    <Input defaultValue={currentUser.lastName} />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input defaultValue={currentUser.email} type="email" />
                </div>
              </div>
              <div className="flex justify-end border-t border-line bg-surface-2 px-5 py-3">
                <Button variant="primary" size="sm" onClick={save}>Save changes</Button>
              </div>
            </Card>
            <Card>
              <CardHeader title="Appearance" description="Indexora follows your system by default" />
              <div className="grid grid-cols-3 gap-3 p-5">
                {([
                  ['light', 'Light', Sun],
                  ['dark', 'Dark', Moon],
                ] as const).map(([v, l, I]) => (
                  <button
                    key={v}
                    onClick={() => setTheme(v)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border p-4 text-[13px] font-medium transition-all',
                      theme === v ? 'border-primary bg-primary-soft text-fg ring-3 ring-[var(--ring)]' : 'border-line text-fg-2 hover:border-line-strong',
                    )}
                  >
                    <I className={cn('size-5', theme === v ? 'text-primary' : 'text-fg-4')} />
                    {l}
                  </button>
                ))}
                <button
                  onClick={() => setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')}
                  className="flex flex-col items-center gap-2 rounded-xl border border-line p-4 text-[13px] font-medium text-fg-2 transition-all hover:border-line-strong"
                >
                  <Monitor className="size-5 text-fg-4" />
                  System
                </button>
              </div>
            </Card>
            <Card>
              <CardHeader title="Regional" />
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                <div>
                  <Label>Timezone</Label>
                  <Select value="ist" onChange={() => {}} options={[{ value: 'ist', label: 'Europe/Istanbul (GMT+3)' }, { value: 'utc', label: 'UTC' }]} width={260} />
                </div>
                <div>
                  <Label>Default search market</Label>
                  <Select value="us" onChange={() => {}} options={[{ value: 'us', label: 'United States · English' }, { value: 'tr', label: 'Türkiye · Turkish' }, { value: 'de', label: 'Germany · German' }]} width={260} />
                </div>
              </div>
            </Card>
          </>
        )}

        {tab === 'team' && (
          <Card>
            <CardHeader title="Team members" description="4 of 5 seats used" actions={<Button size="sm" variant="primary">Invite</Button>} />
            <div className="mt-3 divide-y divide-line-soft border-t border-line-soft">
              {[
                ['Ömer Kılıç', currentUser.email, 'Owner', 'ÖK'],
                ['Lena Vogel', 'lena@northwind.studio', 'Admin', 'LV'],
                ['Marcus Chen', 'marcus@northwind.studio', 'Editor', 'MC'],
                ['Aylin Demir', 'aylin@northwind.studio', 'Viewer', 'AD'],
              ].map(([n, e, r, i]) => (
                <div key={e} className="flex items-center gap-3 px-5 py-3">
                  <Avatar initials={i} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-fg">{n}</div>
                    <div className="truncate text-[12px] text-fg-3">{e}</div>
                  </div>
                  <Badge tone={r === 'Owner' ? 'primary' : 'neutral'} size="xs">{r}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'integrations' && (
          <Card>
            <CardHeader title="Integrations" description="Data sources and notification channels" />
            <div className="mt-3 divide-y divide-line-soft border-t border-line-soft">
              {[
                ['Google Search Console', '5 properties connected', true],
                ['Google Analytics 4', 'Attribute traffic to indexed pages', false],
                ['Slack', '#seo-alerts in Northwind', true],
                ['Webhooks', '1 endpoint · last delivery 200 OK', true],
                ['Looker Studio', 'Export metrics to dashboards', false],
              ].map(([n, d, on]) => (
                <div key={String(n)} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <div className="text-[13px] font-medium text-fg">{n}</div>
                    <div className="text-[12px] text-fg-3">{d}</div>
                  </div>
                  {on ? <Badge tone="success" icon={<Check />}>Connected</Badge> : <Button size="sm">Connect</Button>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'billing' && (
          <>
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-semibold text-fg">Growth plan</span>
                    <Badge tone="primary" size="xs">Current</Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-fg-3">$129 / month · renews October 20, 2026</p>
                </div>
                <Button variant="primary" size="sm">Upgrade to Agency</Button>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                {[
                  ['Projects', 5, 10],
                  ['URL checks / mo', 38412, 50000],
                  ['Team seats', 4, 5],
                ].map(([l, u, m]) => (
                  <div key={String(l)}>
                    <div className="flex justify-between text-[12.5px]">
                      <span className="text-fg-3">{l}</span>
                      <span className="tnum font-medium text-fg">
                        {Number(u).toLocaleString('en-US')} / {Number(m).toLocaleString('en-US')}
                      </span>
                    </div>
                    <ProgressBar className="mt-2" value={(Number(u) / Number(m)) * 100} />
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {tab === 'api' && (
          <Card>
            <CardHeader title="API keys" description="Use the Indexora API to pull index and backlink data into your own tools" icon={<KeyRound />} />
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5 font-mono text-[12.5px] text-fg-2">
                <span className="flex-1 truncate">ix_live_7Hq2••••••••••••••••••••c91F</span>
                <button className="rounded p-1 text-fg-4 hover:text-fg" aria-label="Copy key" onClick={() => toast({ title: 'API key copied' })}>
                  <Copy className="size-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium text-fg">Allow write access</div>
                  <div className="text-[12px] text-fg-3">Create projects and trigger scans via API</div>
                </div>
                <Switch label="Allow write access" checked={false} onChange={() => toast({ title: 'Write access requires Agency plan', tone: 'warning' })} />
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
