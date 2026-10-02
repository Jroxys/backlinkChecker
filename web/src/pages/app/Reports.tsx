import { useState } from 'react'
import { CalendarClock, Download, FileBarChart2, FileText, Link2, ScanSearch, ShieldCheck, Sparkles, Eye, Send, CalendarRange } from 'lucide-react'
import type { Report } from '@/types'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Label, Switch } from '@/components/ui/Controls'
import { Select } from '@/components/ui/Dropdown'
import { Table, THead, TH, TR, TD } from '@/components/ui/Table'
import { LogoMark } from '@/components/ui/Logo'
import { Sparkline } from '@/components/ui/Sparkline'
import { useToast } from '@/components/ui/Toast'
import { reports as initial, reportTemplates } from '@/data/reports'
import { projects } from '@/data/projects'
import { formatDate } from '@/utils/format'

const typeIcon: Record<Report['type'], typeof FileText> = {
  weekly: CalendarRange,
  monthly: FileBarChart2,
  indexing: ScanSearch,
  backlink: Link2,
  technical: ShieldCheck,
}

export function Reports() {
  const [list, setList] = useState(initial)
  const [gen, setGen] = useState<Report['type'] | null>(null)
  const [preview, setPreview] = useState(false)
  const toast = useToast()

  const generate = (type: Report['type'], project: string) => {
    const t = reportTemplates.find((x) => x.type === type)!
    const id = `r${Date.now()}`
    setList((l) => [
      { id, name: t.name, type, project, period: 'Sep 2 – Oct 1, 2026', created: '2026-10-02T09:14:00Z', status: 'generating', pages: t.pages, recipients: 0 },
      ...l,
    ])
    setGen(null)
    toast({ title: 'Generating report', description: `${t.name} for ${project}`, tone: 'info' })
    setTimeout(() => {
      setList((l) => l.map((r) => (r.id === id ? { ...r, status: 'ready' } : r)))
      toast({ title: 'Report ready', description: `${t.name} · ${t.pages} pages` })
    }, 3500)
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Client-ready PDF reports with your branding. Generate on demand or schedule them to send automatically."
        actions={
          <Button variant="primary" leftIcon={<FileBarChart2 />} onClick={() => setGen('monthly')}>
            Generate Report
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
          {reportTemplates.map((t) => {
            const Icon = typeIcon[t.type]
            return (
              <Card key={t.type} interactive className="flex flex-col p-4.5">
                <div className="flex items-start justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-2">
                    <Icon className="size-4" />
                  </span>
                  <span className="tnum text-[11.5px] text-fg-4">{t.pages} pages</span>
                </div>
                <h3 className="mt-3.5 text-[14px] font-semibold text-fg">{t.name}</h3>
                <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-fg-3">{t.description}</p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setGen(t.type)}>
                    Generate
                  </Button>
                  <Button size="sm" variant="ghost" leftIcon={<Eye />} onClick={() => setPreview(true)}>
                    Preview
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>

        <Card className="overflow-hidden">
          <CardHeader title="Report preview" description="Monthly SEO Report · fernandpine.co" actions={<Badge tone="primary" icon={<Sparkles />}>White-label</Badge>} />
          <div className="p-5">
            <ReportCover />
          </div>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader
          title="Report history"
          description="Generated and scheduled reports across all projects"
          actions={<Badge tone="neutral" icon={<CalendarClock />}>2 scheduled</Badge>}
        />
        <div className="mt-4">
          <Table minWidth={900}>
            <THead>
              <TH>Report</TH>
              <TH>Project</TH>
              <TH>Period</TH>
              <TH>Created</TH>
              <TH>Status</TH>
              <TH align="right">Actions</TH>
            </THead>
            <tbody>
              {list.map((r) => {
                const Icon = typeIcon[r.type]
                return (
                  <TR key={r.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-surface-3 text-fg-3">
                          <Icon className="size-4" />
                        </span>
                        <div>
                          <div className="font-medium text-fg">{r.name}</div>
                          <div className="tnum text-[12px] text-fg-4">
                            {r.pages} pages{r.recipients ? ` · sent to ${r.recipients}` : ''}
                          </div>
                        </div>
                      </div>
                    </TD>
                    <TD>{r.project}</TD>
                    <TD className="tnum">{r.period}</TD>
                    <TD className="tnum">{formatDate(r.created)}</TD>
                    <TD>
                      {r.status === 'ready' ? (
                        <Badge size="xs" tone="success" dot>Ready</Badge>
                      ) : r.status === 'generating' ? (
                        <Badge size="xs" tone="primary">
                          <span className="size-2.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent" />
                          Generating
                        </Badge>
                      ) : (
                        <Badge size="xs" tone="neutral" icon={<CalendarClock />}>Scheduled</Badge>
                      )}
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-1">
                        <Button size="xs" variant="ghost" leftIcon={<Send />} disabled={r.status !== 'ready'} onClick={() => toast({ title: 'Report sent', description: r.name })}>
                          Send
                        </Button>
                        <Button size="xs" variant="secondary" leftIcon={<Download />} disabled={r.status !== 'ready'} onClick={() => toast({ title: 'Downloading PDF', description: r.name })}>
                          PDF
                        </Button>
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </tbody>
          </Table>
        </div>
      </Card>

      <GenerateModal key={gen ?? 'closed'} type={gen} onClose={() => setGen(null)} onGenerate={generate} />

      <Modal open={preview} onClose={() => setPreview(false)} title="Report preview" description="Page 1 of 14 · cover and executive summary" size="lg">
        <ReportCover large />
      </Modal>
    </>
  )
}

function GenerateModal({ type, onClose, onGenerate }: { type: Report['type'] | null; onClose: () => void; onGenerate: (t: Report['type'], p: string) => void }) {
  const [t, setT] = useState<Report['type']>(type ?? 'monthly')
  const [project, setProject] = useState(projects[2].domain)
  const [schedule, setSchedule] = useState(false)

  return (
    <Modal
      open={!!type}
      onClose={onClose}
      title="Generate report"
      description="Reports use your workspace branding and can be sent straight to clients."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" leftIcon={<FileBarChart2 />} onClick={() => onGenerate(t, project)}>
            Generate Report
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Report type</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {reportTemplates.map((r) => {
              const Icon = typeIcon[r.type]
              return (
                <button
                  key={r.type}
                  onClick={() => setT(r.type)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border p-3 text-left text-[13px] font-medium transition-all',
                    t === r.type ? 'border-primary bg-primary-soft text-fg ring-3 ring-[var(--ring)]' : 'border-line text-fg-2 hover:border-line-strong',
                  )}
                >
                  <Icon className={cn('size-4', t === r.type ? 'text-primary' : 'text-fg-4')} />
                  {r.name}
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Project</Label>
            <Select value={project} onChange={setProject} width={260} options={projects.map((p) => ({ value: p.domain, label: p.domain }))} />
          </div>
          <div>
            <Label>Period</Label>
            <Select
              value="30d"
              onChange={() => {}}
              options={[
                { value: '30d', label: 'Last 30 days' },
                { value: 'month', label: 'September 2026' },
                { value: 'q', label: 'Q3 2026' },
              ]}
            />
          </div>
        </div>
        <div>
          <Label hint="Comma separated">Send to</Label>
          <Input defaultValue="marketing@fernandpine.co, lea@fernandpine.co" />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line p-3.5">
          <div>
            <div className="text-[13px] font-medium text-fg">Repeat automatically</div>
            <div className="text-[12px] text-fg-3">Generate and send on the 1st of every month at 07:00</div>
          </div>
          <Switch label="Repeat automatically" checked={schedule} onChange={setSchedule} />
        </div>
      </div>
    </Modal>
  )
}

/** A miniature, client-ready report page rendered in HTML. Always light, like the PDF. */
function ReportCover({ large }: { large?: boolean }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-[#E2E8F0] bg-white text-[#0B0F19] shadow-card', large ? 'p-8' : 'p-5')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark size={large ? 22 : 18} />
          <span className={cn('font-semibold tracking-tight', large ? 'text-[13px]' : 'text-[11px]')}>Northwind Studio</span>
        </div>
        <span className={cn('text-[#64748B]', large ? 'text-[12px]' : 'text-[10px]')}>September 2026</span>
      </div>
      <div className={cn('mt-6 font-semibold tracking-[-0.03em]', large ? 'text-[28px]' : 'text-[19px]')}>Monthly SEO Report</div>
      <div className={cn('text-[#64748B]', large ? 'text-[14px]' : 'text-[11.5px]')}>fernandpine.co · Sep 1 – Sep 30, 2026</div>
      <div className="mt-5 h-px bg-[#E2E8F0]" />
      <div className={cn('mt-4 font-semibold tracking-wide text-[#4F46E5] uppercase', large ? 'text-[11px]' : 'text-[9px]')}>Executive summary</div>
      <p className={cn('mt-1.5 leading-relaxed text-[#334155]', large ? 'text-[13.5px]' : 'text-[11px]')}>
        Organic visibility grew for the fifth consecutive month. Indexed pages rose 3.6% to 3,917, and 41 new referring domains were acquired — including
        two editorial links above authority 80.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ['Indexed pages', '3,917', '+3.6%', [3610, 3671, 3725, 3790, 3858, 3917]],
          ['Ref. domains', '1,093', '+3.9%', [1012, 1031, 1049, 1061, 1080, 1093]],
          ['SEO score', '91', '+2', [84, 85, 87, 88, 90, 91]],
        ].map(([l, v, d, tr]) => (
          <div key={String(l)} className="rounded-md border border-[#E2E8F0] p-2.5">
            <div className={cn('text-[#64748B]', large ? 'text-[11px]' : 'text-[9px]')}>{l as string}</div>
            <div className={cn('tnum font-semibold', large ? 'text-[20px]' : 'text-[14px]')}>{v as string}</div>
            <div className="mt-1 flex items-end justify-between">
              <span className={cn('tnum font-medium text-[#047857]', large ? 'text-[11px]' : 'text-[9px]')}>{d as string}</span>
              <Sparkline data={tr as number[]} width={large ? 64 : 40} height={large ? 20 : 14} color="#6366F1" />
            </div>
          </div>
        ))}
      </div>
      <div className={cn('mt-4 font-semibold tracking-wide text-[#4F46E5] uppercase', large ? 'text-[11px]' : 'text-[9px]')}>Next actions</div>
      <ul className={cn('mt-1.5 space-y-1 text-[#334155]', large ? 'text-[13px]' : 'text-[10.5px]')}>
        <li>1. Consolidate 18 thin collection pages flagged “Crawled – not indexed”.</li>
        <li>2. Reclaim 3 lost links from authority 60+ domains.</li>
        <li>3. Compress hero images on /journal/* to bring LCP under 2.5s.</li>
      </ul>
    </div>
  )
}
