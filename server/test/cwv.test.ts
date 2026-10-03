import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seedProject, seedUser, testCtx } from './helpers.js'
import { createCruxClient, rate, refreshCwv } from '../src/services/cwv.js'

/** A CrUX History API response in the documented shape (3 collection periods). */
function cruxBody(lcp: (number | null)[], cls: (string | null)[]) {
  const period = (d: number) => ({ firstDate: { year: 2026, month: 8, day: d }, lastDate: { year: 2026, month: 9, day: d } })
  return {
    record: {
      key: { origin: 'https://shop.example', formFactor: 'PHONE' },
      metrics: {
        largest_contentful_paint: { percentilesTimeseries: { p75s: lcp } },
        cumulative_layout_shift: { percentilesTimeseries: { p75s: cls } },
        interaction_to_next_paint: { percentilesTimeseries: { p75s: [150, 160, 170] } },
      },
      collectionPeriods: [period(7), period(14), period(21)],
    },
  }
}

function fakeFetch(handler: (origin: string) => { status: number; body?: unknown }) {
  const calls: string[] = []
  const f = (async (_url: string, init?: RequestInit) => {
    const { origin } = JSON.parse(String(init?.body))
    calls.push(origin)
    const r = handler(origin)
    return new Response(r.body ? JSON.stringify(r.body) : '{"error":{"code":404}}', { status: r.status })
  }) as unknown as typeof fetch
  return { f, calls }
}

test('ratings follow web.dev thresholds', () => {
  assert.equal(rate('lcp', 2500), 'good')
  assert.equal(rate('lcp', 3000), 'needs-improvement')
  assert.equal(rate('inp', 501), 'poor')
  assert.equal(rate('cls', 0.1), 'good')
})

test('parses the history series, falls back to www, and alerts when a vital gets worse', async () => {
  const { ctx } = testCtx()
  const { f, calls } = fakeFetch((origin) => (origin === 'https://www.shop.example' ? { status: 200, body: cruxBody([2100, 2300, 2900], ['0.05', '0.06', 'NaN']) } : { status: 404 }))
  ctx.crux = createCruxClient('key', f)
  const projectId = seedProject(ctx, seedUser(ctx), 'shop.example')
  const r = await refreshCwv(ctx, projectId)
  assert.deepEqual(calls, ['https://shop.example', 'https://www.shop.example'])
  assert.ok(r && 'series' in r && r.series)
  assert.equal(r.origin, 'https://www.shop.example')
  assert.deepEqual(r.series.dates, ['2026-09-07', '2026-09-14', '2026-09-21'])
  assert.deepEqual(r.series.p75.lcp, [2100, 2300, 2900])
  assert.deepEqual(r.series.p75.cls, [0.05, 0.06, null])
  assert.deepEqual(r.series.p75.ttfb, [null, null, null])
  const alert = ctx.db.get<{ title: string; body: string }>('SELECT title, body FROM alerts')!
  assert.match(alert.title, /Core Web Vitals got worse/)
  assert.match(alert.body, /LCP is now 2\.9s \(needs improvement, was 2\.3s\)/)

  await refreshCwv(ctx, projectId)
  assert.equal(calls.length, 2, 'cached for 6 days')
})

test('origins without enough Chrome traffic are recorded as "not in CrUX", without errors', async () => {
  const { ctx } = testCtx()
  ctx.crux = createCruxClient('key', fakeFetch(() => ({ status: 404 })).f)
  const projectId = seedProject(ctx, seedUser(ctx), 'tiny.example')
  const r = await refreshCwv(ctx, projectId)
  assert.ok(r && 'checked' in r && r.checked)
  assert.equal(r.series, null)
})
