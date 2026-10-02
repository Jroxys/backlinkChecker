import type { Keyword } from '@/types'
import { rng } from '@/lib/random'

const raw: [string, number, number, number, number, string, Keyword['intent']][] = [
  ['technical seo guide', 3, 2, 8100, 62, '/blog/technical-seo-guide', 'Informational'],
  ['how does google indexing work', 2, 1, 2900, 48, '/blog/google-indexing-guide', 'Informational'],
  ['backlink monitoring tool', 7, 4, 1900, 71, '/features/backlink-monitor', 'Commercial'],
  ['crawl budget', 5, -1, 4400, 55, '/blog/crawl-budget-explained', 'Informational'],
  ['canonical tag', 9, 3, 12100, 67, '/blog/canonical-tags', 'Informational'],
  ['seo audit tool', 14, -3, 6600, 78, '/features/site-audit', 'Commercial'],
  ['how to do seo', 6, 5, 22200, 74, '/blog/how-to-do-seo', 'Informational'],
  ['javascript seo', 4, 0, 2400, 58, '/blog/javascript-seo', 'Informational'],
  ['northwind labs', 1, 0, 880, 12, '/', 'Navigational'],
  ['rank tracking software', 18, -6, 3600, 81, '/features/rank-tracking', 'Transactional'],
  ['xml sitemap best practices', 3, 2, 1300, 41, '/blog/sitemap-best-practices', 'Informational'],
  ['robots.txt disallow', 11, 1, 5400, 52, '/blog/robots-txt-guide', 'Informational'],
  ['northwind vs ahrefs', 2, 0, 320, 29, '/compare/northwind-vs-ahrefs', 'Commercial'],
  ['structured data seo', 16, 7, 2900, 60, '/blog/structured-data-guide', 'Informational'],
  ['seo api', 8, -2, 1000, 49, '/docs/api', 'Commercial'],
]

export const keywords: Keyword[] = raw.map(([keyword, position, change, volume, difficulty, url, intent], i) => {
  const r = rng(i + 31)
  const trend = Array.from({ length: 12 }, (_, k) => Math.max(1, Math.round(position + change * (1 - k / 11) + (r() - 0.5) * 3)))
  trend[trend.length - 1] = position
  return { id: `k${i}`, keyword, position, change, volume, difficulty, url, intent, trend }
})
