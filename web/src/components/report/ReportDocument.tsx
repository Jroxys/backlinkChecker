import type { ReactNode } from 'react'
import { FileBarChart2, ShieldCheck, Link2, KeyRound, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { Report } from '@/api/types'
import { LogoMark } from '@/components/ui/Logo'
import { Sparkline } from '@/components/ui/Sparkline'
import { formatDate, formatNumber } from '@/utils/format'

const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0)
const fmtPct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}%`

/**
 * The one-page client report. Always light, print-ready, and white-labelled when the
 * payload carries branding. Shared by the in-app Reports page and public /r/:token links.
 */
export function ReportDocument({ report: r }: { report: Report }) {
  const s = r.stats
  const brand = r.branding
  const accent = brand?.color ?? '#6366F1'
  const first = r.history[0]
  const last = r.history[r.history.length - 1]
  const change = (k: 'indexed' | 'indexable' | 'backlinks' | 'ref_domains') => (first && last ? pct(last[k], first[k]) : null)
  const series = (k: 'indexed' | 'indexable' | 'backlinks' | 'ref_domains') => r.history.map((h) => h[k])

  const tiles: [string, number | null, number | null, number[]][] = [
    r.gsc ? ['Indexed URLs', s.indexed, change('indexed'), series('indexed')] : ['Indexable URLs', s.indexable, change('indexable'), series('indexable')],
    ['Live backlinks', s.backlinks, change('backlinks'), series('backlinks')],
    ['Referring domains', s.refDomains, change('ref_domains'), series('ref_domains')],
    ['Audit score', r.audit.score, null, []],
  ]

  return (
    <article className="mx-auto max-w-[820px] rounded-xl border border-[#E2E8F0] bg-white p-8 text-[#0B0F19] shadow-card print:max-w-none print:border-0 print:p-0 print:shadow-none sm:p-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          {brand?.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name ?? ''} className="h-7 max-w-[180px] object-contain" referrerPolicy="no-referrer" />
          ) : (
            <>
              {!brand && <LogoMark size={22} />}
              <span className="truncate text-[13px] font-semibold tracking-tight">{brand ? brand.name : 'Indexora'}</span>
            </>
          )}
        </div>
        <span className="shrink-0 text-[12px] text-[#64748B]">
          {formatDate(r.period.start)} – {formatDate(r.period.end)}
        </span>
      </header>
      <h1 className="mt-8 text-[30px] leading-tight font-semibold tracking-[-0.03em]">SEO Report</h1>
      <p className="text-[14px] text-[#64748B]">{r.project.domain}</p>
      <div className="mt-6 h-px bg-[#E2E8F0]" />

      <Section accent={accent} icon={<FileBarChart2 className="size-4" />} title="Summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map(([label, value, delta, trend]) => (
            <div key={label} className="rounded-lg border border-[#E2E8F0] p-3">
              <div className="text-[11px] text-[#64748B]">{label}</div>
              <div className="tnum mt-1 text-[22px] font-semibold">{value === null ? '—' : formatNumber(value)}</div>
              <div className="mt-1 flex items-end justify-between">
                <span className={`tnum text-[11px] font-medium ${delta === null ? 'text-[#94A3B8]' : delta >= 0 ? 'text-[#047857]' : 'text-[#B91C1C]'}`}>{delta === null ? '' : fmtPct(delta)}</span>
                {trend.length > 1 && <Sparkline data={trend} width={56} height={18} color={accent} fill={false} />}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13.5px] leading-relaxed text-[#334155]">
          {r.gsc
            ? `${formatNumber(s.indexed)} of ${formatNumber(s.urls)} monitored URLs are indexed by Google.`
            : `${formatNumber(s.indexable)} of ${formatNumber(s.urls)} monitored URLs are indexable (Google’s own index status appears once Search Console is connected).`}{' '}
          In the last 30 days {formatNumber(s.gained30d)} new backlinks were verified and {formatNumber(s.lost30d)} were lost.
          {s.issues ? ` ${formatNumber(s.issues)} URLs currently have indexability issues.` : ' No URLs currently have indexability issues.'}
        </p>
      </Section>

      <Section accent={accent} icon={<ShieldCheck className="size-4" />} title="Top issues to fix">
        {r.audit.issues.length === 0 ? (
          <p className="text-[13.5px] text-[#334155]">No open issues. Every monitored URL is reachable and indexable.</p>
        ) : (
          <ol className="space-y-3">
            {r.audit.issues.map((c) => (
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

      <Section accent={accent} icon={<Link2 className="size-4" />} title="Backlinks">
        <div className="grid grid-cols-3 gap-3 text-[13px]">
          <Stat label="Verified live" value={s.backlinks} />
          <Stat label="New (30 days)" value={s.gained30d} good={s.gained30d > 0} />
          <Stat label="Lost (30 days)" value={s.lost30d} bad={s.lost30d > 0} />
        </div>
      </Section>

      {r.queries.length > 0 && (
        <Section accent={accent} icon={<KeyRound className="size-4" />} title="Top search queries">
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
              {r.queries.map((q) => (
                <tr key={q.query} className="border-b border-[#F1F5F9]">
                  <td className="py-1.5">{q.query}</td>
                  <td className="tnum py-1.5 text-right">{q.position.toFixed(1)}</td>
                  <td className="tnum py-1.5 text-right">{formatNumber(q.clicks)}</td>
                  <td className="tnum py-1.5 text-right">{formatNumber(q.impressions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <footer className="mt-10 flex items-center justify-between gap-4 border-t border-[#E2E8F0] pt-4 text-[11px] text-[#94A3B8]">
        <span>Generated {formatDate(r.generatedAt)}</span>
        <span className="inline-flex items-center gap-1 text-right">
          <CheckCircle2 className="size-3 shrink-0" /> Data: {r.gsc ? 'Google Search Console & ' : ''}
          {brand ? 'site crawl' : 'Indexora crawler'}
        </span>
      </footer>
    </article>
  )
}

function Section({ icon, title, children, accent }: { icon: ReactNode; title: string; children: ReactNode; accent: string }) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase" style={{ color: accent }}>
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
