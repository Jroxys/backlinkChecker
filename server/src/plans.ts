/**
 * Plan catalogue. Limits are enforced by the API; prices are shown on the
 * landing page. Reasoning behind these numbers lives in docs/PRICING.md.
 */
export type PlanId = 'free' | 'starter' | 'pro' | 'agency'

export interface Plan {
  id: PlanId
  name: string
  /** USD per month, billed monthly */
  monthly: number
  /** USD per year (two months free) */
  yearly: number
  /** Locked-in monthly price for the first 100 paying customers */
  founding: number
  limits: {
    projects: number
    urls: number
    backlinks: number
    competitorsPerProject: number
    seats: number
    /** How often each backlink is re-verified */
    backlinkCheckHours: number
    /** How often each URL's indexability is re-checked */
    urlCheckHours: number
    /** Automatic discovery of unknown backlinks via the data provider */
    discovery: false | 'weekly' | 'daily'
    /** Near real-time watch: priority pages, uptime and robots.txt are checked this often */
    watchMinutes: number
    /** How many pages per project get the fast watch interval */
    priorityPages: number
  }
  features: {
    slack: boolean
    webhooks: boolean
    reports: boolean
    whiteLabel: boolean
    api: boolean
  }
}

export const plans: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    monthly: 0,
    yearly: 0,
    founding: 0,
    limits: { projects: 1, urls: 100, backlinks: 100, competitorsPerProject: 0, seats: 1, backlinkCheckHours: 168, urlCheckHours: 24, discovery: false, watchMinutes: 60, priorityPages: 1 },
    features: { slack: false, webhooks: false, reports: false, whiteLabel: false, api: false },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    monthly: 12,
    yearly: 120,
    founding: 9,
    limits: { projects: 3, urls: 1_000, backlinks: 1_000, competitorsPerProject: 1, seats: 1, backlinkCheckHours: 24, urlCheckHours: 24, discovery: false, watchMinutes: 15, priorityPages: 5 },
    features: { slack: true, webhooks: false, reports: true, whiteLabel: false, api: false },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthly: 29,
    yearly: 290,
    founding: 19,
    limits: { projects: 10, urls: 10_000, backlinks: 10_000, competitorsPerProject: 3, seats: 3, backlinkCheckHours: 24, urlCheckHours: 12, discovery: 'weekly', watchMinutes: 5, priorityPages: 20 },
    features: { slack: true, webhooks: true, reports: true, whiteLabel: false, api: true },
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    monthly: 79,
    yearly: 790,
    founding: 49,
    limits: { projects: 50, urls: 50_000, backlinks: 50_000, competitorsPerProject: 5, seats: 10, backlinkCheckHours: 24, urlCheckHours: 6, discovery: 'weekly', watchMinutes: 5, priorityPages: 50 },
    features: { slack: true, webhooks: true, reports: true, whiteLabel: true, api: true },
  },
}

export const getPlan = (id: string | null | undefined): Plan => plans[(id as PlanId) ?? 'free'] ?? plans.free
