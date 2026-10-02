import { Printer, FileBarChart2, ShieldCheck, Link2, KeyRound, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { useAudit, useHistory, useKeywords, useMe } from '@/api/hooks'
import { useSource } from '@/api/source'
import { useProject } from '@/lib/project'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { LogoMark } from '@/components/ui/Logo'
import { Sparkline } from '@/components/ui/Sparkline'
import { formatDate, formatNumber } from '@/utils/format'
import { ReportsDemo } from './ReportsDemo'

export function Reports() {
  const { mode } = useSource()
  return mode === 'demo' ? <ReportsDemo /> : <ReportLive />
}

const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0)
const fmtPct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}%`

/** A one-page, client-ready report rendered from live data. Print → "Save as PDF". */
function ReportLive() {
  const { project } = useProject()
  const me = useMe().data
  const history = useHistory(project?.id, 30).data ?? []
  const audit = useAudit(project?.id).data
  const kw = useKeywords(project?.id).data
  const s = project?.stats
  if (!project || !s) return null
  const gsc = s.unknown < s.urls
  const first = history[0]
  const last = history[history.length - 1]
  const topIssues = (audit?.checks ?? []).filter((c) => c.affected > 0).sort((a, b) => (a.severity === 'error' ? -1 : 1) - (b.severity === 'error' ? -1 : 1) || b.affected - a.affected).slice(0, 5)
  const topQueries = (kw?.rows ?? []).slice(0, 8)
  const periodEnd = new Date()
  const periodStart = new Date(periodEnd.getTime() - 29 * 86_400_000)

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          description="A client-ready summary of the last 30 days, built from live data. Use your browser’s “Save as PDF” to send it."
          actions={
            <Button variant="primary" leftIcon={<Printer />} onClick={() => window.print()}>
              Print / Save as PDF
            </Button>
          }
        />
      </div>

      <article className="mx-auto max-w-[820px] rounded-xl border border-[#E2E8F0] bg-white p-8 text-[#0B0F19] shadow-card print:max-w-none print:border-0 print:p-0 print:shadow-none sm:p-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="text-[13px] font-semibold tracking-tight">{me?.plan.features.whiteLabel ? me.user.name : 'Indexora'}</span>
          </div>
          <span className="text-[12px] text-[#64748B]">
            {formatDate(periodStart)} – {formatDate(periodEnd)}
          </span>
        </header>
        <h1 className="mt-8 text-[30px] leading-tight font-semibold tracking-[-0.03em]">SEO Report</h1>
        <p className="text-[14px] text-[#64748B]">{project.domain}</p>
        <div className="mt-6 h-px bg-[#E2E8F0]" />

        <Section icon={<FileBarChart2 className="size-4" />} title="Summary">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              gsc
                ? ['Indexed URLs', s.indexed, first && last ? pct(last.indexed, first.indexed) : null, history.map((h) => h.indexed)]
                : ['Indexable URLs', s.indexable, first && last ? pct(last.indexable, first.indexable) : null, history.map((h) => h.indexable)],
              ['Live backlinks', s.backlinks, first && last ? pct(last.backlinks, first.backlinks) : null, history.map((h) => h.backlinks)],
              ['Referring domains', s.refDomains, first && last ? pct(last.ref_domains, first.ref_domains) : null, history.map((h) => h.ref_domains)],
              ['Audit score', audit?.score ?? 0, null, []],
            ].map(([label, value, delta, trend]) => (
              <div key={label as string} className="rounded-lg border border-[#E2E8F0] p-3">
                <div className="text-[11px] text-[#64748B]">{label as string}</div>
                <div className="tnum mt-1 text-[22px] font-semibold">{formatNumber(value as number)}</div>
                <div className="mt-1 flex items-end justify-between">
                  <span className={`tnum text-[11px] font-medium ${delta === null ? 'text-[#94A3B8]' : (delta as number) >= 0 ? 'text-[#047857]' : 'text-[#B91C1C]'}`}>{delta === null ? '' : fmtPct(delta as number)}</span>
                  {(trend as number[]).length > 1 && <Sparkline data={trend as number[]} width={56} height={18} color="#6366F1" fill={false} />}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-[#334155]">
            {gsc ? `${formatNumber(s.indexed)} of ${formatNumber(s.urls)} monitored URLs are indexed by Google.` : `${formatNumber(s.indexable)} of ${formatNumber(s.urls)} monitored URLs are indexable (Google’s own index status appears once Search Console is connected).`} In the last 30 days {formatNumber(s.gained30d)} new backlinks were verified and {formatNumber(s.lost30d)} were lost.
            {s.issues ? ` ${formatNumber(s.issues)} URLs currently have indexability issues.` : ' No URLs currently have indexability issues.'}
          </p>
        </Section>

        <Section icon={<ShieldCheck className="size-4" />} title="Top issues to fix">
          {topIssues.length === 0 ? (
            <p className="text-[13.5px] text-[#334155]">No open issues. Every monitored URL is reachable and indexable.</p>
          ) : (
            <ol className="space-y-3">
              {topIssues.map((c) => (
                <li key={c.id} className="flex gap-3 text-[13px]">
                  {c.severity === 'error' ? <XCircle className="mt-0.5 size-4 shrink-0 text-[#EF4444]" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#F59E0B]" />}
                  <div>
                    <div className="font-medium">
                      {c.title} <span className="tnum font-normal text-[#64748B]">· {formatNumber(c.affected)}</span>
                    </div>
                    <div className="text-[#475569]">{c.fix}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section icon={<Link2 className="size-4" />} title="Backlinks">
          <div className="grid grid-cols-3 gap-3 text-[13px]">
            <Stat label="Verified live" value={s.backlinks} />
            <Stat label="New (30 days)" value={s.gained30d} good />
            <Stat label="Lost (30 days)" value={s.lost30d} bad={s.lost30d > 0} />
          </div>
        </Section>

        {topQueries.length > 0 && (
          <Section icon={<KeyRound className="size-4" />} title="Top search queries">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-left text-[#64748B]">
                  <th className="py-1.5 font-medium">Query</th>
                  <th className="py-1.5 text-right font-medium">Position</th>
                  <th className="py-1.5 text-right font-medium">Clicks</th>
                  <th className="py-1.5 text-right font-medium">Impressions</th>
                </tr>
              </thead>
              <tbody>
                {topQueries.map((r) => (
                  <tr key={r.query} className="border-b border-[#F1F5F9]">
                    <td className="py-1.5">{r.query}</td>
                    <td className="tnum py-1.5 text-right">{r.position.toFixed(1)}</td>
                    <td className="tnum py-1.5 text-right">{formatNumber(r.clicks)}</td>
                    <td className="tnum py-1.5 text-right">{formatNumber(r.impressions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <footer className="mt-10 flex items-center justify-between border-t border-[#E2E8F0] pt-4 text-[11px] text-[#94A3B8]">
          <span>Generated {formatDate(new Date())}</span>
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="size-3" /> Data: Google Search Console & Indexora crawler
          </span>
        </footer>
      </article>
    </>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-[#4F46E5] uppercase">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function Stat({ label, value, good, bad }: { label: string; value: number; good?: boolean; bad?: boolean }) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] p-3">
      <div className="text-[11px] text-[#64748B]">{label}</div>
      <div className={`tnum mt-1 text-[20px] font-semibold ${good ? 'text-[#047857]' : bad ? 'text-[#B91C1C]' : ''}`}>{formatNumber(value)}</div>
    </div>
  )
}
