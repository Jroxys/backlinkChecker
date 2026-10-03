import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { api } from '@/api/client'
import type { Report } from '@/api/types'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/Button'
import { PageFallback } from '@/components/ui/Skeleton'
import { ReportDocument } from '@/components/report/ReportDocument'

/** Read-only client report at /r/:token. Always light: it's a document, not the app. */
export function PublicReport() {
  const { token = '' } = useParams()
  const q = useQuery({ queryKey: ['public-report', token], queryFn: () => api.get<Report>(`/api/reports/${encodeURIComponent(token)}`), retry: false })
  const r = q.data
  usePageTitle(r ? `SEO report — ${r.project.domain}${r.branding?.name ? ` · ${r.branding.name}` : ''}` : 'SEO report')

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 print:bg-white print:p-0 sm:py-12" style={{ colorScheme: 'light' }}>
      {q.isError ? (
        <div className="mx-auto max-w-md rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-[#0B0F19]">
          <h1 className="text-[18px] font-semibold">This report link isn’t active</h1>
          <p className="mt-2 text-[13.5px] text-[#64748B]">It may have been turned off or replaced with a new link. Ask whoever sent it for the current one.</p>
        </div>
      ) : !r ? (
        <PageFallback />
      ) : (
        <>
          <div className="mx-auto mb-4 flex max-w-[820px] justify-end print:hidden">
            <Button size="sm" leftIcon={<Printer />} onClick={() => window.print()}>
              Print / Save as PDF
            </Button>
          </div>
          <ReportDocument report={r} />
        </>
      )}
    </div>
  )
}
