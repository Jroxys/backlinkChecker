import { lookup } from 'node:dns/promises'
import { createRequire } from 'node:module'

interface Robots {
  isAllowed(url: string, ua?: string): boolean | undefined
  getSitemaps(): string[]
}
// robots-parser is CommonJS with a default-export typing that NodeNext resolution misreads.
const robotsParser = createRequire(import.meta.url)('robots-parser') as (url: string, body: string) => Robots
import { isPublicHost } from './url.js'

export interface FetchResult {
  /** URL that was requested */
  url: string
  /** URL after following redirects */
  finalUrl: string
  status: number
  headers: Headers
  body: string
  contentType: string
  redirects: { from: string; to: string; status: number }[]
  timeMs: number
}

export class FetchError extends Error {
  constructor(
    message: string,
    readonly code: 'robots' | 'ssrf' | 'timeout' | 'network' | 'too_many_redirects' | 'too_large' | 'bad_url',
  ) {
    super(message)
  }
}

export interface FetcherOptions {
  userAgent: string
  /** Allow private/loopback addresses — only for tests and self-hosted setups. */
  allowPrivate?: boolean
  /** Minimum gap between two requests to the same host. */
  perHostDelayMs?: number
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  respectRobots?: boolean
  fetchImpl?: typeof fetch
}

interface RobotsEntry {
  parser: Robots | null
  expires: number
}

/**
 * HTTP client for crawling other people's websites.
 * - honours robots.txt (cached 6h per origin) for our user-agent
 * - spaces requests to the same host (default 2s) so we never hammer a site
 * - follows redirects manually so every hop is SSRF- and robots-checked
 * - caps body size and time
 */
export class PoliteFetcher {
  private robots = new Map<string, RobotsEntry>()
  private hostQueue = new Map<string, Promise<void>>()
  private lastHit = new Map<string, number>()
  private opts: Required<Omit<FetcherOptions, 'fetchImpl'>> & { fetchImpl: typeof fetch }

  constructor(opts: FetcherOptions) {
    this.opts = {
      allowPrivate: false,
      perHostDelayMs: 2000,
      timeoutMs: 15000,
      maxBytes: 3 * 1024 * 1024,
      maxRedirects: 5,
      respectRobots: true,
      fetchImpl: globalThis.fetch,
      ...opts,
    }
  }

  get userAgent() {
    return this.opts.userAgent
  }

  private async assertAllowedHost(u: URL) {
    if (this.opts.allowPrivate) return
    if (!isPublicHost(u.hostname)) throw new FetchError(`Refusing to fetch private host ${u.hostname}`, 'ssrf')
    try {
      const addrs = await lookup(u.hostname, { all: true })
      for (const a of addrs) {
        if (a.family === 4 && !isPublicHost(a.address)) throw new FetchError(`${u.hostname} resolves to a private address`, 'ssrf')
        if (a.family === 6 && /^(::1|fc|fd|fe80)/i.test(a.address)) throw new FetchError(`${u.hostname} resolves to a private address`, 'ssrf')
      }
    } catch (e) {
      if (e instanceof FetchError) throw e
      throw new FetchError(`DNS lookup failed for ${u.hostname}`, 'network')
    }
  }

  /** Serialise requests per host and enforce the minimum delay. */
  private async slot<T>(host: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.hostQueue.get(host) ?? Promise.resolve()
    let release!: () => void
    const mine = new Promise<void>((r) => (release = r))
    const chain = prev.then(() => mine)
    this.hostQueue.set(host, chain)
    await prev
    try {
      const wait = (this.lastHit.get(host) ?? 0) + this.opts.perHostDelayMs - Date.now()
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      return await fn()
    } finally {
      this.lastHit.set(host, Date.now())
      release()
      if (this.hostQueue.get(host) === chain) this.hostQueue.delete(host)
    }
  }

  private async raw(u: URL, accept: string): Promise<Response> {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), this.opts.timeoutMs)
    try {
      return await this.opts.fetchImpl(u, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'user-agent': this.opts.userAgent, accept, 'accept-language': 'en;q=0.9,*;q=0.5' },
      })
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new FetchError(`Timed out after ${this.opts.timeoutMs}ms`, 'timeout')
      throw new FetchError((e as Error).message || 'Network error', 'network')
    } finally {
      clearTimeout(t)
    }
  }

  private async readCapped(res: Response): Promise<string> {
    if (!res.body) return ''
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > this.opts.maxBytes) {
        await reader.cancel()
        break // keep what we have: links are usually in the first few MB
      }
      chunks.push(value)
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks))
  }

  /** Is our user-agent allowed to fetch this URL according to robots.txt? */
  async allowedByRobots(u: URL, userAgent = this.opts.userAgent): Promise<boolean> {
    if (!this.opts.respectRobots && userAgent === this.opts.userAgent) return true
    const parser = await this.robotsFor(u)
    if (!parser) return true
    return parser.isAllowed(u.href, userAgent) !== false
  }

  /** Raw robots.txt sitemaps for an origin. */
  async sitemapsFromRobots(u: URL): Promise<string[]> {
    return (await this.robotsFor(u))?.getSitemaps() ?? []
  }

  private async robotsFor(u: URL) {
    const origin = u.origin
    let entry = this.robots.get(origin)
    if (!entry || entry.expires < Date.now()) {
      let parser: RobotsEntry['parser'] = null
      try {
        await this.assertAllowedHost(u)
        const robotsUrl = new URL('/robots.txt', origin)
        const res = await this.slot(u.host, () => this.raw(robotsUrl, 'text/plain'))
        if (res.status >= 200 && res.status < 300) parser = robotsParser(robotsUrl.href, await this.readCapped(res))
        else await res.body?.cancel()
      } catch {
        parser = null // unreachable robots.txt: treat as allow-all, like most crawlers
      }
      entry = { parser, expires: Date.now() + 6 * 3_600_000 }
      this.robots.set(origin, entry)
    }
    return entry.parser
  }

  /**
   * @param ownSite when true we skip *our* robots.txt check — the user owns the site and asked us to monitor it.
   *                Politeness delays and SSRF checks still apply.
   */
  async fetchPage(input: string, { accept = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', ownSite = false } = {}): Promise<FetchResult> {
    let current: URL
    try {
      current = new URL(input)
    } catch {
      throw new FetchError(`Invalid URL: ${input}`, 'bad_url')
    }
    const start = Date.now()
    const redirects: FetchResult['redirects'] = []
    for (let hop = 0; hop <= this.opts.maxRedirects; hop++) {
      if (current.protocol !== 'http:' && current.protocol !== 'https:') throw new FetchError(`Unsupported protocol ${current.protocol}`, 'bad_url')
      await this.assertAllowedHost(current)
      if (!ownSite && !(await this.allowedByRobots(current))) throw new FetchError(`Blocked by robots.txt: ${current.href}`, 'robots')
      const target = current
      const res = await this.slot(target.host, () => this.raw(target, accept))
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        await res.body?.cancel()
        const next = new URL(res.headers.get('location')!, current)
        redirects.push({ from: current.href, to: next.href, status: res.status })
        current = next
        continue
      }
      const contentType = res.headers.get('content-type') ?? ''
      const textual = !contentType || /html|xml|text|json/i.test(contentType)
      const body = textual ? await this.readCapped(res) : (await res.body?.cancel(), '')
      return { url: input, finalUrl: current.href, status: res.status, headers: res.headers, body, contentType, redirects, timeMs: Date.now() - start }
    }
    throw new FetchError(`More than ${this.opts.maxRedirects} redirects`, 'too_many_redirects')
  }
}
