import * as cheerio from 'cheerio'
import { hostMatches, urlKey } from './url.js'

export type Rel = 'dofollow' | 'nofollow' | 'ugc' | 'sponsored'

export interface PageLink {
  href: string
  anchor: string
  rel: Set<string>
}

export interface PageAnalysis {
  title: string
  metaRobots: string
  noindex: boolean
  nofollowAll: boolean
  canonical: string | null
  links: PageLink[]
  wordCount: number
  h1: string[]
}

/** Parse an HTML document into the facts SEO checks need. */
export function analyzeHtml(html: string, pageUrl: string, headers?: Headers): PageAnalysis {
  const $ = cheerio.load(html)
  const base = $('base[href]').attr('href')
  let baseUrl = pageUrl
  try {
    if (base) baseUrl = new URL(base, pageUrl).href
  } catch {
    /* ignore bad <base> */
  }

  const robotsMeta = $('meta[name="robots" i], meta[name="googlebot" i]')
    .map((_, el) => ($(el).attr('content') ?? '').toLowerCase())
    .get()
    .join(',')
  const xRobots = (headers?.get('x-robots-tag') ?? '').toLowerCase()
  const directives = `${robotsMeta},${xRobots}`

  let canonical: string | null = null
  const canonHref = $('link[rel~="canonical" i]').first().attr('href')
  if (canonHref) {
    try {
      canonical = new URL(canonHref, baseUrl).href
    } catch {
      canonical = null
    }
  }

  const links: PageLink[] = []
  $('a[href]').each((_, el) => {
    const raw = ($(el).attr('href') ?? '').trim()
    if (!raw || raw.startsWith('#') || /^(javascript|mailto|tel):/i.test(raw)) return
    let href: string
    try {
      href = new URL(raw, baseUrl).href
    } catch {
      return
    }
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    const alt = $(el).find('img[alt]').first().attr('alt')?.trim()
    const rel = new Set(($(el).attr('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean))
    links.push({ href, anchor: text || (alt ? `[img] ${alt}` : ''), rel })
  })

  $('script, style, noscript, template').remove()
  const text = $('body').text().replace(/\s+/g, ' ').trim()

  return {
    title: $('title').first().text().replace(/\s+/g, ' ').trim(),
    metaRobots: robotsMeta,
    noindex: /\b(noindex|none)\b/.test(directives),
    nofollowAll: /\b(nofollow|none)\b/.test(directives),
    canonical,
    links,
    wordCount: text ? text.split(' ').length : 0,
    h1: $('h1').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get(),
  }
}

export function relOf(link: PageLink, pageNofollow: boolean): Rel {
  if (link.rel.has('sponsored')) return 'sponsored'
  if (link.rel.has('ugc')) return 'ugc'
  if (link.rel.has('nofollow') || pageNofollow) return 'nofollow'
  return 'dofollow'
}

export interface BacklinkMatch {
  found: boolean
  href?: string
  anchor?: string
  rel?: Rel
  /** All links on the page pointing at the domain — useful for UI hints. */
  matches: number
}

/**
 * Find the link to `domain` (and optionally exactly `targetUrl`) on a page.
 * When several links qualify, prefer an exact target match, then a followed link.
 */
export function findBacklink(page: PageAnalysis, domain: string, targetUrl?: string): BacklinkMatch {
  const candidates = page.links.filter((l) => {
    try {
      return hostMatches(new URL(l.href).hostname, domain)
    } catch {
      return false
    }
  })
  if (!candidates.length) return { found: false, matches: 0 }
  const want = targetUrl ? urlKey(targetUrl) : null
  const exact = want ? candidates.filter((l) => urlKey(l.href) === want) : candidates
  if (want && !exact.length) return { found: false, matches: candidates.length }
  const pool = exact
  const best = pool.find((l) => relOf(l, page.nofollowAll) === 'dofollow') ?? pool[0]
  return { found: true, href: best.href, anchor: best.anchor, rel: relOf(best, page.nofollowAll), matches: candidates.length }
}
