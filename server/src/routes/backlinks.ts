import { z } from 'zod'
import { ApiError, body, notFound, ownedProject, pageParams, requireUser, router, type C } from '../http.js'
import { extractLinks } from '../lib/csv.js'
import { addBacklinks, alertForEvents, verifyBacklink, type BacklinkRow } from '../services/backlinks.js'
import { track } from '../services/events.js'

export const backlinkRoutes = router()
backlinkRoutes.use('/projects/*', requireUser)
backlinkRoutes.use('/backlinks/*', requireUser)

export function presentBacklink(b: BacklinkRow, nowMs = Date.now()) {
  const isNew = b.status === 'active' && b.first_seen !== null && nowMs - new Date(b.first_seen).getTime() < 30 * 86_400_000
  return {
    id: b.id,
    sourceUrl: b.source_url,
    sourceDomain: b.source_domain,
    target: b.found_target ?? (b.target_url || null),
    expectedTarget: b.target_url || null,
    anchor: b.anchor,
    type: b.rel,
    status: b.status,
    isNew,
    origin: b.origin,
    authority: b.authority,
    pageNoindex: Boolean(b.page_noindex),
    http: b.http_status,
    lastError: b.last_error,
    firstSeen: b.first_seen,
    lastSeen: b.last_seen,
    lastChecked: b.last_checked_at,
    nextCheck: b.next_check_at,
  }
}

const SORTS: Record<string, string> = { authority: 'authority', firstSeen: 'first_seen', lastSeen: 'last_seen', domain: 'source_domain', lastChecked: 'last_checked_at' }

backlinkRoutes.get('/projects/:id/backlinks', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const { page, pageSize, offset } = pageParams(c)
  const where = ['project_id = :p']
  const params: Record<string, string | number> = { p: p.id, since: new Date(Date.now() - 30 * 86_400_000).toISOString() }
  const f = new Set((c.req.query('filter') ?? '').split(',').filter(Boolean))
  const or = (conds: string[]) => conds.length && where.push(`(${conds.join(' OR ')})`)
  or([f.has('dofollow') && "rel = 'dofollow'", f.has('nofollow') && "rel IN ('nofollow','ugc','sponsored')"].filter(Boolean) as string[])
  or([f.has('new') && "(status = 'active' AND first_seen >= :since)", f.has('lost') && "status IN ('lost','broken')", f.has('pending') && "status = 'pending'"].filter(Boolean) as string[])
  or([f.has('high') && 'authority >= 70', f.has('low') && 'authority < 30'].filter(Boolean) as string[])
  const status = c.req.query('status')
  if (status && ['pending', 'active', 'lost', 'broken', 'blocked'].includes(status)) where.push('status = :status'), (params.status = status)
  const q = c.req.query('q')?.trim()
  if (q) where.push('(source_url LIKE :q OR anchor LIKE :q OR target_url LIKE :q OR found_target LIKE :q)'), (params.q = `%${q}%`)
  const sort = SORTS[c.req.query('sort') ?? 'firstSeen'] ?? 'first_seen'
  const dir = c.req.query('dir') === 'asc' ? 'ASC' : 'DESC'
  const w = where.join(' AND ')
  const total = c.var.ctx.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM backlinks WHERE ${w}`, params)!.n
  const rows = c.var.ctx.db.all<BacklinkRow>(`SELECT * FROM backlinks WHERE ${w} ORDER BY ${sort} ${dir} NULLS LAST, created_at DESC LIMIT ${pageSize} OFFSET ${offset}`, params)
  return c.json({ backlinks: rows.map((r) => presentBacklink(r)), total, page, pageSize })
})

/** Anchor-text and authority distribution of active links. */
backlinkRoutes.get('/projects/:id/backlinks/profile', (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const rows = c.var.ctx.db.all<{ anchor: string | null; authority: number | null; rel: string | null; source_domain: string }>(
    "SELECT anchor, authority, rel, source_domain FROM backlinks WHERE project_id = ? AND status = 'active'",
    [p.id],
  )
  const brand = p.domain.split('.')[0].toLowerCase()
  const buckets = { branded: 0, url: 0, generic: 0, other: 0, empty: 0 }
  const generic = /^(click here|here|read more|this|link|website|source|more|learn more|this article|this post|visit|homepage)$/i
  for (const r of rows) {
    const a = (r.anchor ?? '').trim().toLowerCase()
    if (!a) buckets.empty++
    else if (/^https?:\/\/|^www\.|\.[a-z]{2,}\/?$/.test(a)) buckets.url++
    else if (a.replace(/[^a-z0-9]/g, '').includes(brand.replace(/[^a-z0-9]/g, ''))) buckets.branded++
    else if (generic.test(a)) buckets.generic++
    else buckets.other++
  }
  const authority = [0, 20, 40, 60, 80].map((lo) => ({
    bucket: lo === 80 ? '80–100' : `${lo}–${lo + 19}`,
    count: new Set(rows.filter((r) => r.authority !== null && r.authority >= lo && r.authority < lo + 20 + (lo === 80 ? 1 : 0)).map((r) => r.source_domain)).size,
  }))
  const unknownAuthority = new Set(rows.filter((r) => r.authority === null).map((r) => r.source_domain)).size
  return c.json({ anchors: buckets, authority, unknownAuthority, total: rows.length })
})

const addSchema = z.object({
  links: z.array(z.object({ sourceUrl: z.string().max(2000), targetUrl: z.string().max(2000).optional(), authority: z.number().int().min(0).max(100).nullish() })).min(1).max(5000),
})

backlinkRoutes.post('/projects/:id/backlinks', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const { links } = await body(c, addSchema)
  const r = addBacklinks(c.var.ctx, p.id, links, 'manual')
  if (r.created.length) track(c.var.ctx.db, 'backlinks_added', c.var.user.id)
  return c.json(r, 201)
})

/** Upload a CSV / URL list as text/plain or text/csv (max 2 MB). */
backlinkRoutes.post('/projects/:id/backlinks/import', async (c) => {
  const p = ownedProject(c, c.req.param('id'))
  const text = await c.req.text()
  if (text.length > 2 * 1024 * 1024) throw new ApiError(422, 'too_large', 'Import files are limited to 2 MB')
  const { links, domainOnly, format } = extractLinks(text)
  if (!links.length)
    throw new ApiError(
      422,
      'nothing_to_import',
      domainOnly.length
        ? 'This file only lists domains. In Search Console use Links → “Latest links” → Export, which includes the linking page URLs.'
        : 'No linking page URLs found in this file',
    )
  const r = addBacklinks(c.var.ctx, p.id, links, 'import')
  if (r.created.length) track(c.var.ctx.db, 'backlinks_added', c.var.user.id)
  return c.json({ format, ...r, domainOnly: domainOnly.length }, 201)
})

function ownedBacklink(c: C, blId: string) {
  const b = c.var.ctx.db.get<BacklinkRow>('SELECT b.* FROM backlinks b JOIN projects p ON p.id = b.project_id WHERE b.id = ? AND p.user_id = ?', [blId, c.var.user.id])
  if (!b) throw notFound('Backlink')
  return b
}

backlinkRoutes.post('/backlinks/:id/recheck', async (c) => {
  const b = ownedBacklink(c, c.req.param('id'))
  const events = await verifyBacklink(c.var.ctx, b.id)
  alertForEvents(c.var.ctx, events)
  return c.json({ backlink: presentBacklink(ownedBacklink(c, b.id)), events: events.map((e) => e.type) })
})

backlinkRoutes.get('/backlinks/:id/checks', (c) => {
  const b = ownedBacklink(c, c.req.param('id'))
  return c.json({ checks: c.var.ctx.db.all('SELECT at, http_status AS http, found, rel, anchor, error FROM backlink_checks WHERE backlink_id = ? ORDER BY at DESC LIMIT 90', [b.id]) })
})

backlinkRoutes.delete('/backlinks/:id', (c) => {
  const b = ownedBacklink(c, c.req.param('id'))
  c.var.ctx.db.run('DELETE FROM backlinks WHERE id = ?', [b.id])
  return c.json({ ok: true })
})
