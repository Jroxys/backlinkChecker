/**
 * Live Google results for a keyword. Scraping Google ourselves breaks its terms and gets
 * blocked, so this sits behind an interface served by a SERP API (DataForSEO today).
 * Without a provider, rank tracking still works from Search Console, and comparisons
 * use a competitor URL the user enters.
 */
export interface SerpResult {
  position: number
  url: string
  domain: string
  title: string
}

export interface SerpProvider {
  name: string
  search(keyword: string, opts?: { languageCode?: string; locationName?: string; device?: 'desktop' | 'mobile' }): Promise<SerpResult[]>
}

/** DataForSEO SERP API, Google organic, live mode (https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/). */
export class DataForSeoSerp implements SerpProvider {
  name = 'dataforseo'
  constructor(
    private login: string,
    private password: string,
    private fetchImpl: typeof fetch = globalThis.fetch,
  ) {}

  async search(keyword: string, opts: { languageCode?: string; locationName?: string; device?: 'desktop' | 'mobile' } = {}) {
    const res = await this.fetchImpl('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
      method: 'POST',
      headers: {
        authorization: 'Basic ' + Buffer.from(`${this.login}:${this.password}`).toString('base64'),
        'content-type': 'application/json',
      },
      body: JSON.stringify([
        { keyword, language_code: opts.languageCode ?? 'en', location_name: opts.locationName ?? 'United States', device: opts.device ?? 'desktop', depth: 20 },
      ]),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`DataForSEO SERP HTTP ${res.status}`)
    const json = (await res.json()) as { tasks?: { status_code: number; status_message: string; result?: { items?: Record<string, unknown>[] }[] }[] }
    const t = json.tasks?.[0]
    if (!t || t.status_code >= 40000) throw new Error(`DataForSEO SERP: ${t?.status_message ?? 'no task'}`)
    return (t.result?.[0]?.items ?? [])
      .filter((i) => i.type === 'organic' && typeof i.url === 'string')
      .map((i) => ({ position: Number(i.rank_group), url: String(i.url), domain: String(i.domain ?? new URL(String(i.url)).hostname), title: String(i.title ?? '') }))
      .slice(0, 10)
  }
}
