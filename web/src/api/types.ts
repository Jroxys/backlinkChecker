/** Shapes returned by the Indexora API (server/src/routes/*). Demo mode produces the same shapes. */

export type IndexStatus = 'indexed' | 'crawled' | 'discovered' | 'blocked' | 'error' | 'unknown'
export type LinkRel = 'dofollow' | 'nofollow' | 'ugc' | 'sponsored'
export type BacklinkStatus = 'pending' | 'active' | 'lost' | 'broken' | 'blocked'
export type PlanId = 'free' | 'starter' | 'pro' | 'agency'

export interface Plan {
  id: PlanId
  name: string
  monthly: number
  yearly: number
  founding: number
  limits: {
    projects: number
    urls: number
    backlinks: number
    competitorsPerProject: number
    seats: number
    backlinkCheckHours: number
    urlCheckHours: number
    discovery: false | 'weekly' | 'daily'
  }
  features: { slack: boolean; webhooks: boolean; reports: boolean; whiteLabel: boolean; api: boolean }
}

export interface ApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

export interface Me {
  user: { id: string; email: string; name: string; plan: PlanId; founding: boolean; createdAt: string; isAdmin?: boolean }
  plan: Plan
  usage: { projects: number; urls: number; backlinks: number }
  google: { connected: boolean; email: string | null; configured: boolean }
  branding?: Branding
  team?: { role: 'owner' | 'member'; ownerName: string; suspended: boolean }
}

export interface Team {
  role: 'owner' | 'member'
  seats: { used: number; limit: number }
  owner: { id: string; name: string; email: string }
  members: { id: string; name: string; email: string; joinedAt: string }[]
  invites: { id: string; email: string; createdAt: string; expiresAt: string; expired: boolean }[]
}

export interface Branding {
  name: string | null
  logoUrl: string | null
  color: string | null
}

export interface ProjectStats {
  urls: number
  indexed: number
  crawled: number
  discovered: number
  notIndexed: number
  unknown: number
  indexable: number
  issues: number
  backlinks: number
  refDomains: number
  gained30d: number
  lost30d: number
  dofollow: number
  pendingBacklinks: number
  trackedBacklinks: number
}

export interface Project {
  id: string
  name: string
  domain: string
  gscProperty: string | null
  createdAt: string
  stats?: ProjectStats
  lastScan?: string | null
  indexTrend?: number[]
}

export interface UrlItem {
  id: string
  url: string
  path: string
  title: string | null
  status: IndexStatus
  coverageState: string | null
  http: number | null
  indexable: boolean | null
  robots: 'allowed' | 'blocked' | 'noindex' | null
  canonical: 'self' | 'other' | 'missing' | null
  canonicalUrl: string | null
  googleCanonical: string | null
  inSitemap: boolean
  wordCount: number | null
  loadMs: number | null
  lastCrawl: string | null
  lastChecked: string | null
  indexCheckedAt: string | null
  source: string
}

export interface UrlEvent {
  at: string
  kind: string
  detail: string
}

export interface UrlDetailResponse {
  url: UrlItem
  events: UrlEvent[]
  backlinks: { id: string; sourceUrl: string; sourceDomain: string; anchor: string | null; rel: LinkRel | null; authority: number | null; status: BacklinkStatus; firstSeen: string | null }[]
}

export interface Backlink {
  id: string
  sourceUrl: string
  sourceDomain: string
  target: string | null
  expectedTarget: string | null
  anchor: string | null
  type: LinkRel | null
  status: BacklinkStatus
  isNew: boolean
  origin: 'manual' | 'import' | 'discovery'
  authority: number | null
  pageNoindex: boolean
  http: number | null
  lastError: string | null
  firstSeen: string | null
  lastSeen: string | null
  lastChecked: string | null
  nextCheck: string | null
}

export interface BacklinkProfile {
  anchors: { branded: number; url: number; generic: number; other: number; empty: number }
  authority: { bucket: string; count: number }[]
  unknownAuthority: number
  total: number
}

export interface HistoryPoint {
  date: string
  urls: number
  indexed: number
  crawled: number
  discovered: number
  not_indexed: number
  indexable: number
  backlinks: number
  ref_domains: number
  gained: number
  lost: number
  issues: number
}

export interface Alert {
  id: string
  kind: 'index' | 'backlink' | 'technical' | 'sitemap' | 'competitor' | 'robots'
  severity: 'critical' | 'warning' | 'info' | 'success'
  title: string
  description: string
  href: string | null
  time: string
  read: boolean
  project: string | null
}

export interface NotificationSettings {
  email: number
  slackWebhook: string | null
  webhookUrl: string | null
  digest: number
  minSeverity: 'info' | 'warning' | 'critical'
  monthlyReport?: number
}

export interface Sitemap {
  id: string
  url: string
  status: 'pending' | 'ok' | 'error'
  url_count: number
  last_error: string | null
  last_fetched_at: string | null
}

export interface Paged<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

export interface AddResult {
  created: string[]
  skipped: { sourceUrl?: string; url?: string; reason: string }[]
}

export type AuditCategoryKey = 'technical' | 'content' | 'performance' | 'indexing' | 'links'

export interface AuditCheck {
  id: string
  title: string
  category: AuditCategoryKey
  severity: 'error' | 'warning' | 'notice'
  affected: number
  samples: { id: string; url: string }[]
  description: string
  fix: string
}

export interface AuditResult {
  score: number | null
  urlsChecked: number
  linksChecked: number
  categories: { key: AuditCategoryKey; name: string; description: string; score: number; passed: number; warnings: number; errors: number }[]
  checks: AuditCheck[]
}

export interface KeywordRow {
  query: string
  page: string | null
  clicks: number
  impressions: number
  ctr: number
  position: number
  prevPosition: number | null
  prevClicks: number | null
}

export interface KeywordsResponse {
  connected: boolean
  rows: KeywordRow[]
  range: { start: string; end: string } | null
}

export interface Opportunity {
  id: string
  kind: 'reclaim' | 'redirect' | 'competitor-gap' | 'unlinked-mention' | 'broken-link' | 'resource-page'
  domain: string
  authority: number | null
  headline: string
  reason: string
  sourceUrl: string | null
  targetUrl: string | null
  competitors: string[]
  priority: number
}

export interface OpportunitiesResponse {
  opportunities: Opportunity[]
  gapStatus: 'ok' | 'no_provider' | 'no_competitors' | 'error'
  competitors: string[]
}

export interface Competitor {
  id: string
  domain: string
  createdAt: string
}

/** Client report payload: GET /api/projects/:id/report and the public GET /api/reports/:token. */
export interface Report {
  project: { name: string; domain: string }
  period: { start: string; end: string }
  gsc: boolean
  stats: ProjectStats
  history: { date: string; indexed: number; indexable: number; backlinks: number; ref_domains: number }[]
  audit: { score: number | null; issues: { id: string; title: string; severity: 'error' | 'warning' | 'notice'; affected: number; fix: string }[] }
  queries: { query: string; position: number; clicks: number; impressions: number }[]
  branding: Branding | null
  generatedAt: string
}
