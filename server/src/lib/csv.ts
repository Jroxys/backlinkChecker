/** RFC 4180-ish CSV parser (quotes, escaped quotes, CRLF). Also handles TSV and ';' if detected. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const delim = firstLine.includes('\t') ? '\t' : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') field += '"', i++
        else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === delim) row.push(field), (field = '')
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) row.push(field), rows.push(row)
  return rows.filter((r) => r.some((x) => x.trim()))
}

const SOURCE_HEADERS = ['linking page', 'referring page', 'source url', 'url from', 'source page', 'referring page url', 'backlink', 'from url', 'source']
const TARGET_HEADERS = ['target url', 'url to', 'target page', 'destination', 'link url', 'target']
const AUTH_HEADERS = ['domain rating', 'dr', 'domain authority', 'da', 'authority score', 'as', 'page ascore', 'domain_from_rank']

export interface ImportedLink {
  sourceUrl: string
  targetUrl?: string
  authority?: number | null
}

/**
 * Accepts:
 *  - Search Console → Links → "Latest links"/"Sample links" export (Linking page, Last crawled)
 *  - Ahrefs / Semrush / Moz backlink exports (Referring page URL, Target URL, DR/AS …)
 *  - A plain list of URLs, one per line
 * Domain-only rows (e.g. GSC "Top linking sites") can't be verified and are reported back.
 */
export function extractLinks(text: string): { links: ImportedLink[]; domainOnly: string[]; format: string } {
  const rows = parseCsv(text)
  if (!rows.length) return { links: [], domainOnly: [], format: 'empty' }
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const find = (cands: string[]) => {
    for (const cand of cands) {
      const i = header.findIndex((h) => h === cand)
      if (i >= 0) return i
    }
    for (const cand of cands) {
      const i = header.findIndex((h) => h.includes(cand))
      if (i >= 0) return i
    }
    return -1
  }
  const isUrl = (s: string) => /^https?:\/\//i.test(s.trim())
  const isDomain = (s: string) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s.trim())
  let src = find(SOURCE_HEADERS)
  // Header names lie ("Linking pages" can be a count). Trust content: pick the column with the most URLs/domains.
  const sample = rows.slice(1, 50)
  const score = (i: number) => sample.filter((r) => isUrl(r[i] ?? '') || isDomain(r[i] ?? '')).length
  if (src < 0 || score(src) === 0) {
    let best = -1
    let bestScore = 0
    for (let i = 0; i < (rows[0]?.length ?? 0); i++) if (i !== find(TARGET_HEADERS) && score(i) > bestScore) (best = i), (bestScore = score(i))
    if (best >= 0) src = best
  }
  const tgt = find(TARGET_HEADERS)
  const auth = find(AUTH_HEADERS)
  const hasHeader = !rows[0].some(isUrl)
  if (src < 0) src = Math.max(0, rows[0].findIndex(isUrl))
  const format = header.includes('linking page') ? 'search-console' : tgt >= 0 ? 'backlink-tool' : 'url-list'

  const links: ImportedLink[] = []
  const domainOnly: string[] = []
  for (const r of rows.slice(hasHeader ? 1 : 0)) {
    const s = (r[src] ?? '').trim()
    if (!s) continue
    if (!isUrl(s)) {
      if (isDomain(s)) domainOnly.push(s)
      continue
    }
    const t = tgt >= 0 ? (r[tgt] ?? '').trim() : ''
    const a = auth >= 0 ? Number(String(r[auth]).replace(',', '.')) : NaN
    links.push({ sourceUrl: s, targetUrl: isUrl(t) ? t : undefined, authority: Number.isFinite(a) ? Math.round(a > 100 ? a / 10 : a) : null })
  }
  return { links, domainOnly, format }
}
