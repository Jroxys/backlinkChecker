import type { Backlink, LinkStatus, LinkType } from '@/types'
import { between, pick, rng } from '@/lib/random'

const sources: [string, number, string][] = [
  ['searchengineland.com', 91, '/guides/technical-seo-resources'],
  ['moz.com', 93, '/blog/indexing-tools-roundup'],
  ['smashingmagazine.com', 92, '/2026/08/javascript-seo-rendering'],
  ['css-tricks.com', 89, '/links/seo-for-developers'],
  ['dev.to', 88, '/mkhan/how-we-fixed-crawl-budget-4k2p'],
  ['searchenginejournal.com', 90, '/technical-seo-tools/512844'],
  ['backlinko.com', 82, '/seo-tools'],
  ['ahrefs.com', 92, '/blog/canonical-tags-study'],
  ['news.ycombinator.com', 91, '/item?id=41822307'],
  ['reddit.com', 97, '/r/TechSEO/comments/1fq2x9a'],
  ['indiehackers.com', 79, '/post/seo-tools-stack-2026'],
  ['producthunt.com', 90, '/products/northwind-seo-toolkit'],
  ['medium.com', 95, '/@lena.v/indexing-in-2026-8f1c2e'],
  ['seroundtable.com', 78, '/google-indexing-delays-38214.html'],
  ['webdesignerdepot.com', 74, '/2026/09/seo-checklist-for-launch'],
  ['sitepoint.com', 86, '/technical-seo-audit-guide'],
  ['marketingland.io', 61, '/tools/backlink-monitoring'],
  ['growthhackers.com', 71, '/articles/compounding-backlinks'],
  ['seobythesea.com', 63, '/2026/07/canonicalization-patents'],
  ['ghostblog.dev', 47, '/seo-for-headless-cms'],
  ['contentmarketinginstitute.com', 80, '/2026/06/seo-reporting'],
  ['stackoverflow.com', 94, '/questions/78120345/sitemap-index-limits'],
  ['wpbeginner.com', 87, '/beginners-guide/wordpress-seo'],
  ['hubspot.com', 93, '/marketing/technical-seo-tools'],
  ['zapier.com', 91, '/blog/best-seo-tools'],
  ['g2.com', 91, '/products/northwind-labs/reviews'],
  ['capterra.com', 90, '/p/240891/Northwind'],
  ['seo-forum.net', 22, '/thread/48122'],
  ['linkfarm-directory.biz', 8, '/seo/page/42'],
  ['bestseotools2026.xyz', 12, '/top-10'],
  ['techradar.com', 92, '/best/best-seo-tools'],
  ['builtwith.blog', 38, '/indexing-apis-compared'],
  ['web.dev', 92, '/case-studies/northwind'],
  ['nngroup.com', 85, '/articles/search-ux'],
  ['a11yproject.com', 66, '/resources/'],
  ['vercel.com', 89, '/templates/seo-starter'],
  ['netlify.com', 88, '/blog/jamstack-seo'],
  ['frontendmasters.com', 76, '/blog/seo-for-spas'],
  ['digitalocean.com', 91, '/community/tutorials/seo-nginx'],
  ['semrush.com', 92, '/blog/backlink-audit'],
]

const targets = [
  '/blog/technical-seo-guide',
  '/blog/google-indexing-guide',
  '/products/seo-tool',
  '/docs/api',
  '/blog/backlink-strategy',
  '/',
  '/blog/how-to-do-seo',
  '/blog/canonical-tags',
  '/features/backlink-monitor',
  '/blog/javascript-seo',
]

const anchors = [
  'Northwind Labs',
  'technical SEO guide',
  'northwindlabs.com',
  'this indexing guide',
  'backlink strategy',
  'API docs',
  'SEO toolkit',
  'read more',
  'Google indexing explained',
  'https://northwindlabs.com/',
  'practical SEO playbook',
  'canonical tag study',
  'their crawl budget write-up',
  'monitor backlinks',
  'Northwind',
]

function date(daysAgo: number) {
  const d = new Date('2026-10-02T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export const backlinks: Backlink[] = (() => {
  const out: Backlink[] = []
  let k = 0
  for (let round = 0; round < 2; round++) {
    sources.forEach(([domain, authority, path], i) => {
      const r = rng(i * 53 + round * 997 + 3)
      if (round === 1 && r() > 0.55) return
      const age = between(r, 2, 420)
      const s = r()
      const status: LinkStatus = age < 14 ? 'new' : s > 0.86 ? 'lost' : 'active'
      const type: LinkType =
        domain.includes('reddit') || domain.includes('ycombinator') || domain.includes('stackoverflow')
          ? 'ugc'
          : domain.includes('capterra') || domain.includes('g2.com')
            ? 'sponsored'
            : r() > 0.78
              ? 'nofollow'
              : 'dofollow'
      out.push({
        id: `bl${++k}`,
        sourceDomain: domain,
        sourceUrl: `https://${domain}${round ? path.replace(/\/?$/, '/2') : path}`,
        target: pick(r, targets),
        anchor: pick(r, anchors),
        authority: Math.max(1, authority - round * between(r, 0, 4)),
        type,
        status,
        firstSeen: date(age),
        lastSeen: status === 'lost' ? date(between(r, 1, Math.min(age - 1, 30))) : date(between(r, 0, 2)),
      })
    })
  }
  return out.sort((a, b) => b.firstSeen.localeCompare(a.firstSeen))
})()

export const anchorDistribution = [
  { name: 'Branded', value: 41 },
  { name: 'Exact / partial', value: 23 },
  { name: 'Naked URL', value: 18 },
  { name: 'Generic', value: 11 },
  { name: 'Other', value: 7 },
]

export const authorityBuckets = [
  { bucket: '0–19', count: 61 },
  { bucket: '20–39', count: 118 },
  { bucket: '40–59', count: 196 },
  { bucket: '60–79', count: 171 },
  { bucket: '80–100', count: 96 },
]
