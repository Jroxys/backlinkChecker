import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, Globe, MoreHorizontal, Plus, RefreshCw, Settings2, Trash2, Copy, ShieldCheck } from 'lucide-react'
import type { Project } from '@/types'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Label, SearchInput, Switch } from '@/components/ui/Controls'
import { Dropdown, MenuItem, MenuSeparator } from '@/components/ui/Dropdown'
import { Sparkline } from '@/components/ui/Sparkline'
import { MiniScore } from '@/components/ui/ScoreRing'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { DomainIcon } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { projects as initial } from '@/data/projects'
import { formatNumber, timeAgo } from '@/utils/format'

const statusLabel: Record<Project['status'], { label: string; state: 'online' | 'warning' | 'error' | 'running' }> = {
  healthy: { label: 'Healthy', state: 'online' },
  warning: { label: 'Needs attention', state: 'warning' },
  critical: { label: 'Critical issues', state: 'error' },
  scanning: { label: 'Scanning…', state: 'running' },
}

export function Projects() {
  const [list, setList] = useState(initial)
  const [q, setQ] = useState('')
  const [scanning, setScanning] = useState<Set<string>>(new Set(['harbor']))
  const [adding, setAdding] = useState(false)
  const nav = useNavigate()
  const toast = useToast()

  const shown = list.filter((p) => (p.domain + p.name).toLowerCase().includes(q.toLowerCase()))

  const scan = (p: Project) => {
    setScanning((s) => new Set(s).add(p.id))
    toast({ title: `Scanning ${p.domain}`, description: `${formatNumber(p.totalUrls)} URLs queued. This usually takes 2–4 minutes.`, tone: 'info' })
    setTimeout(() => {
      setScanning((s) => {
        const n = new Set(s)
        n.delete(p.id)
        return n
      })
      toast({ title: `Scan complete — ${p.domain}`, description: 'No new critical issues found.' })
    }, 4000)
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project monitors one website: its index coverage, backlinks, technical health and competitors."
        actions={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Find a project…" className="w-full sm:w-60" />
            <Button variant="primary" leftIcon={<Plus />} onClick={() => setAdding(true)}>
              New project
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {shown.map((p, i) => {
          const isScanning = scanning.has(p.id)
          const st = isScanning ? statusLabel.scanning : statusLabel[p.status]
          const up = p.indexTrend[p.indexTrend.length - 1] >= p.indexTrend[0]
          return (
            <Card key={p.id} interactive className="flex animate-rise flex-col" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-start justify-between gap-3 p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <DomainIcon domain={p.domain} size={36} />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-fg">{p.domain}</div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <StatusIndicator state={st.state} label={st.label} pulse={isScanning} />
                    </div>
                  </div>
                </div>
                <Dropdown
                  align="right"
                  width={200}
                  trigger={({ toggle }) => (
                    <button onClick={toggle} aria-label="Project actions" className="rounded-md p-1 text-fg-4 hover:bg-surface-3 hover:text-fg">
                      <MoreHorizontal className="size-4" />
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem icon={<Copy />} onClick={close}>Duplicate settings</MenuItem>
                      <MenuItem icon={<Settings2 />} onClick={() => nav('/app/settings')}>Project settings</MenuItem>
                      <MenuSeparator />
                      <MenuItem
                        icon={<Trash2 />}
                        danger
                        onClick={() => {
                          setList((l) => l.filter((x) => x.id !== p.id))
                          toast({ title: 'Project archived', description: p.domain, tone: 'warning' })
                          close()
                        }}
                      >
                        Archive project
                      </MenuItem>
                    </>
                  )}
                </Dropdown>
              </div>

              <div className="grid grid-cols-3 gap-px border-y border-line-soft bg-line-soft">
                <div className="bg-surface px-5 py-3.5">
                  <div className="text-[11.5px] text-fg-4">Indexed URLs</div>
                  <div className="tnum mt-1 text-[17px] font-semibold text-fg">{formatNumber(p.indexedUrls)}</div>
                  <div className="tnum text-[11.5px] text-fg-4">of {formatNumber(p.totalUrls)}</div>
                </div>
                <div className="bg-surface px-5 py-3.5">
                  <div className="text-[11.5px] text-fg-4">Backlinks</div>
                  <div className="tnum mt-1 text-[17px] font-semibold text-fg">{formatNumber(p.backlinks)}</div>
                  <div className="tnum text-[11.5px] text-fg-4">{formatNumber(p.refDomains)} domains</div>
                </div>
                <div className="bg-surface px-5 py-3.5">
                  <div className="text-[11.5px] text-fg-4">SEO Score</div>
                  <div className="mt-1">
                    <MiniScore score={p.seoScore} size={26} />
                  </div>
                  <div className="tnum text-[11.5px] text-fg-4">{p.issues} issues</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="text-[12px] text-fg-3">
                  <div>Index trend · 14 days</div>
                  <div className="tnum mt-0.5 text-fg-4">Last scan {isScanning ? 'in progress' : timeAgo(p.lastScan)}</div>
                </div>
                <Sparkline data={p.indexTrend} width={120} height={34} color={up ? 'var(--primary)' : 'var(--error)'} />
              </div>

              <div className="mt-auto flex items-center gap-2 border-t border-line-soft px-5 py-3">
                <Button size="sm" variant="secondary" rightIcon={<ArrowUpRight />} onClick={() => nav('/app')}>
                  Open
                </Button>
                <Button size="sm" variant="ghost" leftIcon={<RefreshCw className={cn(isScanning && 'animate-spin')} />} disabled={isScanning} onClick={() => scan(p)}>
                  {isScanning ? 'Scanning' : 'Scan Now'}
                </Button>
                <Button size="sm" variant="ghost" leftIcon={<Settings2 />} className="ml-auto" onClick={() => nav('/app/settings')}>
                  Settings
                </Button>
              </div>
            </Card>
          )
        })}

        <button
          onClick={() => setAdding(true)}
          className="group flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-transparent p-6 text-center transition-colors hover:border-primary hover:bg-primary-soft/40"
        >
          <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-fg-3 shadow-xs transition-colors group-hover:text-primary">
            <Plus className="size-5" />
          </span>
          <span className="mt-4 text-[14px] font-semibold text-fg">Add a website</span>
          <span className="mt-1 max-w-xs text-[12.5px] text-fg-3">
            Connect Search Console and we’ll import index coverage, sitemaps and backlinks automatically.
          </span>
          <span className="tnum mt-3 text-[11.5px] text-fg-4">{list.length} of 10 projects used on Growth</span>
        </button>
      </div>

      <NewProjectModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreate={(domain) => {
          setAdding(false)
          toast({ title: 'Project created', description: `${domain} — first scan starts now.` })
        }}
      />
    </>
  )
}

function NewProjectModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (d: string) => void }) {
  const [step, setStep] = useState(0)
  const [domain, setDomain] = useState('')
  const [opts, setOpts] = useState({ index: true, backlinks: true, audit: true, competitors: false })
  const steps = ['Website', 'Connect', 'Monitoring']
  const close = () => {
    onClose()
    setTimeout(() => setStep(0), 200)
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New project"
      description="Set up monitoring for a website in under a minute."
      footer={
        <>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button
            variant="primary"
            disabled={step === 0 && !/\w+\.\w+/.test(domain)}
            onClick={() => (step < 2 ? setStep(step + 1) : (onCreate(domain), setTimeout(() => setStep(0), 200)))}
          >
            {step < 2 ? 'Continue' : 'Create project'}
          </Button>
        </>
      }
    >
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'tnum flex size-6 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold transition-colors',
                i < step ? 'bg-primary text-white' : i === step ? 'bg-primary-soft text-primary-ink ring-1 ring-primary/40' : 'bg-surface-3 text-fg-4',
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn('text-[12.5px] font-medium', i <= step ? 'text-fg' : 'text-fg-4')}>{s}</span>
            {i < steps.length - 1 && <span className={cn('h-px flex-1', i < step ? 'bg-primary' : 'bg-line')} />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <Label>Domain</Label>
            <div className="relative">
              <Globe className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-4" />
              <Input autoFocus value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="pl-9" />
            </div>
          </div>
          <div>
            <Label hint="Optional">Project name</Label>
            <Input placeholder="Marketing site" />
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-3">
          {[
            { name: 'Google Search Console', desc: 'Index coverage, URL inspection, search performance', connected: true },
            { name: 'XML sitemaps', desc: 'Auto-discovered from robots.txt', connected: true },
            { name: 'Google Analytics 4', desc: 'Optional — attribute traffic to indexed pages', connected: false },
          ].map((x) => (
            <div key={x.name} className="flex items-center gap-3 rounded-xl border border-line p-3.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-surface-3 text-fg-2">
                <ShieldCheck className="size-4" />
              </span>
              <div className="flex-1">
                <div className="text-[13.5px] font-medium text-fg">{x.name}</div>
                <div className="text-[12px] text-fg-3">{x.desc}</div>
              </div>
              {x.connected ? (
                <Badge tone="success" icon={<Check />}>Connected</Badge>
              ) : (
                <Button size="sm">Connect</Button>
              )}
            </div>
          ))}
        </div>
      )}
      {step === 2 && (
        <div className="divide-y divide-line rounded-xl border border-line">
          {(
            [
              ['index', 'Index monitoring', 'Check index status every 6 hours'],
              ['backlinks', 'Backlink monitoring', 'Detect new and lost links daily'],
              ['audit', 'Technical SEO scans', 'Full crawl every Monday at 02:00'],
              ['competitors', 'Competitor monitoring', 'Weekly backlink gap analysis'],
            ] as const
          ).map(([k, t, d]) => (
            <div key={k} className="flex items-center justify-between gap-3 p-3.5">
              <div>
                <div className="text-[13.5px] font-medium text-fg">{t}</div>
                <div className="text-[12px] text-fg-3">{d}</div>
              </div>
              <Switch label={t} checked={opts[k]} onChange={(v) => setOpts((o) => ({ ...o, [k]: v }))} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
