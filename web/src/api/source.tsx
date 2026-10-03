import { createContext, useContext, type ReactNode } from 'react'
import type {
  ApiKey,
  Team,
  Branding,
  AddResult,
  Alert,
  AuditResult,
  KeywordsResponse,
  OpportunitiesResponse,
  Competitor,
  Backlink,
  BacklinkProfile,
  HistoryPoint,
  IndexStatus,
  Me,
  NotificationSettings,
  Plan,
  Project,
  Sitemap,
  UrlDetailResponse,
  UrlItem,
} from './types'

export interface UrlQuery {
  page: number
  pageSize: number
  q?: string
  status?: IndexStatus[]
  sort?: string
  dir?: 'asc' | 'desc'
}

export interface BacklinkQuery {
  page: number
  pageSize: number
  q?: string
  filter?: string[]
  sort?: string
  dir?: 'asc' | 'desc'
}

export interface UrlPage {
  urls: UrlItem[]
  total: number
  page: number
  pageSize: number
  counts: Partial<Record<IndexStatus, number>>
}

export interface BacklinkPage {
  backlinks: Backlink[]
  total: number
  page: number
  pageSize: number
}

/**
 * Everything the app reads or writes. Two implementations:
 * live (the Indexora API) and demo (seeded mock data, used by /demo).
 * Pages never know which one they talk to.
 */
export interface DataSource {
  mode: 'live' | 'demo'
  /** Path prefix for in-app links: "/app" or "/demo" */
  base: string
  me(): Promise<Me>
  plans(): Promise<{ plans: Plan[]; founding: { total: number; left: number } }>
  projects(): Promise<Project[]>
  project(id: string): Promise<Project>
  history(projectId: string, days: number): Promise<HistoryPoint[]>
  sitemaps(projectId: string): Promise<{ sitemaps: Sitemap[]; coverage: { total: number; indexed: number } | null }>
  urls(projectId: string, q: UrlQuery): Promise<UrlPage>
  url(id: string): Promise<UrlDetailResponse>
  backlinks(projectId: string, q: BacklinkQuery): Promise<BacklinkPage>
  backlinkProfile(projectId: string): Promise<BacklinkProfile>
  alerts(opts?: { unread?: boolean }): Promise<{ alerts: Alert[]; unread: number }>
  notificationSettings(): Promise<NotificationSettings>
  audit(projectId: string): Promise<AuditResult>
  keywords(projectId: string, refresh?: boolean): Promise<KeywordsResponse>
  opportunities(projectId: string): Promise<OpportunitiesResponse>
  competitors(projectId: string): Promise<{ competitors: Competitor[]; providerConfigured: boolean }>
  addCompetitor(projectId: string, domain: string): Promise<void>
  deleteCompetitor(projectId: string, id: string): Promise<void>

  createProject(input: { domain: string; name?: string }): Promise<Project>
  updateProject(id: string, input: { name?: string; gscProperty?: string | null }): Promise<Project>
  deleteProject(id: string): Promise<void>
  scanProject(id: string): Promise<{ queued: { urls: number; backlinks: number } }>
  addUrls(projectId: string, urls: string[]): Promise<AddResult>
  recheckUrl(id: string): Promise<{ changes: { kind: string; detail: string }[] }>
  addSitemap(projectId: string, url: string): Promise<void>
  addBacklinks(projectId: string, links: { sourceUrl: string; targetUrl?: string }[]): Promise<AddResult>
  importBacklinks(projectId: string, text: string): Promise<AddResult & { format: string; domainOnly: number }>
  recheckBacklink(id: string): Promise<{ backlink: Backlink; events: string[] }>
  deleteBacklink(id: string): Promise<void>
  markAlertRead(id: string): Promise<void>
  markAllAlertsRead(): Promise<void>
  saveNotificationSettings(s: Partial<{ email: boolean; slackWebhook: string | null; webhookUrl: string | null; digest: boolean; minSeverity: string }>): Promise<void>
  googleSites(): Promise<{ siteUrl: string; permissionLevel: string }[]>
  disconnectGoogle(): Promise<void>
  checkout(plan: 'starter' | 'pro' | 'agency', cycle: 'monthly' | 'yearly'): Promise<{ url: string; founding: boolean }>
  logout(): Promise<void>
  deleteAccount(password: string): Promise<void>
  saveBranding(b: Branding): Promise<void>
  team(): Promise<Team>
  inviteMember(email: string): Promise<void>
  revokeInvite(id: string): Promise<void>
  removeMember(id: string): Promise<void>
  leaveTeam(): Promise<void>
  apiKeys(): Promise<ApiKey[]>
  createApiKey(name: string): Promise<{ key: ApiKey; token: string }>
  deleteApiKey(id: string): Promise<void>
}

const Ctx = createContext<DataSource | null>(null)

export function DataSourceProvider({ source, children }: { source: DataSource; children: ReactNode }) {
  return <Ctx.Provider value={source}>{children}</Ctx.Provider>
}

export function useSource() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSource must be used inside DataSourceProvider')
  return s
}

/** Prefix an in-app path ("/indexing") with the current base ("/app" or "/demo"). */
export function useHref() {
  const { base } = useSource()
  return (path = '') => (path.startsWith('/app') ? base + path.slice(4) : base + path)
}
