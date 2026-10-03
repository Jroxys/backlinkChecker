import type { Ctx } from '../context.js'
import { rootDomain, urlKey } from '../lib/url.js'
import { PLATFORMS, queueProbe } from './linkgraph.js'

export interface Opportunity {
  id: string
  kind: 'reclaim' | 'redirect' | 'competitor-gap' | 'broken-link'
  domain: string
  authority: number | null
  headline: string
  reason: string
  sourceUrl: string | null
  targetUrl: string | null
  competitors: string[]
  priority: number
  /** 'page' = we saw the exact linking page; 'domain' = domain-level link (Common Crawl graph) */
  evidence: 'page' | 'domain' | null
  status: OutreachStatus
}

export type OutreachStatus = 'todo' | 'contacted' | 'won' | 'rejected'

/**
 * Opportunities built from data we already own (no paid provider needed):
 *  - reclaim:  dofollow links that disappeared — ask the site owner to restore them
 *  - redirect: backlinks pointing at URLs on your site that now 404 — a 301 recovers the equity
 * plus competitor gaps when a backlink provider is configured.
 */
export async function opportunitiesFor(ctx: Ctx, projectId: string) {
  const p = ctx.db.get<{ domain: string }>('SELECT domain FROM projects WHERE id = ?', [projectId])
  if (!p) throw new Error('Project not found')
  const out: Opportunity[] = []

  const lost = ctx.db.all<{ id: string; source_url: string; source_domain: string; found_target: string | null; target_url: string; authority: number | null; anchor: string | null; last_seen: string | null; status: string; http_status: number | null }>(
    `SELECT id, source_url, source_domain, found_target, target_url, authority, anchor, last_seen, status, http_status
       FROM backlinks WHERE project_id = ? AND status IN ('lost','broken') AND (rel = 'dofollow' OR rel IS NULL) AND last_seen IS NOT NULL
       ORDER BY authority DESC NULLS LAST, last_seen DESC LIMIT 50`,
    [projectId],
  )
  for (const b of lost) {
    const pageGone = b.status === 'broken'
    out.push({
      id: `reclaim:${b.id}`,
      kind: 'reclaim',
      domain: b.source_domain,
      authority: b.authority,
      headline: pageGone ? `The page that linked to you is down (${b.http_status ?? 'unreachable'})` : `Your link${b.anchor ? ` “${b.anchor}”` : ''} was removed`,
      reason: pageGone
        ? 'The linking page stopped responding. If it moved, the new URL may have dropped your link — find it and ask for it back.'
        : `It was last seen ${b.last_seen?.slice(0, 10)}. Links removed during a page update are often restored after a short, friendly email.`,
      sourceUrl: b.source_url,
      targetUrl: b.found_target ?? (b.target_url || null),
      competitors: [],
      priority: (b.authority ?? 30) + (pageGone ? 0 : 15),
      evidence: 'page',
      status: 'todo',
    })
  }

  // Backlinks whose target on *your* site is a monitored URL returning 4xx
  const broken = ctx.db.all<{ url: string; http_status: number }>('SELECT url, http_status FROM monitored_urls WHERE project_id = ? AND http_status >= 400 AND http_status < 500', [projectId])
  if (broken.length) {
    const brokenKeys = new Map(broken.map((u) => [urlKey(u.url), u]))
    const links = ctx.db.all<{ id: string; source_url: string; source_domain: string; found_target: string | null; target_url: string; authority: number | null }>(
      "SELECT id, source_url, source_domain, found_target, target_url, authority FROM backlinks WHERE project_id = ? AND status = 'active'",
      [projectId],
    )
    for (const l of links) {
      const t = l.found_target ?? l.target_url
      if (!t) continue
      let k: string
      try {
        k = urlKey(t)
      } catch {
        continue
      }
      const hit = brokenKeys.get(k)
      if (!hit) continue
      out.push({
        id: `redirect:${l.id}`,
        kind: 'redirect',
        domain: l.source_domain,
        authority: l.authority,
        headline: `A live backlink points to a ${hit.http_status} page on your site`,
        reason: `${l.source_domain} links to ${new URL(t).pathname}, which returns ${hit.http_status}. A 301 redirect to the closest live page recovers that link equity today — no outreach needed.`,
        sourceUrl: l.source_url,
        targetUrl: t,
        competitors: [],
        priority: (l.authority ?? 30) + 30,
        evidence: 'page',
        status: 'todo',
      })
    }
  }

  const comps = ctx.db.all<{ domain: string }>('SELECT domain FROM competitors WHERE project_id = ?', [projectId]).map((r) => r.domain)
  const fromGraph = comps.length ? graphOpportunities(ctx, p.domain, comps) : []
  out.push(...fromGraph)

  let gapStatus: 'ok' | 'no_data' | 'no_competitors' | 'error' = 'ok'
  if (!comps.length) gapStatus = 'no_competitors'
  else if (ctx.provider) {
    try {
      const have = new Set(fromGraph.map((o) => o.domain))
      const gap = await ctx.provider.gap(p.domain, comps, { limit: 30 })
      for (const g of gap) {
        if (!g.domain || have.has(g.domain)) continue
        out.push({
          id: `gap:${g.domain}`,
          kind: 'competitor-gap',
          domain: g.domain,
          authority: g.authority,
          headline: g.linksTo.length > 1 ? `${g.linksTo.length} of your competitors are linked from this site` : `${g.linksTo[0]} is linked from this site — you aren’t`,
          reason: 'Sites that already link to similar products are the warmest outreach targets. Find the page that links to your competitor and offer your resource as an addition.',
          sourceUrl: `https://${g.domain}`,
          targetUrl: null,
          competitors: g.linksTo,
          priority: (g.authority ?? 30) + g.linksTo.length * 5,
          evidence: 'domain',
          status: 'todo',
        })
      }
    } catch (e) {
      gapStatus = fromGraph.length ? 'ok' : 'error'
      console.error('[opportunities] gap failed', e)
    }
  } else if (!fromGraph.length) gapStatus = 'no_data'

  // Outreach progress the user recorded
  const tracked = ctx.db.all<{ opp_key: string; domain: string; status: OutreachStatus; backlink_id: string | null; updated_at: string }>(
    'SELECT opp_key, domain, status, backlink_id, updated_at FROM outreach WHERE project_id = ?',
    [projectId],
  )
  const statuses = new Map(tracked.map((r) => [r.opp_key, r.status]))
  for (const o of out) o.status = statuses.get(o.id) ?? 'todo'
  // Keep the history: a won gap stops being a gap (the site links to you now) but belongs in "Won"
  const listed = new Set(out.map((o) => o.id))
  for (const r of tracked) {
    if (listed.has(r.opp_key) || r.status === 'todo') continue
    const prefix = r.opp_key.split(':')[0]
    const kind: Opportunity['kind'] = prefix === 'reclaim' ? 'reclaim' : prefix === 'redirect' ? 'redirect' : prefix === 'broken' ? 'broken-link' : 'competitor-gap'
    out.push({
      id: r.opp_key,
      kind,
      domain: r.domain,
      authority: null,
      headline: r.status === 'won' ? `Link won from ${r.domain}` : r.status === 'contacted' ? `Waiting for a reply from ${r.domain}` : `Dismissed: ${r.domain}`,
      reason: r.status === 'won' ? (r.backlink_id ? 'The link is in backlink monitoring: we verify it regularly and alert you if it disappears.' : 'Marked as won.') : `Last updated ${r.updated_at.slice(0, 10)}.`,
      sourceUrl: `https://${r.domain}/`,
      targetUrl: null,
      competitors: [],
      priority: 0,
      evidence: null,
      status: r.status,
    })
  }

  out.sort((a, b) => b.priority - a.priority)
  const cc = ctx.db.get<{ release: string; finished_at: string }>("SELECT release, finished_at FROM cc_imports WHERE error IS NULL AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1")
  const pages = ctx.db.get<{ n: number }>('SELECT COUNT(DISTINCT src_url) AS n FROM page_links')!.n
  return { opportunities: out, gapStatus, competitors: comps, graph: { ccRelease: cc?.release ?? null, ccImportedAt: cc?.finished_at ?? null, pagesCrawled: pages } }
}

/**
 * Opportunities from our own link graph:
 *  - competitor-gap: domains that link to competitors but not to you (page-level when we've seen
 *    the page, domain-level from Common Crawl otherwise — those get queued for a probe to find the page)
 *  - broken-link: a page links to a competitor URL that is now dead; offer yours as the replacement
 */
export function graphOpportunities(ctx: Ctx, projectDomain: string, competitors: string[]): Opportunity[] {
  const me = rootDomain(projectDomain)
  const comps = [...new Set(competitors.map(rootDomain))].filter((c) => c !== me)
  if (!comps.length) return []
  const qs = comps.map(() => '?').join(',')
  const exclude = new Set([me, ...comps])

  // Domains already linking to us: graph + our own verified backlinks
  const mine = new Set(ctx.db.all<{ src_domain: string }>('SELECT DISTINCT src_domain FROM domain_links WHERE dst_domain = ?', [me]).map((r) => r.src_domain))
  for (const r of ctx.db.all<{ source_domain: string }>("SELECT DISTINCT b.source_domain FROM backlinks b JOIN projects p ON p.id = b.project_id WHERE p.domain = ? AND b.status IN ('active','pending')", [projectDomain]))
    mine.add(rootDomain(r.source_domain))

  const rows = ctx.db.all<{ src_domain: string; dsts: string; hosts: number | null }>(
    `SELECT dl.src_domain, GROUP_CONCAT(DISTINCT dl.dst_domain) AS dsts, gd.hosts
       FROM domain_links dl LEFT JOIN graph_domains gd ON gd.domain = dl.src_domain
      WHERE dl.dst_domain IN (${qs})
      GROUP BY dl.src_domain
      ORDER BY COUNT(DISTINCT dl.dst_domain) DESC, gd.hosts DESC
      LIMIT 600`,
    comps,
  )
  const out: Opportunity[] = []
  for (const r of rows) {
    if (exclude.has(r.src_domain) || mine.has(r.src_domain) || PLATFORMS.has(r.src_domain)) continue
    const linksTo = r.dsts.split(',')
    // The exact page, when one of our crawls saw it
    const page = ctx.db.get<{ src_url: string; dst_url: string; anchor: string | null }>(
      `SELECT src_url, dst_url, anchor FROM page_links WHERE src_domain = ? AND dst_domain IN (${qs}) ORDER BY seen_at DESC LIMIT 1`,
      [r.src_domain, ...comps],
    )
    const size = r.hosts ? Math.min(20, Math.round(Math.log10(r.hosts + 1) * 8)) : 0
    out.push({
      id: `gap:${r.src_domain}`,
      kind: 'competitor-gap',
      domain: r.src_domain,
      authority: null,
      headline: linksTo.length > 1 ? `Links to ${linksTo.length} of your competitors — not to you` : `Links to ${linksTo[0]} — not to you`,
      reason: page
        ? `We found the page: it links to ${new URL(page.dst_url).hostname}${page.anchor ? ` with the text “${page.anchor}”` : ''}. Sites that already link to a similar product are the warmest outreach targets — offer your page as an addition.`
        : 'This site links to your competitor somewhere (Common Crawl web graph). Our crawler is looking for the exact page; meanwhile, search the site for your competitor’s name to find it.',
      sourceUrl: page?.src_url ?? `https://${r.src_domain}/`,
      targetUrl: null,
      competitors: linksTo,
      priority: 25 + linksTo.length * 20 + size + (page ? 10 : 0),
      evidence: page ? 'page' : 'domain',
      status: 'todo',
    })
  }
  out.sort((a, b) => b.priority - a.priority)
  // Find the exact pages for the best domain-level gaps (probed politely in the background)
  for (const o of out.filter((x) => x.evidence === 'domain').slice(0, 25)) queueProbe(ctx, o.domain, `gap:${me}`)

  const broken = ctx.db.all<{ src_url: string; src_domain: string; dst_url: string; dst_domain: string; anchor: string | null; status: number }>(
    `SELECT pl.src_url, pl.src_domain, pl.dst_url, pl.dst_domain, pl.anchor, lt.status
       FROM page_links pl JOIN link_targets lt ON lt.url = pl.dst_url
      WHERE pl.dst_domain IN (${qs}) AND lt.status >= 400 AND lt.status < 500 AND pl.src_domain != ?
      LIMIT 100`,
    [...comps, me],
  )
  for (const b of broken) {
    if (PLATFORMS.has(b.src_domain)) continue
    out.push({
      id: `broken:${b.src_url}|${b.dst_url}`,
      kind: 'broken-link',
      domain: b.src_domain,
      authority: null,
      headline: `Links to a dead page on ${b.dst_domain} (${b.status})`,
      reason: `${new URL(b.src_url).pathname} links to ${b.dst_url}${b.anchor ? ` (“${b.anchor}”)` : ''}, which now returns ${b.status}. Site owners fix broken links gladly — tell them, and suggest your page as the replacement.`,
      sourceUrl: b.src_url,
      targetUrl: null,
      competitors: [b.dst_domain],
      priority: 70,
      evidence: 'page',
      status: 'todo',
    })
  }
  return out.slice(0, 200)
}
