import type { Comparison, KeywordDetail, RankingsResponse, SerpResult } from '@/api/types'
import { keywords } from './keywords'
import { rng } from '@/lib/random'
import { NOW } from '@/utils/format'

const SITE = 'https://northwindlabs.com'
const day = (offset: number) => new Date(NOW.getTime() - offset * 86_400_000).toISOString().slice(0, 10)

const rivals = ['ahrefs.com', 'moz.com', 'semrush.com', 'backlinko.com', 'searchenginejournal.com', 'developers.google.com', 'yoast.com', 'screamingfrog.co.uk', 'searchengineland.com', 'neilpatel.com']
const slug = (k: string) => k.replace(/\s+/g, '-')

/** 35 days of Search Console positions drifting from (position + change) to position. */
function history(i: number, position: number, change: number) {
  const r = rng(i + 77)
  return Array.from({ length: 35 }, (_, k) => {
    const t = k / 34
    const pos = Math.max(1, position + change * (1 - t) + (r() - 0.5) * 1.6)
    return { date: day(34 - k + 2), pos: k === 34 ? position : Math.round(pos * 10) / 10, clicks: Math.round(r() * (pos < 4 ? 40 : pos < 10 ? 9 : 1)), impressions: Math.round(80 + r() * 300) }
  })
}

function serpFor(i: number, keyword: string, position: number, url: string): SerpResult[] {
  const out: SerpResult[] = []
  let j = 0
  for (let p = 1; p <= 10; p++) {
    if (p === position) out.push({ position: p, url: SITE + url, domain: 'northwindlabs.com', title: keyword.replace(/\b\w/g, (c) => c.toUpperCase()) + ' — Northwind Labs' })
    else {
      const d = rivals[(i + j++) % rivals.length]
      out.push({ position: p, url: `https://${d}/blog/${slug(keyword)}`, domain: d, title: `${keyword.replace(/\b\w/g, (c) => c.toUpperCase())}: The Complete Guide (${2026 - ((i + p) % 3)})` })
    }
  }
  return out
}

// Live results are a paid add-on; the demo shows them on a few keywords so both states are visible.
const withSerp = new Set([0, 2, 5, 9])

export const rankingsDemo: RankingsResponse = {
  limit: 250,
  gscConnected: true,
  serpConfigured: true,
  location: { name: 'United States', language: 'en' },
  keywords: keywords.map((k, i) => {
    const h = history(i, k.position, k.change)
    const last = h.at(-1)!
    const weekAgo = h.at(-8)!
    const serp = withSerp.has(i) ? serpFor(i, k.keyword, k.position, k.url) : null
    const top = serp?.find((r) => r.domain !== 'northwindlabs.com')
    return {
      id: k.id,
      keyword: k.keyword,
      position: last.pos,
      source: serp ? 'serp' : 'gsc',
      change7d: Math.round((weekAgo.pos - last.pos) * 10) / 10,
      clicks30d: h.slice(-30).reduce((a, x) => a + x.clicks, 0),
      impressions30d: h.slice(-30).reduce((a, x) => a + x.impressions, 0),
      bestPage: SITE + k.url,
      trend: h.slice(-30).map((x) => x.pos),
      topCompetitor: top ? { domain: top.domain, url: top.url, position: top.position } : null,
      serpCheckedAt: serp ? new Date(NOW.getTime() - (i + 3) * 3_600_000).toISOString() : null,
    }
  }),
}

function comparisonFor(keyword: string, myUrl: string, theirUrl: string): Comparison {
  return {
    keyword,
    mine: { url: myUrl, title: `${keyword} — Northwind Labs`, metaDescription: '', h1: ['Our guide'], h2Count: 5, wordCount: 1180, internalLinks: 14, externalLinks: 3, images: 6, imagesWithoutAlt: 4, schemaTypes: [], lang: 'en', https: true, responseMs: 412 },
    theirs: { url: theirUrl, title: `${keyword}: The Complete Guide`, metaDescription: `Everything about ${keyword}…`, h1: [`${keyword}: the complete guide`], h2Count: 14, wordCount: 3420, internalLinks: 41, externalLinks: 12, images: 18, imagesWithoutAlt: 1, schemaTypes: ['Article', 'FAQPage', 'BreadcrumbList'], lang: 'en', https: true, responseMs: 298 },
    checks: [
      { id: 'title', label: 'Keyword in title', mine: 'Yes, at the start', theirs: 'Yes, at the start', verdict: 'even', advice: null, weight: 10 },
      { id: 'h1', label: 'Keyword in H1', mine: 'No', theirs: 'Yes', verdict: 'behind', advice: `Put “${keyword}” in the page’s H1 heading.`, weight: 8 },
      { id: 'description', label: 'Meta description', mine: 'Missing', theirs: 'Has keyword', verdict: 'missing', advice: 'Write a meta description (120–155 characters) that uses the keyword and says why to click.', weight: 5 },
      { id: 'words', label: 'Content length', mine: '1,180 words', theirs: '3,420 words', verdict: 'behind', advice: 'The competing page is about 3× longer. Cover the sub-topics it covers that yours doesn’t, without padding.', weight: 7 },
      { id: 'h2', label: 'Sub-headings (H2)', mine: '5', theirs: '14', verdict: 'behind', advice: 'Break the page into more H2 sections that each answer one question searchers have.', weight: 4 },
      { id: 'internal', label: 'Internal links on page', mine: '14', theirs: '41', verdict: 'behind', advice: 'Link to this page from your other relevant articles, using the keyword in the anchor text.', weight: 4 },
      { id: 'schema', label: 'Structured data', mine: 'None', theirs: 'Article, FAQPage, BreadcrumbList', verdict: 'missing', advice: 'Add Article (and FAQPage if you answer questions) structured data.', weight: 3 },
      { id: 'alt', label: 'Images with alt text', mine: '2 of 6', theirs: '17 of 18', verdict: 'behind', advice: 'Describe your images with alt text — 4 are missing it.', weight: 2 },
      { id: 'speed', label: 'Server response', mine: '412 ms', theirs: '298 ms', verdict: 'even', advice: null, weight: 2 },
      { id: 'https', label: 'HTTPS', mine: 'Yes', theirs: 'Yes', verdict: 'even', advice: null, weight: 1 },
      { id: 'refdomains', label: 'Referring domains (site)', mine: '412', theirs: '18,300', verdict: 'behind', advice: 'They have far more sites linking to them. Use Link opportunities to find sites that link to them but not to you.', weight: 6 },
    ],
    todo: [],
  }
}

function withTodo(c: Comparison): Comparison {
  return { ...c, todo: c.checks.filter((x) => x.advice).sort((a, b) => b.weight - a.weight).map((x) => ({ id: x.id, advice: x.advice! })) }
}

export function demoCompare(keyword: string, myUrl?: string, theirUrl?: string): Comparison {
  const row = rankingsDemo.keywords.find((k) => k.keyword === keyword)
  return withTodo(comparisonFor(keyword, myUrl ?? row?.bestPage ?? SITE + '/', theirUrl ?? row?.topCompetitor?.url ?? `https://ahrefs.com/blog/${slug(keyword)}`))
}

export function rankedKeywordDemo(id: string): KeywordDetail | null {
  const i = keywords.findIndex((k) => k.id === id)
  if (i < 0) return null
  const k = keywords[i]
  const row = rankingsDemo.keywords[i]
  const h = history(i, k.position, k.change)
  const serp = withSerp.has(i) ? serpFor(i, k.keyword, k.position, k.url) : null
  return {
    keyword: { id: k.id, keyword: k.keyword, bestPage: row.bestPage, serpCheckedAt: row.serpCheckedAt, createdAt: day(40) + 'T09:00:00Z' },
    history: [
      ...h.map((x) => ({ date: x.date, source: 'gsc' as const, position: x.pos, clicks: x.clicks, impressions: x.impressions, page: row.bestPage })),
      ...(serp ? [{ date: day(0), source: 'serp' as const, position: k.position, clicks: null, impressions: null, page: row.bestPage }] : []),
    ],
    serp: serp ? { fetchedAt: row.serpCheckedAt!, results: serp } : null,
    comparison: serp ? { ...demoCompare(k.keyword), createdAt: new Date(NOW.getTime() - 86_400_000).toISOString() } : null,
  }
}
