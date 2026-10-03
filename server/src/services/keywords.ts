import type { Ctx } from '../context.js'
import { accessTokenFor, type AnalyticsRow } from './google.js'

const CACHE_HOURS = 6

export interface KeywordRow {
  query: string
  page: string | null
  clicks: number
  impressions: number
  ctr: number
  position: number
  prevPosition: number | null
  prevClicks: number | null
}

const day = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Queries the site actually ranks for, from Search Console Search Analytics.
 * Last 28 days vs the 28 days before (Search Console data lags ~2–3 days, so we end 3 days ago).
 */
export async function keywordsFor(ctx: Ctx, projectId: string, { force = false } = {}) {
  const p = ctx.db.get<{ user_id: string; gsc_property: string | null }>('SELECT user_id, gsc_property FROM projects WHERE id = ?', [projectId])
  if (!p) throw new Error('Project not found')
  if (!p.gsc_property || !ctx.google.configured) return { connected: false as const, rows: [] as KeywordRow[], range: null }

  const key = 'queries:28d'
  const cached = ctx.db.get<{ body: string; fetched_at: string }>('SELECT body, fetched_at FROM gsc_cache WHERE project_id = ? AND key = ?', [projectId, key])
  if (!force && cached && ctx.now().getTime() - new Date(cached.fetched_at).getTime() < CACHE_HOURS * 3_600_000) return JSON.parse(cached.body)

  const token = await accessTokenFor(ctx.db, ctx.google, p.user_id)
  if (!token) return { connected: false as const, rows: [], range: null }

  const end = new Date(ctx.now().getTime() - 3 * 86_400_000)
  const start = new Date(end.getTime() - 27 * 86_400_000)
  const prevEnd = new Date(start.getTime() - 86_400_000)
  const prevStart = new Date(prevEnd.getTime() - 27 * 86_400_000)

  const [cur, prev] = await Promise.all([
    ctx.google.searchAnalytics(token, p.gsc_property, { startDate: day(start), endDate: day(end), dimensions: ['query', 'page'], rowLimit: 500 }),
    ctx.google.searchAnalytics(token, p.gsc_property, { startDate: day(prevStart), endDate: day(prevEnd), dimensions: ['query'], rowLimit: 1000 }),
  ])
  const prevBy = new Map<string, AnalyticsRow>(prev.map((r) => [r.keys[0], r]))
  // Keep the best-performing page per query
  const byQuery = new Map<string, AnalyticsRow>()
  for (const r of cur) {
    const q = r.keys[0]
    const x = byQuery.get(q)
    if (!x || r.clicks > x.clicks || (r.clicks === x.clicks && r.impressions > x.impressions)) byQuery.set(q, r)
  }
  const rows: KeywordRow[] = [...byQuery.values()]
    .map((r) => {
      const pv = prevBy.get(r.keys[0])
      return {
        query: r.keys[0],
        page: r.keys[1] ?? null,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: Math.round(r.position * 10) / 10,
        prevPosition: pv ? Math.round(pv.position * 10) / 10 : null,
        prevClicks: pv ? pv.clicks : null,
      }
    })
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)

  const result = { connected: true as const, rows, range: { start: day(start), end: day(end) } }
  ctx.db.run(
    `INSERT INTO gsc_cache (project_id, key, body, fetched_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at`,
    [projectId, key, JSON.stringify(result), ctx.now().toISOString()],
  )
  return result
}
