import type { Db } from '../db/index.js'
import { decrypt, encrypt } from '../lib/crypto.js'
import { now } from '../lib/ids.js'

/**
 * Google Search Console access.
 *
 * Scope is read-only on purpose: we only need to *read* index status, sitemaps
 * and properties. Asking new users for write access to their Search Console is
 * a trust cost an unknown product can't afford.
 *
 * Note what Google does NOT offer: there is no public API to "request indexing"
 * for normal pages. The Indexing API is limited to JobPosting/BroadcastEvent
 * pages, and using it for anything else violates its terms. Indexora therefore
 * monitors and explains index status; it never pretends to force indexing.
 */
export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

export type IndexStatus = 'indexed' | 'crawled' | 'discovered' | 'blocked' | 'error' | 'unknown'

export interface InspectionResult {
  status: IndexStatus
  coverageState: string
  verdict: string
  lastCrawlTime: string | null
  googleCanonical: string | null
  userCanonical: string | null
  robotsTxtState: string | null
  pageFetchState: string | null
  sitemaps: string[]
  referringUrls: string[]
}

/** Map Search Console's free-text coverage state onto our six buckets. */
export function mapCoverage(coverage: string, verdict = ''): IndexStatus {
  const c = coverage.toLowerCase()
  if (!c) return verdict === 'PASS' ? 'indexed' : 'unknown'
  if (c.includes('unknown to google')) return 'unknown'
  if (c.includes('crawled') && c.includes('not indexed')) return 'crawled'
  if (c.includes('discovered') && c.includes('not indexed')) return 'discovered'
  if (c.includes('robots.txt') || c.includes('noindex') || c.includes('blocked')) return 'blocked'
  if (/404|5xx|server error|soft 404|redirect error|not found|access denied|forbidden|4xx/.test(c)) return 'error'
  if (c.includes('duplicate') || c.includes('alternate page')) return 'crawled'
  if (c.includes('indexed')) return 'indexed'
  return verdict === 'PASS' ? 'indexed' : 'unknown'
}

export interface GoogleClient {
  configured: boolean
  authUrl(state: string, redirectUri: string): string
  exchangeCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number; scope: string; email?: string }>
  refresh(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }>
  listSites(accessToken: string): Promise<{ siteUrl: string; permissionLevel: string }[]>
  inspect(accessToken: string, siteUrl: string, url: string): Promise<InspectionResult>
  listSitemaps(accessToken: string, siteUrl: string): Promise<{ path: string; lastDownloaded?: string; errors?: number; warnings?: number; isPending?: boolean }[]>
}

export function createGoogleClient(clientId: string, clientSecret: string, fetchImpl: typeof fetch = globalThis.fetch): GoogleClient {
  const json = async (res: Response) => {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const err = (body.error as { message?: string })?.message ?? (body.error_description as string) ?? res.statusText
      throw new Error(`Google API ${res.status}: ${err}`)
    }
    return body
  }
  const authed = (token: string) => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' })

  return {
    configured: Boolean(clientId && clientSecret),
    authUrl(state, redirectUri) {
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: `${GSC_SCOPE} openid email`,
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
      })
      return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
    },
    async exchangeCode(code, redirectUri) {
      const body = await json(
        await fetchImpl('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
        }),
      )
      let email: string | undefined
      if (typeof body.id_token === 'string') {
        try {
          email = JSON.parse(Buffer.from(body.id_token.split('.')[1], 'base64url').toString()).email
        } catch {
          /* optional */
        }
      }
      return {
        accessToken: String(body.access_token),
        refreshToken: body.refresh_token as string | undefined,
        expiresIn: Number(body.expires_in ?? 3600),
        scope: String(body.scope ?? GSC_SCOPE),
        email,
      }
    },
    async refresh(refreshToken) {
      const body = await json(
        await fetchImpl('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
        }),
      )
      return { accessToken: String(body.access_token), expiresIn: Number(body.expires_in ?? 3600) }
    },
    async listSites(token) {
      const body = await json(await fetchImpl('https://www.googleapis.com/webmasters/v3/sites', { headers: authed(token) }))
      return ((body.siteEntry as { siteUrl: string; permissionLevel: string }[]) ?? []).filter((s) => s.permissionLevel !== 'siteUnverifiedUser')
    },
    async inspect(token, siteUrl, url) {
      const body = await json(
        await fetchImpl('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
          method: 'POST',
          headers: authed(token),
          body: JSON.stringify({ inspectionUrl: url, siteUrl, languageCode: 'en-US' }),
        }),
      )
      const r = ((body.inspectionResult as Record<string, unknown>)?.indexStatusResult ?? {}) as Record<string, unknown>
      const coverageState = String(r.coverageState ?? '')
      const verdict = String(r.verdict ?? '')
      return {
        status: mapCoverage(coverageState, verdict),
        coverageState,
        verdict,
        lastCrawlTime: (r.lastCrawlTime as string) ?? null,
        googleCanonical: (r.googleCanonical as string) ?? null,
        userCanonical: (r.userCanonical as string) ?? null,
        robotsTxtState: (r.robotsTxtState as string) ?? null,
        pageFetchState: (r.pageFetchState as string) ?? null,
        sitemaps: (r.sitemap as string[]) ?? [],
        referringUrls: (r.referringUrls as string[]) ?? [],
      }
    },
    async listSitemaps(token, siteUrl) {
      const body = await json(await fetchImpl(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`, { headers: authed(token) }))
      return ((body.sitemap as Record<string, unknown>[]) ?? []).map((s) => ({
        path: String(s.path),
        lastDownloaded: s.lastDownloaded as string | undefined,
        errors: Number(s.errors ?? 0),
        warnings: Number(s.warnings ?? 0),
        isPending: Boolean(s.isPending),
      }))
    },
  }
}

/** Store tokens encrypted at rest. */
export function saveConnection(db: Db, userId: string, t: { accessToken: string; refreshToken?: string; expiresIn: number; scope: string; email?: string }) {
  const existing = db.get<{ refresh_token: string | null }>('SELECT refresh_token FROM google_connections WHERE user_id = ?', [userId])
  db.run(
    `INSERT INTO google_connections (user_id, email, access_token, refresh_token, expires_at, scope, created_at)
     VALUES (:u, :email, :at, :rt, :exp, :scope, :now)
     ON CONFLICT(user_id) DO UPDATE SET email = COALESCE(:email, email), access_token = :at,
       refresh_token = COALESCE(:rt, refresh_token), expires_at = :exp, scope = :scope`,
    {
      u: userId,
      email: t.email ?? null,
      at: encrypt(t.accessToken),
      rt: t.refreshToken ? encrypt(t.refreshToken) : existing?.refresh_token ?? null,
      exp: new Date(Date.now() + (t.expiresIn - 60) * 1000).toISOString(),
      scope: t.scope,
      now: now(),
    },
  )
}

/** Returns a valid access token, refreshing it if needed; null when the user hasn't connected Google. */
export async function accessTokenFor(db: Db, google: GoogleClient, userId: string): Promise<string | null> {
  const row = db.get<{ access_token: string; refresh_token: string | null; expires_at: string }>(
    'SELECT access_token, refresh_token, expires_at FROM google_connections WHERE user_id = ?',
    [userId],
  )
  if (!row) return null
  if (row.expires_at > new Date().toISOString()) return decrypt(row.access_token)
  if (!row.refresh_token) return null
  const r = await google.refresh(decrypt(row.refresh_token))
  db.run('UPDATE google_connections SET access_token = ?, expires_at = ? WHERE user_id = ?', [
    encrypt(r.accessToken),
    new Date(Date.now() + (r.expiresIn - 60) * 1000).toISOString(),
    userId,
  ])
  return r.accessToken
}
