/**
 * Head tags for public pages, injected into index.html by the server so crawlers and
 * link previews see real titles/descriptions without a full SSR setup.
 */
export interface PageMeta {
  title: string
  description: string
  index: boolean
}

const pages: Record<string, PageMeta> = {
  '/': {
    title: 'Indexora — Know exactly what Google sees',
    description: 'Monitor Google index status, indexability and every backlink from one place. Lost links and de-indexed pages alert you within a day. Free plan available.',
    index: true,
  },
  '/tools': { title: 'Free SEO tools — Indexora', description: 'Free backlink, indexability, redirect and SSL checkers. No signup — real live checks by the Indexora crawler.', index: true },
  '/tools/backlink-checker': {
    title: 'Free Backlink Checker — Does this page link to me? | Indexora',
    description: 'Check if a page links to your site, see the anchor text and whether the link is dofollow, nofollow, UGC or sponsored. Free, no signup.',
    index: true,
  },
  '/tools/indexability-checker': {
    title: 'Free Indexability Checker — Can Google index this URL? | Indexora',
    description: 'Check a URL the way Googlebot sees it: status code, redirects, robots.txt, noindex and canonical, with a plain-English verdict. Free, no signup.',
    index: true,
  },
  '/tools/redirect-checker': {
    title: 'Free Redirect Checker — Follow every redirect hop | Indexora',
    description: 'See every redirect hop and status code, find temporary redirects and chains, and check that http/https and www/non-www land on one URL. Free, no signup.',
    index: true,
  },
  '/tools/ssl-checker': {
    title: 'Free SSL Certificate Checker — Expiry date & errors | Indexora',
    description: 'Check when your SSL certificate expires, who issued it and whether browsers trust it, with a plain-English explanation of any error. Free, no signup.',
    index: true,
  },
  '/blog': { title: 'Blog — practical guides to indexing and backlinks | Indexora', description: 'Practical, no-fluff guides to getting pages indexed, keeping backlinks alive and fixing technical SEO problems.', index: true },
  '/demo': { title: 'Live demo — Indexora', description: 'Explore Indexora with sample data: index coverage, backlink monitoring, audits and alerts.', index: true },
  '/privacy': { title: 'Privacy Policy — Indexora', description: 'How Indexora collects, uses and protects your data.', index: true },
  '/terms': { title: 'Terms of Service — Indexora', description: 'The terms for using Indexora.', index: true },
  '/signup': { title: 'Create your free account — Indexora', description: 'Start monitoring your site for free.', index: false },
  '/login': { title: 'Sign in — Indexora', description: 'Sign in to Indexora.', index: false },
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function metaFor(path: string): PageMeta {
  const clean = path.replace(/\/+$/, '') || '/'
  if (pages[clean]) return pages[clean]
  if (clean.startsWith('/demo/')) return { ...pages['/demo'], index: false }
  if (clean.startsWith('/r/')) return { title: 'SEO report', description: 'A read-only SEO report.', index: false }
  return { title: 'Indexora', description: pages['/'].description, index: false }
}

/** Per-request extras for content pages: their own meta, structured data and pre-rendered body. */
export interface PageExtra {
  meta: PageMeta
  ogType?: 'article'
  jsonLd?: object
  /** HTML placed inside #root so crawlers and no-JS readers get the content; React replaces it on load. */
  body?: string
}

export function injectHead(html: string, path: string, appUrl: string, extra?: PageExtra) {
  const m = extra?.meta ?? metaFor(path)
  const url = appUrl.replace(/\/$/, '') + (path.replace(/\/+$/, '') || '/')
  const tags = [
    `<meta name="description" content="${esc(m.description)}" />`,
    m.index ? `<link rel="canonical" href="${esc(url)}" />` : `<meta name="robots" content="noindex, nofollow" />`,
    `<meta property="og:type" content="${extra?.ogType ?? 'website'}" />`,
    ...(path.startsWith('/r/') ? [] : [`<meta property="og:site_name" content="Indexora" />`]),
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    ...(extra?.jsonLd ? [`<script type="application/ld+json">${JSON.stringify(extra.jsonLd).replace(/</g, '\\u003c')}</script>`] : []),
  ].join('\n    ')
  const withBody = extra?.body ? html.replace('<div id="root"></div>', `<div id="root">${extra.body}</div>`) : html
  return withBody
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace(/<meta name="description"[^>]*>\s*/, '')
    .replace('</head>', `    ${tags}\n  </head>`)
}

export function robotsTxt(appUrl: string) {
  return `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api/\nDisallow: /demo/\nDisallow: /r/\n\nSitemap: ${appUrl.replace(/\/$/, '')}/sitemap.xml\n`
}

export function sitemapXml(appUrl: string, extra: { path: string; lastmod: string }[] = []) {
  const base = appUrl.replace(/\/$/, '')
  const urls = [
    ...Object.entries(pages)
      .filter(([, m]) => m.index)
      .map(([p]) => `  <url><loc>${base}${p === '/' ? '/' : p}</loc></url>`),
    ...extra.map((e) => `  <url><loc>${base}${esc(e.path)}</loc><lastmod>${e.lastmod}</lastmod></url>`),
  ].join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
