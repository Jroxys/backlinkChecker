import type { Ctx } from '../context.js'
import { urlKey } from '../lib/url.js'

export interface Opportunity {
  id: string
  kind: 'reclaim' | 'redirect' | 'competitor-gap'
  domain: string
  authority: number | null
  headline: string
  reason: string
  sourceUrl: string | null
  targetUrl: string | null
  competitors: string[]
  priority: number
}

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
      })
    }
  }

  let gapStatus: 'ok' | 'no_provider' | 'no_competitors' | 'error' = 'ok'
  const comps = ctx.db.all<{ domain: string }>('SELECT domain FROM competitors WHERE project_id = ?', [projectId]).map((r) => r.domain)
  if (!ctx.provider) gapStatus = 'no_provider'
  else if (!comps.length) gapStatus = 'no_competitors'
  else {
    try {
      const gap = await ctx.provider.gap(p.domain, comps, { limit: 30 })
      for (const g of gap) {
        if (!g.domain) continue
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
        })
      }
    } catch (e) {
      gapStatus = 'error'
      console.error('[opportunities] gap failed', e)
    }
  }

  out.sort((a, b) => b.priority - a.priority)
  return { opportunities: out, gapStatus, competitors: comps }
}
