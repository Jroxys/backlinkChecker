/**
 * Backlink discovery = finding links we don't know about yet.
 *
 * Verifying a known link is cheap (one HTTP request), so we do it ourselves.
 * Discovering unknown links requires a crawl of the whole web, which no
 * early-stage product can afford — so it sits behind this interface and is
 * served by a third-party index (DataForSEO today; swappable).
 */
export interface DiscoveredLink {
  sourceUrl: string
  targetUrl: string
  anchor: string
  dofollow: boolean
  authority: number | null
  firstSeen: string | null
}

export interface GapDomain {
  domain: string
  authority: number | null
  /** Competitor domains this referring domain links to */
  linksTo: string[]
}

export interface BacklinkProvider {
  name: string
  /** Newest backlinks to a domain. */
  discover(domain: string, opts?: { limit?: number }): Promise<DiscoveredLink[]>
  /** Referring domains that link to competitors but not to `domain`. */
  gap(domain: string, competitors: string[], opts?: { limit?: number }): Promise<GapDomain[]>
}

type Json = Record<string, unknown>

/**
 * DataForSEO Backlinks API (https://docs.dataforseo.com/v3/backlinks/).
 * Pay-as-you-go; costs are per request + per row, so callers keep `limit` small.
 */
export class DataForSeoProvider implements BacklinkProvider {
  name = 'dataforseo'
  constructor(
    private login: string,
    private password: string,
    private fetchImpl: typeof fetch = globalThis.fetch,
  ) {}

  private async call(path: string, task: Json): Promise<Json[]> {
    const res = await this.fetchImpl(`https://api.dataforseo.com/v3/${path}`, {
      method: 'POST',
      headers: {
        authorization: 'Basic ' + Buffer.from(`${this.login}:${this.password}`).toString('base64'),
        'content-type': 'application/json',
      },
      body: JSON.stringify([task]),
    })
    if (!res.ok) throw new Error(`DataForSEO ${path} HTTP ${res.status}`)
    const json = (await res.json()) as { tasks?: { status_code: number; status_message: string; result?: { items?: Json[] }[] }[] }
    const t = json.tasks?.[0]
    if (!t || t.status_code >= 40000) throw new Error(`DataForSEO ${path}: ${t?.status_message ?? 'no task'}`)
    return t.result?.[0]?.items ?? []
  }

  async discover(domain: string, { limit = 100 } = {}) {
    const items = await this.call('backlinks/backlinks/live', {
      target: domain,
      mode: 'one_per_domain',
      filters: ['is_lost', '=', false],
      order_by: ['first_seen,desc'],
      limit,
    })
    return items.map((i) => ({
      sourceUrl: String(i.url_from),
      targetUrl: String(i.url_to),
      anchor: String(i.anchor ?? ''),
      dofollow: Boolean(i.dofollow),
      authority: typeof i.domain_from_rank === 'number' ? Math.round(i.domain_from_rank / 10) : null,
      firstSeen: (i.first_seen as string) ?? null,
    }))
  }

  async gap(domain: string, competitors: string[], { limit = 100 } = {}) {
    if (!competitors.length) return []
    const targets: Record<string, string> = {}
    competitors.slice(0, 20).forEach((c, i) => (targets[String(i + 1)] = c))
    const items = await this.call('backlinks/domain_intersection/live', {
      targets,
      exclude_targets: [domain],
      intersection_mode: 'partial',
      order_by: ['1.rank,desc'],
      limit,
    })
    return items.map((i) => {
      const inter = (i.domain_intersection ?? {}) as Record<string, Json>
      const first = Object.values(inter)[0] ?? {}
      return {
        domain: String(first.target ?? ''),
        authority: typeof first.rank === 'number' ? Math.round(first.rank / 10) : null,
        linksTo: Object.keys(inter).map((k) => competitors[Number(k) - 1]).filter(Boolean),
      }
    })
  }
}
