import { z } from 'zod'
import { ApiError, body, router } from '../http.js'
import { RateLimiter, clientIp } from '../lib/auth.js'
import { FetchError } from '../lib/fetcher.js'
import { analyzeHtml, findBacklink } from '../lib/html.js'
import { normalizeDomain, parseHttpUrl, urlKey } from '../lib/url.js'
import { track } from '../services/events.js'

/**
 * Free, no-signup tools. They exist to bring people to Indexora, so they must be
 * cheap and impossible to abuse: strict per-IP and global limits, robots.txt
 * respected, SSRF-guarded fetcher, and we only ever return extracted facts —
 * never the fetched page itself.
 */
export const toolRoutes = router()

const perIp = new WeakMap<object, RateLimiter>()
const global = new WeakMap<object, RateLimiter>()
function limit(ctx: object, ip: string) {
  if (!perIp.has(ctx)) perIp.set(ctx, new RateLimiter(10, 60 * 60_000))
  if (!global.has(ctx)) global.set(ctx, new RateLimiter(500, 60 * 60_000))
  if (!perIp.get(ctx)!.take(ip)) throw new ApiError(429, 'rate_limited', 'You’ve used the free checker 10 times this hour. Create a free account to monitor links continuously.')
  if (!global.get(ctx)!.take('all')) throw new ApiError(429, 'busy', 'The free checker is busy right now. Please try again in a few minutes.')
}
const ipOf = clientIp

function fetchProblem(e: unknown) {
  if (e instanceof FetchError) {
    if (e.code === 'robots') return 'This site’s robots.txt doesn’t allow our crawler on that page, so we can’t check it.'
    if (e.code === 'ssrf' || e.code === 'bad_url') return 'That address can’t be checked.'
    if (e.code === 'timeout') return 'The page took too long to respond.'
    return `We couldn’t reach the page (${e.message}).`
  }
  return 'We couldn’t reach the page.'
}

toolRoutes.post('/backlink-check', async (c) => {
  const input = await body(c, z.object({ pageUrl: z.string().min(4).max(2000), target: z.string().min(3).max(2000) }))
  limit(c.var.ctx, ipOf((k) => c.req.header(k)))
  track(c.var.ctx.db, 'tool_backlink_check')
  const page = parseHttpUrl(input.pageUrl)
  if (!page) throw new ApiError(422, 'invalid_url', 'Enter the full URL of the page that should link to you')
  const targetUrl = /\//.test(input.target.replace(/^https?:\/\//, '')) ? parseHttpUrl(input.target) : null
  const domain = normalizeDomain(input.target)
  if (!domain) throw new ApiError(422, 'invalid_domain', 'Enter your domain, like example.com')
  try {
    const res = await c.var.ctx.fetcher.fetchPage(page.href)
    if (res.status >= 400) return c.json({ ok: false, http: res.status, problem: `The page returned HTTP ${res.status}.` })
    const a = analyzeHtml(res.body, res.finalUrl, res.headers)
    const m = findBacklink(a, domain, targetUrl && targetUrl.pathname !== '/' ? targetUrl.href : undefined)
    return c.json({
      ok: true,
      http: res.status,
      finalUrl: res.finalUrl,
      found: m.found,
      href: m.href ?? null,
      anchor: m.anchor ?? null,
      rel: m.rel ?? null,
      linksToDomain: m.matches,
      pageNoindex: a.noindex,
      pageTitle: a.title,
    })
  } catch (e) {
    return c.json({ ok: false, http: null, problem: fetchProblem(e) })
  }
})

toolRoutes.post('/indexability', async (c) => {
  const input = await body(c, z.object({ url: z.string().min(4).max(2000) }))
  limit(c.var.ctx, ipOf((k) => c.req.header(k)))
  track(c.var.ctx.db, 'tool_indexability_check')
  const u = parseHttpUrl(input.url)
  if (!u) throw new ApiError(422, 'invalid_url', 'Enter a full URL, like https://example.com/page')
  const { fetcher } = c.var.ctx
  const reasons: string[] = []
  try {
    const googlebotAllowed = await fetcher.allowedByRobots(u, 'Googlebot')
    if (!googlebotAllowed) reasons.push('robots.txt blocks Googlebot from crawling this URL.')
    const res = await fetcher.fetchPage(u.href)
    const first = res.redirects[0]
    if (first) reasons.push(`The URL redirects (${first.status}) to ${res.finalUrl}. Only the final URL can be indexed.`)
    if (res.status >= 400) reasons.push(`The server answers HTTP ${res.status}.`)
    let noindex = false
    let canonical: string | null = null
    let title = ''
    let words = 0
    if (res.status < 300 && /html/i.test(res.contentType || 'text/html')) {
      const a = analyzeHtml(res.body, res.finalUrl, res.headers)
      noindex = a.noindex
      canonical = a.canonical
      title = a.title
      words = a.wordCount
      if (noindex) reasons.push('A noindex directive (meta robots or X-Robots-Tag) tells Google not to index it.')
      if (canonical && urlKey(canonical) !== urlKey(res.finalUrl)) reasons.push(`The canonical tag points to ${canonical}, so Google will usually index that URL instead.`)
      if (!title) reasons.push('The page has no <title>.')
      if (words && words < 150) reasons.push(`Very little text (${words} words) — thin pages are often “Crawled – not indexed”.`)
    }
    const blocking = !googlebotAllowed || !!first || res.status >= 400 || noindex || (canonical !== null && urlKey(canonical) !== urlKey(res.finalUrl))
    return c.json({
      ok: true,
      indexable: !blocking,
      http: first ? first.status : res.status,
      finalUrl: res.finalUrl,
      googlebotAllowed,
      noindex,
      canonical,
      title,
      words,
      responseMs: res.timeMs,
      reasons,
    })
  } catch (e) {
    return c.json({ ok: false, problem: fetchProblem(e) })
  }
})
