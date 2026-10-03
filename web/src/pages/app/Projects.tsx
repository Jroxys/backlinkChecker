import { Badge } from '@/components/ui/Badge'
import { useState } from 'react'
import { ArrowUpRight, Globe, MoreHorizontal, Plus, RefreshCw, Settings2, Trash2, ShieldCheck } from 'lucide-react'
import type { Project } from '@/api/types'
import { useAction, useMe } from '@/api/hooks'
import { useSource } from '@/api/source'
import { cn } from '@/lib/cn'
import { useNavigate } from '@/lib/router'
import { useProject } from '@/lib/project'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Label, SearchInput } from '@/components/ui/Controls'
import { Dropdown, MenuItem, MenuSeparator } from '@/components/ui/Dropdown'
import { Sparkline } from '@/components/ui/Sparkline'
import { MiniScore } from '@/components/ui/ScoreRing'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { DomainIcon } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatNumber, timeAgo } from '@/utils/format'
import { healthScore } from './Dashboard'

export function Projects() {
  const { projects, loading, setProjectId } = useProject()
  const me = useMe().data
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState<Project | null>(null)
  const nav = useNavigate()
  const scan = useAction((s) => s.scanProject, { invalidate: ['projects'], success: (r) => ({ title: 'Scan started', description: `${formatNumber(r.queued.urls)} URLs and ${formatNumber(r.queued.backlinks)} backlinks queued.` }) })
  const remove = useAction((s) => s.deleteProject, { invalidate: ['projects'], success: () => ({ title: 'Project deleted' }) })

  const shown = projects.filter((p) => (p.domain + p.name).toLowerCase().includes(q.toLowerCase()))
  const limit = me?.plan.limits.projects ?? 1
  const atLimit = projects.length >= limit

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project monitors one website: its index coverage, indexability and backlinks."
        actions={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Find a project…" className="w-full sm:w-60" />
            <Button variant="primary" leftIcon={<Plus />} onClick={() => (atLimit ? nav('/app/settings?tab=billing') : setAdding(true))}>
              {atLimit ? 'Upgrade for more' : 'New project'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {loading &&
          [0, 1].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="mt-6 h-16 w-full" />
            </Card>
          ))}
        {shown.map((p, i) => {
          const s = p.stats
          const trend = p.indexTrend ?? []
          const up = trend.length < 2 || trend[trend.length - 1] >= trend[0]
          const health = healthScore(p)
          return (
            <Card key={p.id} interactive className="flex animate-rise flex-col" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-start justify-between gap-3 p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <DomainIcon domain={p.domain} size={36} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-fg">{p.domain}</span>
                      {p.paused && <Badge tone="outline">Paused — over plan limit</Badge>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3">
                      <StatusIndicator state={!s?.urls ? 'running' : health >= 85 ? 'online' : health >= 60 ? 'warning' : 'error'} pulse={!s?.urls} label={!s?.urls ? 'Setting up…' : health >= 85 ? 'Healthy' : health >= 60 ? 'Needs attention' : 'Critical issues'} />
                      {p.gscProperty && (
                        <span className="inline-flex items-center gap-1 text-[11.5px] text-fg-4">
                          <ShieldCheck className="size-3" /> Search Console
                        </span>
                      )}
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
                      <MenuItem icon={<Settings2 />} onClick={() => (setProjectId(p.id), nav('/app/settings?tab=integrations'))}>
                        Project settings
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem icon={<Trash2 />} danger onClick={() => (setConfirm(p), close())}>
                        Delete project
                      </MenuItem>
                    </>
                  )}
                </Dropdown>
              </div>

              <div className="grid grid-cols-3 gap-px border-y border-line-soft bg-line-soft">
                <div className="bg-surface px-5 py-3.5">
                  <div className="text-[11.5px] text-fg-4">Indexed URLs</div>
                  <div className="tnum mt-1 text-[17px] font-semibold text-fg">{formatNumber(s?.indexed ?? 0)}</div>
                  <div className="tnum text-[11.5px] text-fg-4">of {formatNumber(s?.urls ?? 0)}</div>
                </div>
                <div className="bg-surface px-5 py-3.5">
                  <div className="text-[11.5px] text-fg-4">Backlinks</div>
                  <div className="tnum mt-1 text-[17px] font-semibold text-fg">{formatNumber(s?.backlinks ?? 0)}</div>
                  <div className="tnum text-[11.5px] text-fg-4">{formatNumber(s?.refDomains ?? 0)} domains</div>
                </div>
                <div className="bg-surface px-5 py-3.5">
                  <div className="text-[11.5px] text-fg-4">Health</div>
                  <div className="mt-1">
                    <MiniScore score={health} size={26} />
                  </div>
                  <div className="tnum text-[11.5px] text-fg-4">{formatNumber(s?.issues ?? 0)} issues</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="text-[12px] text-fg-3">
                  <div>Indexed URLs · 14 days</div>
                  <div className="tnum mt-0.5 text-fg-4">{p.lastScan ? `Last check ${timeAgo(p.lastScan)}` : 'First checks queued'}</div>
                </div>
                {trend.length > 1 ? <Sparkline data={trend} width={120} height={34} color={up ? 'var(--primary)' : 'var(--error)'} /> : <span className="text-[11.5px] text-fg-4">Trend after day 2</span>}
              </div>

              <div className="mt-auto flex items-center gap-2 border-t border-line-soft px-5 py-3">
                <Button size="sm" variant="secondary" rightIcon={<ArrowUpRight />} onClick={() => (setProjectId(p.id), nav('/app'))}>
                  Open
                </Button>
                <Button size="sm" variant="ghost" leftIcon={<RefreshCw className={cn(scan.isPending && scan.variables?.[0] === p.id && 'animate-spin')} />} onClick={() => scan.mutate([p.id])}>
                  Scan now
                </Button>
              </div>
            </Card>
          )
        })}

        {!loading && (
          <button
            onClick={() => (atLimit ? nav('/app/settings?tab=billing') : setAdding(true))}
            className="group flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-transparent p-6 text-center transition-colors hover:border-primary hover:bg-primary-soft/40"
          >
            <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-fg-3 shadow-xs transition-colors group-hover:text-primary">
              <Plus className="size-5" />
            </span>
            <span className="mt-4 text-[14px] font-semibold text-fg">{atLimit ? 'Need more projects?' : 'Add a website'}</span>
            <span className="mt-1 max-w-xs text-[12.5px] text-fg-3">
              {atLimit ? `Your ${me?.plan.name} plan includes ${limit} project${limit > 1 ? 's' : ''}. Upgrade to monitor more sites.` : 'We find its sitemaps and start checking every URL right away.'}
            </span>
            <span className="tnum mt-3 text-[11.5px] text-fg-4">
              {projects.length} of {limit} projects used{me ? ` on ${me.plan.name}` : ''}
            </span>
          </button>
        )}
      </div>

      <NewProjectModal open={adding} onClose={() => setAdding(false)} />

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        size="sm"
        title={`Delete ${confirm?.domain}?`}
        description="All monitored URLs, backlinks and history for this project are deleted permanently."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => confirm && remove.mutateAsync([confirm.id]).then(() => setConfirm(null), () => undefined)}>
              Delete project
            </Button>
          </>
        }
      />
    </>
  )
}

function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const source = useSource()
  const { setProjectId } = useProject()
  const [domain, setDomain] = useState('')
  const create = useAction((s) => s.createProject, { invalidate: ['projects'], success: (p) => ({ title: 'Project created', description: `Reading ${p.domain}’s sitemaps now.` }) })
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      description={source.mode === 'demo' ? 'Projects can’t be created in the demo.' : 'We’ll find its sitemaps automatically and start monitoring right away.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!/\w+\.\w+/.test(domain)}
            loading={create.isPending}
            onClick={() =>
              create.mutateAsync([{ domain }]).then(
                (p) => {
                  setProjectId(p.id)
                  setDomain('')
                  onClose()
                },
                () => undefined,
              )
            }
          >
            Create project
          </Button>
        </>
      }
    >
      <Label>Domain</Label>
      <div className="relative">
        <Globe className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-4" />
        <Input autoFocus value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="pl-9" />
      </div>
    </Modal>
  )
}
