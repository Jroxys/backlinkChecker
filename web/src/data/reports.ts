import type { Report } from '@/types'

export const reportTemplates = [
  { type: 'weekly' as const, name: 'Weekly SEO Report', description: 'Index coverage, backlink movement and new issues from the last 7 days.', pages: 6 },
  { type: 'monthly' as const, name: 'Monthly SEO Report', description: 'Executive summary with trends, wins, risks and next actions. Client-ready.', pages: 14 },
  { type: 'indexing' as const, name: 'Indexing Report', description: 'Coverage by status, newly indexed and dropped URLs, sitemap health.', pages: 8 },
  { type: 'backlink' as const, name: 'Backlink Report', description: 'New and lost links, authority distribution and anchor profile.', pages: 9 },
  { type: 'technical' as const, name: 'Technical SEO Report', description: 'Full audit with prioritised fixes, Core Web Vitals and crawl stats.', pages: 18 },
]

export const reports: Report[] = [
  { id: 'r1', name: 'Monthly SEO Report — September 2026', type: 'monthly', project: 'fernandpine.co', period: 'Sep 1 – Sep 30, 2026', created: '2026-10-01T07:00:00Z', status: 'ready', pages: 14, recipients: 3 },
  { id: 'r2', name: 'Weekly SEO Report — W39', type: 'weekly', project: 'northwindlabs.com', period: 'Sep 22 – Sep 28, 2026', created: '2026-09-29T03:00:00Z', status: 'ready', pages: 6, recipients: 2 },
  { id: 'r3', name: 'Technical SEO Report', type: 'technical', project: 'kestrel-analytics.com', period: 'Crawl of Oct 2, 2026', created: '2026-10-02T09:05:00Z', status: 'generating', pages: 18, recipients: 1 },
  { id: 'r4', name: 'Backlink Report — Q3 2026', type: 'backlink', project: 'northwindlabs.com', period: 'Jul 1 – Sep 30, 2026', created: '2026-09-30T18:20:00Z', status: 'ready', pages: 9, recipients: 4 },
  { id: 'r5', name: 'Indexing Report', type: 'indexing', project: 'docs.lumencraft.io', period: 'Sep 1 – Sep 30, 2026', created: '2026-09-30T08:40:00Z', status: 'ready', pages: 8, recipients: 1 },
  { id: 'r6', name: 'Weekly SEO Report — W40', type: 'weekly', project: 'northwindlabs.com', period: 'Sep 29 – Oct 5, 2026', created: '2026-10-06T03:00:00Z', status: 'scheduled', pages: 6, recipients: 2 },
  { id: 'r7', name: 'Monthly SEO Report — August 2026', type: 'monthly', project: 'harborhome.de', period: 'Aug 1 – Aug 31, 2026', created: '2026-09-01T07:00:00Z', status: 'ready', pages: 13, recipients: 2 },
]
