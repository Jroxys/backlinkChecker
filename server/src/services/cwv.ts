import type { Ctx } from '../context.js'
import { createAlert } from './alerts.js'

/**
 * Core Web Vitals from the Chrome UX Report (CrUX) History API: real-user field data,
 * p75 per week for the last ~25 collection periods. Origin-level, phone form factor —
 * the data Google's page experience signals are based on.
 */

export type Metric = 'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb'
const API_NAMES: Record<Metric, string> = {
  lcp: 'largest_contentful_paint',
  inp: 'interaction_to_next_paint',
  cls: 'cumulative_layout_shift',
  fcp: 'first_contentful_paint',
  ttfb: 'experimental_time_to_first_byte',
}
/** [good ≤, poor >] thresholds from web.dev */
export const THRESHOLDS: Record<Metric, [number, number]> = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25], fcp: [1800, 3000], ttfb: [800, 1800] }
export type Rating = 'good' | 'needs-improvement' | 'poor'
export const rate = (m: Metric, v: number): Rating => (v <= THRESHOLDS[m][0] ? 'good' : v <= THRESHOLDS[m][1] ? 'needs-improvement' : 'poor')

export interface CwvSeries {
  /** Last day of each 28-day collection window, YYYY-MM-DD */
  dates: string[]
  p75: Record<Metric, (number | null)[]>
}

export interface CruxClient {
  configured: boolean
  history(origin: string, formFactor?: 'PHONE' | 'DESKTOP'): Promise<CwvSeries | null>
}

interface CruxDate {
  year: number
  month: number
  day: number
}
const iso = (d: CruxDate) => `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`

export function createCruxClient(apiKey: string, fetchImpl: typeof fetch = fetch): CruxClient {
  return {
    configured: !!apiKey,
    async history(origin, formFactor = 'PHONE') {
      const res = await fetchImpl(`https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ origin, formFactor, metrics: Object.values(API_NAMES) }),
        signal: AbortSignal.timeout(15_000),
      })
      // 404 = not enough Chrome traffic for this origin to be in CrUX. That's an answer, not an error.
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`CrUX ${res.status}`)
      const j = (await res.json()) as {
        record: {
          metrics: Record<string, { percentilesTimeseries?: { p75s?: (number | string | null)[] } }>
          collectionPeriods: { firstDate: CruxDate; lastDate: CruxDate }[]
        }
      }
      const dates = j.record.collectionPeriods.map((p) => iso(p.lastDate))
      const p75 = {} as CwvSeries['p75']
      for (const [m, name] of Object.entries(API_NAMES) as [Metric, string][]) {
        const raw = j.record.metrics[name]?.percentilesTimeseries?.p75s ?? []
        p75[m] = dates.map((_, i) => (raw[i] === null || raw[i] === undefined || raw[i] === 'NaN' ? null : Number(raw[i])))
      }
      return { dates, p75 }
    },
  }
}

const REFRESH_DAYS = 6

/** Weekly per project. Alerts when a Core Web Vital's rating gets worse between the last two periods. */
export async function refreshCwv(ctx: Ctx, projectId: string, { force = false } = {}) {
  if (!ctx.crux.configured) return null
  const p = ctx.db.get<{ id: string; user_id: string; domain: string }>('SELECT id, user_id, domain FROM projects WHERE id = ?', [projectId])
  if (!p) return null
  const row = ctx.db.get<{ fetched_at: string }>('SELECT fetched_at FROM cwv WHERE project_id = ?', [p.id])
  if (!force && row && ctx.now().getTime() - new Date(row.fetched_at).getTime() < REFRESH_DAYS * 86_400_000) return cwvFor(ctx, p.id)

  // CrUX keys origins exactly; try the bare domain, then www.
  let origin = `https://${p.domain}`
  let series = await ctx.crux.history(origin)
  if (!series && !p.domain.startsWith('www.')) {
    origin = `https://www.${p.domain}`
    series = await ctx.crux.history(origin)
  }
  ctx.db.run(
    `INSERT INTO cwv (project_id, origin, body, fetched_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET origin = excluded.origin, body = excluded.body, fetched_at = excluded.fetched_at`,
    [p.id, series ? origin : null, series ? JSON.stringify(series) : null, ctx.now().toISOString()],
  )
  if (series && series.dates.length >= 2) {
    const worse: string[] = []
    for (const m of ['lcp', 'inp', 'cls'] as const) {
      const v = series.p75[m]
      const [prev, last] = [v[v.length - 2], v[v.length - 1]]
      if (prev === null || last === null) continue
      const order = { good: 0, 'needs-improvement': 1, poor: 2 }
      if (order[rate(m, last)] > order[rate(m, prev)]) worse.push(`${m.toUpperCase()} is now ${fmt(m, last)} (${rate(m, last).replace('-', ' ')}, was ${fmt(m, prev)})`)
    }
    if (worse.length)
      createAlert(ctx, {
        userId: p.user_id,
        projectId: p.id,
        kind: 'technical',
        severity: 'warning',
        title: `Core Web Vitals got worse on ${p.domain}`,
        body: `Real Chrome users, 75th percentile on phones: ${worse.join('; ')}. Google uses these field metrics for page experience.`,
        href: '/app/audit',
      })
  }
  return cwvFor(ctx, p.id)
}

export const fmt = (m: Metric, v: number) => (m === 'cls' ? v.toFixed(2) : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`)

export function cwvFor(ctx: Ctx, projectId: string) {
  if (!ctx.crux.configured) return { configured: false as const }
  const row = ctx.db.get<{ origin: string | null; body: string | null; fetched_at: string }>('SELECT origin, body, fetched_at FROM cwv WHERE project_id = ?', [projectId])
  if (!row) return { configured: true as const, checked: false as const }
  return { configured: true as const, checked: true as const, origin: row.origin, series: row.body ? (JSON.parse(row.body) as CwvSeries) : null, fetchedAt: row.fetched_at }
}

export async function sweepCwv(ctx: Ctx) {
  if (!ctx.crux.configured) return { skipped: true }
  const ps = ctx.db.all<{ id: string }>('SELECT id FROM projects')
  for (const p of ps) await refreshCwv(ctx, p.id).catch((e) => console.error('[cwv]', p.id, e))
  return { projects: ps.length }
}
