import { useState, type ReactNode } from 'react'
import { Bell, Clock, FileBarChart2, Link2, Map, Mail, MessageSquare, Plus, ScanSearch, ShieldCheck, Swords, Webhook, Zap, Filter, Play, MoreHorizontal, CheckCircle2 } from 'lucide-react'
import type { Automation } from '@/types'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Switch, Input, Label } from '@/components/ui/Controls'
import { Select, Dropdown, MenuItem } from '@/components/ui/Dropdown'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { automations as initial } from '@/data/automations'
import { timeAgo, formatNextRun } from '@/utils/format'

const kindIcon: Record<Automation['kind'], typeof Zap> = {
  index: ScanSearch,
  backlink: Link2,
  audit: ShieldCheck,
  competitor: Swords,
  report: FileBarChart2,
  sitemap: Map,
}

const channelIcon = { Email: Mail, Slack: MessageSquare, Webhook: Webhook }

export function Automations() {
  const [list, setList] = useState(initial)
  const [builder, setBuilder] = useState(false)
  const toast = useToast()
  const active = list.filter((a) => a.active).length

  return (
    <>
      <PageHeader
        title="Automations"
        description="Scheduled checks that run in the background and tell you only what changed."
        actions={
          <Button variant="primary" leftIcon={<Plus />} onClick={() => setBuilder(true)}>
            New automation
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {[
          { label: 'Active automations', value: `${active} / ${list.length}` },
          { label: 'Runs in last 24h', value: '41' },
          { label: 'Success rate (30d)', value: '99.6%' },
          { label: 'Next run', value: 'in 46m', sub: 'Sitemap change watcher' },
        ].map((s) => (
          <div key={s.label} className="bg-surface px-5 py-4">
            <div className="text-[12px] text-fg-3">{s.label}</div>
            <div className="tnum mt-1.5 text-[20px] leading-none font-semibold text-fg">{s.value}</div>
            {s.sub && <div className="mt-1 truncate text-[11.5px] text-fg-4">{s.sub}</div>}
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,2.4fr)_1.1fr_1fr_1.2fr_auto] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 text-[11.5px] font-medium text-fg-3 lg:grid">
          <span>Automation</span>
          <span>Schedule</span>
          <span>Notify</span>
          <span>Last run</span>
          <span className="w-[76px] text-right">Status</span>
        </div>
        <div className="divide-y divide-line-soft">
          {list.map((a) => {
            const Icon = kindIcon[a.kind]
            return (
              <div
                key={a.id}
                className={cn(
                  'grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-surface-2 lg:grid-cols-[minmax(0,2.4fr)_1.1fr_1fr_1.2fr_auto] lg:items-center lg:gap-4',
                  !a.active && 'opacity-60',
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border', a.active ? 'border-primary/20 bg-primary-soft text-primary' : 'border-line bg-surface-3 text-fg-4')}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-fg">{a.name}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px] text-fg-3">{a.description}</p>
                    <p className="mt-1 text-[11.5px] text-fg-4">{a.project}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[12.5px] text-fg-2">
                  <Clock className="size-3.5 text-fg-4" />
                  <div>
                    <div>{a.frequency}</div>
                    <div className="tnum text-[11.5px] text-fg-4">{a.active ? `Next ${formatNextRun(a.nextRun)}` : 'Paused'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {a.channels.map((ch) => {
                    const CI = channelIcon[ch]
                    return (
                      <Tooltip key={ch} content={ch}>
                        <span className="flex size-7 items-center justify-center rounded-md border border-line bg-surface text-fg-3">
                          <CI className="size-3.5" />
                        </span>
                      </Tooltip>
                    )
                  })}
                </div>
                <div className="text-[12.5px]">
                  <div className="flex items-center gap-1.5 text-fg-2">
                    <CheckCircle2 className="size-3.5 text-success" />
                    {a.lastResult}
                  </div>
                  <div className="tnum mt-0.5 text-[11.5px] text-fg-4">
                    {timeAgo(a.lastRun)} · {a.successRate}% success
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 lg:w-[76px] lg:justify-end">
                  <Switch
                    label={`Toggle ${a.name}`}
                    checked={a.active}
                    onChange={(v) => {
                      setList((l) => l.map((x) => (x.id === a.id ? { ...x, active: v } : x)))
                      toast({ title: v ? 'Automation resumed' : 'Automation paused', description: a.name, tone: v ? 'success' : 'info' })
                    }}
                  />
                  <Dropdown
                    align="right"
                    width={180}
                    trigger={({ toggle }) => (
                      <button onClick={toggle} aria-label="Automation actions" className="rounded-md p-1 text-fg-4 hover:bg-surface-3 hover:text-fg">
                        <MoreHorizontal className="size-4" />
                      </button>
                    )}
                  >
                    {(close) => (
                      <>
                        <MenuItem icon={<Play />} onClick={() => (toast({ title: 'Running now', description: a.name, tone: 'info' }), close())}>
                          Run now
                        </MenuItem>
                        <MenuItem icon={<Zap />} onClick={() => (setBuilder(true), close())}>
                          Edit
                        </MenuItem>
                      </>
                    )}
                  </Dropdown>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <AutomationBuilder
        open={builder}
        onClose={() => setBuilder(false)}
        onSave={(name) => {
          setBuilder(false)
          toast({ title: 'Automation created', description: `${name} will run on its next schedule.` })
        }}
      />
    </>
  )
}

const monitors = [
  { value: 'backlink', label: 'New & lost backlinks', icon: Link2 },
  { value: 'index', label: 'Index status changes', icon: ScanSearch },
  { value: 'audit', label: 'Technical SEO issues', icon: ShieldCheck },
  { value: 'competitor', label: 'Competitor backlinks', icon: Swords },
] as const

function Step({ n, title, icon, children, last }: { n: number; title: string; icon: ReactNode; children: ReactNode; last?: boolean }) {
  return (
    <div className="relative flex gap-4">
      {!last && <span className="absolute top-10 bottom-0 left-[17px] w-px bg-gradient-to-b from-primary/40 to-line" />}
      <span className="relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary-soft text-primary [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0 flex-1 pb-6">
        <div className="eyebrow mb-0.5 !text-[10.5px]">Step {n}</div>
        <div className="mb-3 text-[14px] font-semibold text-fg">{title}</div>
        {children}
      </div>
    </div>
  )
}

function AutomationBuilder({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string) => void }) {
  const [monitor, setMonitor] = useState<(typeof monitors)[number]['value']>('backlink')
  const [freq, setFreq] = useState('24h')
  const [cond, setCond] = useState('any')
  const [channels, setChannels] = useState<string[]>(['Email'])
  const [name, setName] = useState('Monitor new backlinks')

  const freqLabel = { '1h': 'Every hour', '6h': 'Every 6 hours', '24h': 'Every 24 hours', '7d': 'Every 7 days' }[freq]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="New automation"
      description="Define what to watch, how often, and when you want to hear about it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" leftIcon={<Zap />} onClick={() => onSave(name)}>
            Activate automation
          </Button>
        </>
      }
    >
      <div className="mb-6">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <Step n={1} title="What should we monitor?" icon={<ScanSearch />}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {monitors.map((m) => (
            <button
              key={m.value}
              onClick={() => setMonitor(m.value)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border p-3 text-left text-[13px] font-medium transition-all',
                monitor === m.value ? 'border-primary bg-primary-soft text-fg ring-3 ring-[var(--ring)]' : 'border-line text-fg-2 hover:border-line-strong',
              )}
            >
              <m.icon className={cn('size-4', monitor === m.value ? 'text-primary' : 'text-fg-4')} />
              {m.label}
            </button>
          ))}
        </div>
      </Step>

      <Step n={2} title="How often?" icon={<Clock />}>
        <Select
          value={freq}
          onChange={setFreq}
          width={220}
          options={[
            { value: '1h', label: 'Every hour' },
            { value: '6h', label: 'Every 6 hours' },
            { value: '24h', label: 'Every 24 hours' },
            { value: '7d', label: 'Every 7 days' },
          ]}
        />
      </Step>

      <Step n={3} title="Only notify me when…" icon={<Filter />}>
        <div className="space-y-2">
          {[
            { v: 'any', t: 'Anything changes' },
            { v: 'high', t: 'A change involves authority ≥ 60' },
            { v: 'lost', t: 'Something is lost or breaks' },
          ].map((o) => (
            <label key={o.v} className="flex cursor-pointer items-center gap-2.5 text-[13px] text-fg-2">
              <span className={cn('flex size-4 items-center justify-center rounded-full border', cond === o.v ? 'border-primary' : 'border-line-strong')}>
                {cond === o.v && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <input type="radio" className="sr-only" checked={cond === o.v} onChange={() => setCond(o.v)} />
              {o.t}
            </label>
          ))}
        </div>
      </Step>

      <Step n={4} title="Send notifications to" icon={<Bell />} last>
        <div className="flex flex-wrap gap-2">
          {(['Email', 'Slack', 'Webhook'] as const).map((ch) => {
            const on = channels.includes(ch)
            const CI = channelIcon[ch]
            return (
              <button
                key={ch}
                onClick={() => setChannels((c) => (on ? c.filter((x) => x !== ch) : [...c, ch]))}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-all',
                  on ? 'border-primary bg-primary-soft text-primary-ink' : 'border-line text-fg-2 hover:border-line-strong',
                )}
              >
                <CI className="size-4" />
                {ch}
              </button>
            )
          })}
        </div>
      </Step>

      <div className="mt-2 rounded-xl border border-line bg-surface-2 p-4 text-[13px] leading-relaxed text-fg-2">
        <span className="font-medium text-fg">Summary · </span>
        Check <Badge size="xs" tone="primary">{monitors.find((m) => m.value === monitor)!.label.toLowerCase()}</Badge>{' '}
        <Badge size="xs" tone="primary">{freqLabel?.toLowerCase()}</Badge> and notify via{' '}
        <Badge size="xs" tone="primary">{channels.length ? channels.join(' + ') : 'nowhere'}</Badge> when{' '}
        {cond === 'any' ? 'anything changes' : cond === 'high' ? 'high-authority changes happen' : 'something is lost or breaks'}.
      </div>
    </Modal>
  )
}
