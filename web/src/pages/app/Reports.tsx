import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Printer, Link2, Copy, RefreshCw } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import type { Report } from '@/api/types'
import { useMe } from '@/api/hooks'
import { useSource } from '@/api/source'
import { useProject } from '@/lib/project'
import { Link } from '@/lib/router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { PageFallback } from '@/components/ui/Skeleton'
import { ReportDocument } from '@/components/report/ReportDocument'
import { ReportsDemo } from './ReportsDemo'

export function Reports() {
  const { mode } = useSource()
  return mode === 'demo' ? <ReportsDemo /> : <ReportLive />
}

/** A one-page, client-ready report rendered from live data. Print → "Save as PDF", or share a live link. */
function ReportLive() {
  const { project } = useProject()
  const report = useQuery({ queryKey: ['live', 'report', project?.id], queryFn: () => api.get<Report>(`/api/projects/${project!.id}/report`), enabled: !!project })
  if (!project) return null
  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          description="A client-ready summary of the last 30 days, built from live data. Save it as a PDF, or send your client a live link."
          actions={
            <Button variant="primary" leftIcon={<Printer />} onClick={() => window.print()}>
              Print / Save as PDF
            </Button>
          }
        />
        <ShareCard projectId={project.id} />
      </div>
      {report.data ? <ReportDocument report={report.data} /> : <PageFallback />}
    </>
  )
}

function ShareCard({ projectId }: { projectId: string }) {
  const me = useMe().data
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const share = useQuery({ queryKey: ['live', 'share', projectId], queryFn: () => api.get<{ url: string | null }>(`/api/projects/${projectId}/share`) })
  const allowed = !!me?.plan.features.reports
  const url = share.data?.url

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await fn()
      await qc.invalidateQueries({ queryKey: ['live', 'share', projectId] })
      toast({ title: done, tone: 'success' })
    } catch (e) {
      toast({ title: 'Something went wrong', description: e instanceof ApiError ? e.message : undefined, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-2">
          <Link2 className="size-3.5" />
        </span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium text-fg">Client link</div>
          {!allowed ? (
            <div className="text-[12.5px] text-fg-3">
              Send clients a live, read-only report link — from the Starter plan.{' '}
              <Link to="/app/settings?tab=billing" className="font-medium text-primary-ink hover:underline">
                Upgrade
              </Link>
            </div>
          ) : url ? (
            <div className="truncate font-mono text-[12px] text-fg-3">{url}</div>
          ) : (
            <div className="text-[12.5px] text-fg-3">Anyone with the link sees this report, always up to date. No login needed. You can turn it off anytime.</div>
          )}
        </div>
      </div>
      {allowed && (
        <div className="flex shrink-0 gap-2">
          {url ? (
            <>
              <Button
                size="sm"
                leftIcon={<Copy />}
                onClick={() => {
                  navigator.clipboard?.writeText(url).catch(() => {})
                  toast({ title: 'Link copied' })
                }}
              >
                Copy
              </Button>
              <Button size="sm" variant="ghost" leftIcon={<RefreshCw />} disabled={busy} onClick={() => run(() => api.post(`/api/projects/${projectId}/share`), 'New link created — the old one no longer works')}>
                New link
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api.del(`/api/projects/${projectId}/share`), 'Sharing turned off')}>
                Turn off
              </Button>
            </>
          ) : (
            <Button size="sm" variant="primary" loading={busy} onClick={() => run(() => api.post(`/api/projects/${projectId}/share`), 'Client link created')}>
              Create link
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}
