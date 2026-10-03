import * as cheerio from 'cheerio'

/**
 * On-page facts for comparing two pages on the same keyword. Everything here is read from the
 * HTML we fetched ourselves; nothing is estimated.
 */
export interface PageFacts {
  url: string
  title: string
  metaDescription: string
  h1: string[]
  h2Count: number
  wordCount: number
  /** Lower-cased, accent-folded body text (for keyword matching) */
  text: string
  internalLinks: number
  externalLinks: number
  images: number
  imagesWithoutAlt: number
  schemaTypes: string[]
  lang: string | null
  https: boolean
  responseMs: number | null
}

/** Lower-case and strip accents so "SEO Araçları" matches "seo araclari" and "İ" behaves. */
export const fold = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim()

export function pageFacts(html: string, url: string, responseMs: number | null = null): PageFacts {
  const $ = cheerio.load(html)
  const host = new URL(url).hostname.replace(/^www\./, '')
  let internal = 0
  let external = 0
  $('a[href]').each((_, el) => {
    try {
      const h = new URL($(el).attr('href') ?? '', url)
      if (!/^https?:$/.test(h.protocol)) return
      if (h.hostname.replace(/^www\./, '') === host) internal++
      else external++
    } catch {
      /* ignore */
    }
  })
  const schemaTypes = new Set<string>()
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const walk = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(walk)
        else if (v && typeof v === 'object') {
          const t = (v as Record<string, unknown>)['@type']
          if (typeof t === 'string') schemaTypes.add(t)
          if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && schemaTypes.add(x))
          for (const k of ['@graph', 'mainEntity', 'itemListElement']) walk((v as Record<string, unknown>)[k])
        }
      }
      walk(JSON.parse($(el).text()))
    } catch {
      /* invalid JSON-LD is common; ignore */
    }
  })
  const images = $('img')
  const imagesWithoutAlt = images.filter((_, el) => !($(el).attr('alt') ?? '').trim()).length
  const h1 = $('h1').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get()
  const h2Count = $('h2').length
  $('script, style, noscript, template, nav, footer').remove()
  const raw = $('body').text().replace(/\s+/g, ' ').trim()
  return {
    url,
    title: $('title').first().text().replace(/\s+/g, ' ').trim(),
    metaDescription: ($('meta[name="description" i]').attr('content') ?? '').trim(),
    h1,
    h2Count,
    wordCount: raw ? raw.split(' ').length : 0,
    text: fold(raw),
    internalLinks: internal,
    externalLinks: external,
    images: images.length,
    imagesWithoutAlt,
    schemaTypes: [...schemaTypes].sort(),
    lang: $('html').attr('lang') ?? null,
    https: url.startsWith('https://'),
    responseMs,
  }
}

export type Verdict = 'ahead' | 'even' | 'behind' | 'missing'
export interface ComparisonCheck {
  id: string
  label: string
  mine: string
  theirs: string
  verdict: Verdict
  /** What to do about it, when we're behind */
  advice: string | null
  /** Rough importance for sorting the to-do list (higher first) */
  weight: number
}

const count = (text: string, phrase: string) => {
  if (!phrase) return 0
  let n = 0
  let i = text.indexOf(phrase)
  while (i !== -1) {
    n++
    i = text.indexOf(phrase, i + phrase.length)
  }
  return n
}

/** All words of the keyword (2+ letters) appear in `s`, in any order. */
const coversTerms = (s: string, kw: string) => fold(kw).split(' ').filter((w) => w.length > 1).every((w) => fold(s).includes(w))
const slugText = (u: string) => fold(decodeURIComponent(new URL(u).pathname).replace(/[-_/.]+/g, ' '))

/**
 * Side-by-side on-page comparison for one keyword. Signals are the ones Google documents or
 * that correlate reliably with ranking; each comes with a concrete fix when we're behind.
 */
export function comparePages(keyword: string, mine: PageFacts, theirs: PageFacts, extra: { myRefDomains?: number | null; theirRefDomains?: number | null } = {}): ComparisonCheck[] {
  const kw = fold(keyword)
  const checks: ComparisonCheck[] = []
  const yn = (b: boolean) => (b ? 'Yes' : 'No')
  const bool = (id: string, label: string, a: boolean, b: boolean, advice: string, weight: number) =>
    checks.push({ id, label, mine: yn(a), theirs: yn(b), verdict: a === b ? (a ? 'even' : 'missing') : a ? 'ahead' : 'behind', advice: !a ? advice : null, weight })

  bool('title', 'Keyword in the title', coversTerms(mine.title, kw), coversTerms(theirs.title, kw), `Put “${keyword}” (or all its words) in the <title>, ideally near the start.`, 10)
  bool('h1', 'Keyword in the H1', mine.h1.some((h) => coversTerms(h, kw)), theirs.h1.some((h) => coversTerms(h, kw)), `Use one H1 that contains “${keyword}”.`, 8)
  bool('url', 'Keyword in the URL', coversTerms(slugText(mine.url), kw), coversTerms(slugText(theirs.url), kw), 'A short URL containing the keyword helps a little; only change it with a 301 redirect from the old URL.', 3)
  bool('description', 'Keyword in the meta description', coversTerms(mine.metaDescription, kw), coversTerms(theirs.metaDescription, kw), 'Write a 140–160 character meta description that includes the keyword; Google bolds matching words in results.', 4)
  bool('intro', 'Keyword in the first 100 words', mine.text.split(' ').slice(0, 100).join(' ').includes(kw), theirs.text.split(' ').slice(0, 100).join(' ').includes(kw), 'Answer the query early: mention the keyword in the first paragraph.', 5)

  const [mw, tw] = [mine.wordCount, theirs.wordCount]
  checks.push({
    id: 'words',
    label: 'Content length (words)',
    mine: String(mw),
    theirs: String(tw),
    verdict: mw >= tw * 0.8 ? (mw > tw * 1.2 ? 'ahead' : 'even') : 'behind',
    advice: mw < tw * 0.8 ? `Their page has ~${tw} words vs your ${mw}. Cover the topic more completely — subtopics, examples, FAQs — not filler.` : null,
    weight: 7,
  })
  const [mc, tc] = [count(mine.text, kw), count(theirs.text, kw)]
  checks.push({ id: 'mentions', label: 'Exact keyword mentions', mine: String(mc), theirs: String(tc), verdict: mc >= tc * 0.6 ? (mc > tc ? 'ahead' : 'even') : 'behind', advice: mc < tc * 0.6 ? 'Use the exact phrase a few more times where it reads naturally (headings, captions), never stuffed.' : null, weight: 3 })
  checks.push({ id: 'h2', label: 'Subheadings (H2)', mine: String(mine.h2Count), theirs: String(theirs.h2Count), verdict: mine.h2Count >= theirs.h2Count * 0.7 ? (mine.h2Count > theirs.h2Count ? 'ahead' : 'even') : 'behind', advice: mine.h2Count < theirs.h2Count * 0.7 ? 'Structure the page with more H2 sections, each answering one sub-question.' : null, weight: 4 })
  checks.push({ id: 'internal', label: 'Internal links on the page', mine: String(mine.internalLinks), theirs: String(theirs.internalLinks), verdict: mine.internalLinks >= theirs.internalLinks * 0.5 ? 'even' : 'behind', advice: mine.internalLinks < theirs.internalLinks * 0.5 ? 'Link to related pages on your site from this one (and to it from your strongest pages).' : null, weight: 3 })

  const ms = mine.schemaTypes.filter((t) => !theirs.schemaTypes.includes(t))
  const ts = theirs.schemaTypes.filter((t) => !mine.schemaTypes.includes(t))
  checks.push({
    id: 'schema',
    label: 'Structured data',
    mine: mine.schemaTypes.join(', ') || 'None',
    theirs: theirs.schemaTypes.join(', ') || 'None',
    verdict: ts.length && !ms.length ? 'behind' : ms.length && !ts.length ? 'ahead' : mine.schemaTypes.length ? 'even' : 'missing',
    advice: ts.length ? `They use ${ts.join(', ')} markup. Add the types that fit your page (e.g. Article, FAQPage, Product) as JSON-LD.` : null,
    weight: 4,
  })
  const alt = (f: PageFacts) => (f.images ? `${f.images - f.imagesWithoutAlt}/${f.images}` : '—')
  checks.push({ id: 'alt', label: 'Images with alt text', mine: alt(mine), theirs: alt(theirs), verdict: mine.imagesWithoutAlt === 0 ? 'even' : 'behind', advice: mine.imagesWithoutAlt ? `${mine.imagesWithoutAlt} image(s) have no alt text. Describe them; it's also how images rank in Google Images.` : null, weight: 2 })

  if (mine.responseMs !== null && theirs.responseMs !== null) {
    const slower = mine.responseMs > theirs.responseMs * 1.5 && mine.responseMs > 800
    checks.push({ id: 'speed', label: 'Server response time', mine: `${mine.responseMs} ms`, theirs: `${theirs.responseMs} ms`, verdict: slower ? 'behind' : mine.responseMs < theirs.responseMs ? 'ahead' : 'even', advice: slower ? 'Your HTML takes noticeably longer to arrive. Add page caching or a CDN for this template.' : null, weight: 4 })
  }
  bool('https', 'Served over HTTPS', mine.https, theirs.https, 'Move the page to HTTPS with a 301 redirect.', 6)

  if (extra.myRefDomains != null && extra.theirRefDomains != null) {
    const [a, b] = [extra.myRefDomains, extra.theirRefDomains]
    checks.push({
      id: 'refdomains',
      label: 'Referring domains (site)',
      mine: String(a),
      theirs: String(b),
      verdict: a >= b * 0.8 ? (a > b * 1.2 ? 'ahead' : 'even') : 'behind',
      advice: a < b * 0.8 ? `Their site has links from ~${b} domains vs your ${a}. See Opportunities for sites that link to them but not to you.` : null,
      weight: 9,
    })
  }
  return checks
}

/** The to-do list: things we're behind on or both miss, most important first. */
export const todo = (checks: ComparisonCheck[]) =>
  checks
    .filter((c) => c.advice && (c.verdict === 'behind' || c.verdict === 'missing'))
    .sort((a, b) => b.weight - a.weight)
    .map((c) => ({ id: c.id, advice: c.advice! }))
