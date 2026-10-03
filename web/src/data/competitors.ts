import type { Competitor } from '@/types'

export const competitors: Competitor[] = [
  { domain: 'northwindlabs.com', label: 'Your website', you: true, authority: 64, refDomains: 642, backlinks: 8421, indexed: 1284, issues: 23, newBacklinks: 214, lostBacklinks: 61, keywords: 4810 },
  { domain: 'crawlwise.io', label: 'Competitor A', authority: 71, refDomains: 918, backlinks: 14260, indexed: 2140, issues: 48, newBacklinks: 302, lostBacklinks: 117, keywords: 7260 },
  { domain: 'rankpilot.com', label: 'Competitor B', authority: 58, refDomains: 503, backlinks: 6912, indexed: 1608, issues: 71, newBacklinks: 156, lostBacklinks: 88, keywords: 3940 },
  { domain: 'serpstack.dev', label: 'Competitor C', authority: 52, refDomains: 377, backlinks: 4105, indexed: 864, issues: 36, newBacklinks: 97, lostBacklinks: 42, keywords: 2210 },
]

/** Referring domain overlap: who links to whom. */
export const linkGap = {
  shared: 188,
  onlyYou: 271,
  onlyCompetitors: 1204,
  gapByAuthority: [
    { bucket: '80–100', you: 96, a: 142, b: 71, c: 48 },
    { bucket: '60–79', you: 171, a: 228, b: 129, c: 92 },
    { bucket: '40–59', you: 196, a: 274, b: 151, c: 117 },
    { bucket: '20–39', you: 118, a: 182, b: 104, c: 79 },
    { bucket: '0–19', you: 61, a: 92, b: 48, c: 41 },
  ],
  topGapDomains: [
    { domain: 'smashingmagazine.com', authority: 92, linksTo: ['A', 'B', 'C'] },
    { domain: 'searchenginejournal.com', authority: 90, linksTo: ['A', 'B'] },
    { domain: 'digitalocean.com', authority: 91, linksTo: ['A', 'C'] },
    { domain: 'netlify.com', authority: 88, linksTo: ['A'] },
    { domain: 'zapier.com', authority: 91, linksTo: ['B'] },
    { domain: 'frontendmasters.com', authority: 76, linksTo: ['C'] },
  ],
}

export const refDomainTrend = [
  { month: 'Nov', you: 498, a: 802, b: 471, c: 318 },
  { month: 'Dec', you: 511, a: 815, b: 476, c: 322 },
  { month: 'Jan', you: 523, a: 829, b: 480, c: 330 },
  { month: 'Feb', you: 534, a: 838, b: 482, c: 336 },
  { month: 'Mar', you: 548, a: 851, b: 487, c: 341 },
  { month: 'Apr', you: 559, a: 860, b: 489, c: 348 },
  { month: 'May', you: 571, a: 868, b: 493, c: 352 },
  { month: 'Jun', you: 583, a: 879, b: 496, c: 357 },
  { month: 'Jul', you: 597, a: 888, b: 498, c: 362 },
  { month: 'Aug', you: 612, a: 897, b: 500, c: 368 },
  { month: 'Sep', you: 628, a: 909, b: 502, c: 373 },
  { month: 'Oct', you: 642, a: 918, b: 503, c: 377 },
]
