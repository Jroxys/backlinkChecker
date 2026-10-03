import { isIP } from 'node:net'
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

/** Plain-English meaning of TLS verification errors from Node/OpenSSL. */
function explainTls(error: string) {
  const e = error.toUpperCase()
  if (e.includes('EXPIRED')) return 'The certificate has expired. Browsers show a full-page security warning.'
  if (e.includes('ALTNAME') || e.includes('HOSTNAME')) return 'The certificate was issued for a different hostname (for example only for www, or only for the bare domain).'
  if (e.includes('SELF_SIGNED') || e.includes('SELF-SIGNED')) return 'The certificate is self-signed, so browsers don’t trust it.'
  if (e.includes('UNABLE_TO_VERIFY_LEAF') || e.includes('UNABLE_TO_GET_ISSUER')) return 'The server doesn’t send the intermediate certificate. Some browsers and Googlebot may fail to verify it — install the full chain.'
  if (e.includes('NOT_YET_VALID')) return 'The certificate isn’t valid yet — check the server clock or the certificate’s start date.'
  if (e.includes('ECONNREFUSED')) return 'Nothing answers on port 443 — HTTPS isn’t set up on this host.'
  if (e.includes('ENOTFOUND')) return 'This hostname doesn’t resolve in DNS.'
  if (e.includes('TIMED OUT') || e.includes('TIMEOUT')) return 'The server didn’t respond on port 443 in time.'
  if (e.includes('PRIVATE')) return 'That address can’t be checked.'
  return `The certificate couldn’t be verified (${error}).`
}

const hostOf = (input: string) => {
  const s = input.trim().toLowerCase()
  try {
    const h = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(s) ? s : `https://${s}`).hostname.replace(/\.$/, '')
    // Names only: IP literals bypass DNS-based SSRF checks and aren't what these tools are for
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) && !isIP(h) ? h : null
  } catch {
    return null
  }
}

toolRoutes.post('/ssl-check', async (c) => {
  const input = await body(c, z.object({ host: z.string().min(3).max(300) }))
  limit(c.var.ctx, ipOf((k) => c.req.header(k)))
  track(c.var.ctx.db, 'tool_ssl_check')
  const host = hostOf(input.host)
  if (!host) throw new ApiError(422, 'invalid_host', 'Enter a domain like example.com')
  const cert = await c.var.ctx.probes.certificate(host)
  const daysLeft = cert.expiresAt ? Math.floor((new Date(cert.expiresAt).getTime() - c.var.ctx.now().getTime()) / 86_400_000) : null
  const valid = !cert.error && daysLeft !== null && daysLeft >= 0
  return c.json({
    ok: true,
    host,
    valid,
    expiresAt: cert.expiresAt,
    daysLeft,
    issuer: cert.issuer,
    error: cert.error,
    explanation: cert.error ? explainTls(cert.error) : daysLeft !== null && daysLeft <= 14 ? `It expires in ${daysLeft} days. Check that automatic renewal is working.` : null,
  })
})

interface Hop {
  from: string
  to: string
  status: number
}

/**
 * Redirect chain for one URL, plus the four http/https × www/non-www variants of it:
 * they should all end at one final URL in a single permanent hop.
 */
toolRoutes.post('/redirect-check', async (c) => {
  const input = await body(c, z.object({ url: z.string().min(4).max(2000) }))
  // Five fetches per request: count it as three uses of the hourly allowance
  for (let i = 0; i < 3; i++) limit(c.var.ctx, ipOf((k) => c.req.header(k)))
  track(c.var.ctx.db, 'tool_redirect_check')
  const u = parseHttpUrl(input.url)
  if (!u) throw new ApiError(422, 'invalid_url', 'Enter a full URL, like https://example.com/page')
  const { fetcher } = c.var.ctx
  const follow = async (url: string) => {
    try {
      const r = await fetcher.fetchPage(url)
      return { url, hops: r.redirects as Hop[], finalUrl: r.finalUrl, status: r.status, error: null as string | null }
    } catch (e) {
      return { url, hops: [] as Hop[], finalUrl: null as string | null, status: null as number | null, error: fetchProblem(e) }
    }
  }

  const chain = await follow(u.href)
  const bare = u.host.replace(/^www\./, '')
  const path = u.pathname + u.search
  const variants = await Promise.all(['http://', 'https://'].flatMap((scheme) => [bare, `www.${bare}`].map((h) => follow(`${scheme}${h}${path}`))))

  const issues: string[] = []
  if (chain.error) issues.push(chain.error)
  if (chain.hops.length > 1) issues.push(`${chain.hops.length} redirects in a row. Link to the final URL directly — every extra hop slows crawling and can leak link equity.`)
  const temp = chain.hops.find((h) => h.status === 302 || h.status === 307)
  if (temp) issues.push(`A temporary redirect (${temp.status}) from ${temp.from}. If the move is permanent, use 301 or 308 so Google transfers ranking signals.`)
  if (chain.status && chain.status >= 400) issues.push(`The final URL answers HTTP ${chain.status}.`)
  if (chain.finalUrl?.startsWith('http://')) issues.push('The final URL is served over plain HTTP. Redirect it to HTTPS.')
  const finals = [...new Set(variants.filter((v) => v.finalUrl && v.status && v.status < 400).map((v) => v.finalUrl!))]
  if (finals.length > 1) issues.push(`Your site answers on ${finals.length} different addresses (${finals.join(', ')}). Pick one and 301-redirect the others to it, or Google may split signals between duplicates.`)
  const httpStays = variants.find((v) => v.url.startsWith('http://') && v.finalUrl?.startsWith('http://') && v.status && v.status < 400)
  if (httpStays) issues.push(`${httpStays.url} doesn’t redirect to HTTPS.`)

  return c.json({
    ok: true,
    chain,
    variants: variants.map((v) => ({ url: v.url, finalUrl: v.finalUrl, status: v.status, hops: v.hops.length, permanent: v.hops.every((h) => h.status === 301 || h.status === 308), error: v.error })),
    issues,
  })
})
