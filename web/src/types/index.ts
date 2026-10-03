export type IndexStatus = 'indexed' | 'crawled' | 'discovered' | 'blocked' | 'error'
export type ProjectStatus = 'healthy' | 'warning' | 'critical' | 'scanning'
export type LinkType = 'dofollow' | 'nofollow' | 'ugc' | 'sponsored'
export type LinkStatus = 'active' | 'new' | 'lost'
export type Severity = 'critical' | 'warning' | 'info' | 'success'

export interface Project {
  id: string
  name: string
  domain: string
  status: ProjectStatus
  indexedUrls: number
  totalUrls: number
  backlinks: number
  refDomains: number
  seoScore: number
  lastScan: string
  indexTrend: number[]
  sitemaps: number
  issues: number
}

export interface UrlRecord {
  id: string
  path: string
  domain: string
  title: string
  status: IndexStatus
  http: number
  indexable: boolean
  canonical: 'self' | 'other' | 'missing'
  canonicalTarget?: string
  robots: 'allowed' | 'blocked' | 'noindex'
  inSitemap: boolean
  lastCrawl: string | null
  lastChecked: string
  internalLinks: number
  externalLinks: number
  backlinks: number
  wordCount: number
  loadTime: number
  depth: number
  clicks: number
  impressions: number
}

export interface Backlink {
  id: string
  sourceDomain: string
  sourceUrl: string
  target: string
  anchor: string
  authority: number
  type: LinkType
  status: LinkStatus
  firstSeen: string
  lastSeen: string
}

export interface Opportunity {
  id: string
  domain: string
  authority: number
  kind: 'competitor-gap' | 'unlinked-mention' | 'broken-link' | 'resource-page'
  headline: string
  reason: string
  competitors: string[]
  traffic: number
  relevance: number
  difficulty: 'Easy' | 'Moderate' | 'Hard'
  category: string
  suggestedTarget: string
}

export interface AuditCheck {
  id: string
  title: string
  severity: 'error' | 'warning' | 'passed'
  affected: number
  category: AuditCategoryKey
  description: string
  fix: string
}

export type AuditCategoryKey = 'technical' | 'content' | 'performance' | 'indexing' | 'links' | 'structured'

export interface AuditCategory {
  key: AuditCategoryKey
  name: string
  score: number
  passed: number
  warnings: number
  errors: number
  description: string
}

export interface Automation {
  id: string
  name: string
  kind: 'index' | 'backlink' | 'audit' | 'competitor' | 'report' | 'sitemap'
  description: string
  frequency: string
  channels: ('Email' | 'Slack' | 'Webhook')[]
  active: boolean
  lastRun: string
  nextRun: string
  project: string
  lastResult: string
  successRate: number
}

export interface Alert {
  id: string
  kind: 'index' | 'backlink' | 'technical' | 'sitemap' | 'competitor' | 'robots'
  severity: Severity
  title: string
  description: string
  project: string
  time: string
  read: boolean
  action: string
  href: string
}

export interface Competitor {
  domain: string
  label: string
  you?: boolean
  authority: number
  refDomains: number
  backlinks: number
  indexed: number
  issues: number
  newBacklinks: number
  lostBacklinks: number
  keywords: number
}

export interface Report {
  id: string
  name: string
  type: 'weekly' | 'monthly' | 'indexing' | 'backlink' | 'technical'
  project: string
  period: string
  created: string
  status: 'ready' | 'generating' | 'scheduled'
  pages: number
  recipients: number
}

export interface Keyword {
  id: string
  keyword: string
  position: number
  change: number
  volume: number
  difficulty: number
  url: string
  intent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational'
  trend: number[]
}
