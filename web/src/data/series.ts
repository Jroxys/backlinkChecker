import { rng } from '@/lib/random'
import { NOW } from '@/utils/format'

export interface IndexPoint {
  date: string
  indexed: number
  crawled: number
  discovered: number
  notIndexed: number
}

export interface BacklinkPoint {
  date: string
  total: number
  refDomains: number
  gained: number
  lost: number
}

function day(offset: number) {
  const d = new Date(NOW)
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

/** 365 days of indexing coverage ending on NOW, landing on the dashboard totals. */
export const indexSeries: IndexPoint[] = (() => {
  const r = rng(42)
  const out: IndexPoint[] = []
  const N = 365
  for (let i = N - 1; i >= 0; i--) {
    const t = (N - 1 - i) / (N - 1)
    // logistic-ish growth with a dip around a core update ~day 140
    const dip = Math.exp(-((t - 0.62) ** 2) / 0.0012) * 46
    const indexed = Math.round(842 + 442 * (t ** 0.85) - dip + (r() - 0.5) * 14)
    const crawled = Math.round(162 - 20 * t + dip * 0.6 + (r() - 0.5) * 12)
    const discovered = Math.round(118 - 31 * t + Math.sin(t * 18) * 6 + (r() - 0.5) * 10)
    const notIndexed = Math.round(24 - 12 * t + dip * 0.2 + (r() - 0.5) * 5)
    out.push({ date: day(i), indexed, crawled, discovered, notIndexed })
  }
  const last = out[out.length - 1]
  Object.assign(last, { indexed: 1284, crawled: 142, discovered: 87, notIndexed: 12 })
  return out
})()

export const backlinkSeries: BacklinkPoint[] = (() => {
  const r = rng(7)
  const out: BacklinkPoint[] = []
  const N = 365
  let total = 6940
  let rd = 541
  for (let i = N - 1; i >= 0; i--) {
    const gained = Math.round(6 + r() * 9 + (r() > 0.94 ? 22 : 0))
    const lost = Math.round(2 + r() * 6 + (r() > 0.96 ? 14 : 0))
    total += gained - lost
    if (r() > 0.62) rd += 1
    if (r() > 0.93) rd -= 1
    out.push({ date: day(i), total, refDomains: rd, gained, lost })
  }
  // normalise so the series ends on the headline numbers
  const dT = 8421 - out[out.length - 1].total
  const dR = 642 - out[out.length - 1].refDomains
  return out.map((p, i) => ({
    ...p,
    total: p.total + Math.round((dT * i) / (N - 1)),
    refDomains: p.refDomains + Math.round((dR * i) / (N - 1)),
  }))
})()

export function lastDays<T>(xs: T[], n: number) {
  return xs.slice(-n)
}

/** Aggregate a daily series to weekly points for long ranges. */
export function weekly<T extends { date: string }>(xs: T[], reduce: (chunk: T[]) => T): T[] {
  const out: T[] = []
  for (let i = xs.length % 7; i < xs.length; i += 7) out.push(reduce(xs.slice(i, i + 7)))
  return out
}
