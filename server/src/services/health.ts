import tls from 'node:tls'
import type { Ctx } from '../context.js'
import { guardedLookup } from '../lib/fetcher.js'
import { rootDomain } from '../lib/url.js'
import { createAlert } from './alerts.js'

const DAY = 86_400_000
/** Alert when expiry crosses one of these (days left). Each threshold fires once per renewal cycle. */
const THRESHOLDS = [30, 14, 7, 3, 1, 0]

export interface CertInfo {
  host: string
  expiresAt: string | null
  issuer: string | null
  /** Why the certificate isn't trusted (expired, wrong host, self-signed…), or a connection error. */
  error: string | null
}
export interface DomainInfo {
  expiresAt: string | null
  registrar: string | null
}
export interface HealthProbes {
  certificate(host: string): Promise<CertInfo>
  domain(domain: string): Promise<DomainInfo>
}

export function defaultProbes(allowPrivate: boolean): HealthProbes {
  return {
    certificate: (host) => probeCertificate(host, allowPrivate),
    domain: probeDomain,
  }
}

function probeCertificate(host: string, allowPrivate: boolean): Promise<CertInfo> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 10_000, ...(allowPrivate ? {} : { lookup: guardedLookup }) })
    const done = (info: CertInfo) => {
      socket.destroy()
      resolve(info)
    }
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate()
      const expires = cert?.valid_to ? new Date(cert.valid_to) : null
      const issuer = cert?.issuer ? String(cert.issuer.O ?? cert.issuer.CN ?? '') || null : null
      const err = socket.authorized ? null : String(socket.authorizationError ?? 'Certificate not trusted')
      done({ host, expiresAt: expires && !isNaN(expires.getTime()) ? expires.toISOString() : null, issuer, error: err })
    })
    socket.once('timeout', () => done({ host, expiresAt: null, issuer: null, error: 'Timed out connecting on port 443' }))
    socket.once('error', (e: NodeJS.ErrnoException) => done({ host, expiresAt: null, issuer: null, error: e.code === 'ESSRF' ? 'Private address' : e.code ?? e.message }))
  })
}

/** Registration expiry from RDAP (the structured successor to WHOIS). Not every TLD publishes it. */
async function probeDomain(domain: string): Promise<DomainInfo> {
  const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    headers: { accept: 'application/rdap+json, application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return { expiresAt: null, registrar: null }
  const j = (await res.json()) as {
    events?: { eventAction: string; eventDate: string }[]
    entities?: { roles?: string[]; vcardArray?: [string, [string, object, string, string][]] }[]
  }
  const exp = j.events?.find((e) => e.eventAction === 'expiration')?.eventDate ?? null
  const reg = j.entities?.find((e) => e.roles?.includes('registrar'))
  const fn = reg?.vcardArray?.[1]?.find((v) => v[0] === 'fn')?.[3] ?? null
  return { expiresAt: exp ? new Date(exp).toISOString() : null, registrar: fn }
}

/** The threshold bucket for `daysLeft` (e.g. 12 → 14), or null when it's further out than every threshold. */
export function bucketFor(daysLeft: number) {
  const hits = THRESHOLDS.filter((t) => daysLeft <= t)
  return hits.length ? Math.min(...hits) : null
}

interface Row {
  project_id: string
  cert_host: string | null
  cert_expires_at: string | null
  cert_error: string | null
  cert_checked_at: string | null
  cert_alerted: number | null
  domain_expires_at: string | null
  domain_checked_at: string | null
  domain_alerted: number | null
}

/** Check one project. Certificates daily, registrations weekly (RDAP servers rate-limit). */
export async function checkHealth(ctx: Ctx, projectId: string, probes: HealthProbes, { force = false } = {}) {
  const p = ctx.db.get<{ id: string; user_id: string; domain: string }>('SELECT id, user_id, domain FROM projects WHERE id = ?', [projectId])
  if (!p) return null
  ctx.db.run('INSERT OR IGNORE INTO domain_health (project_id) VALUES (?)', [p.id])
  const row = ctx.db.get<Row>('SELECT * FROM domain_health WHERE project_id = ?', [p.id])!
  const now = ctx.now()
  const age = (iso: string | null) => (iso ? now.getTime() - new Date(iso).getTime() : Infinity)
  const daysLeft = (iso: string) => Math.floor((new Date(iso).getTime() - now.getTime()) / DAY)
  const alert = (severity: 'critical' | 'warning' | 'success', title: string, body: string) =>
    createAlert(ctx, { userId: p.user_id, projectId: p.id, kind: 'technical', severity, title, body, href: '/app' })

  if (force || age(row.cert_checked_at) > 20 * 3_600_000) {
    let cert = await probes.certificate(p.domain)
    // Some sites only serve HTTPS on www.
    if (cert.error && !cert.expiresAt && !p.domain.startsWith('www.')) {
      const www = await probes.certificate(`www.${p.domain}`)
      if (www.expiresAt) cert = www
    }
    let alerted = row.cert_alerted
    if (cert.expiresAt) {
      const left = daysLeft(cert.expiresAt)
      const bucket = bucketFor(left)
      const renewed = row.cert_expires_at && new Date(cert.expiresAt) > new Date(row.cert_expires_at) && row.cert_alerted !== null
      if (renewed) {
        alert('success', `SSL certificate renewed for ${cert.host}`, `Now valid until ${cert.expiresAt.slice(0, 10)}.`)
        alerted = null
      }
      if (bucket !== null && (alerted === null || bucket < alerted)) {
        alert(
          left <= 7 ? 'critical' : 'warning',
          left < 0 ? `SSL certificate expired on ${cert.host}` : `SSL certificate for ${cert.host} expires in ${left} day${left === 1 ? '' : 's'}`,
          left < 0
            ? 'Browsers now show a security warning and Google may stop crawling over HTTPS. Renew the certificate now.'
            : `It expires on ${cert.expiresAt.slice(0, 10)}. If renewal is automatic (Let’s Encrypt, Cloudflare), check that it’s still running.`,
        )
        alerted = bucket
      }
    }
    // A newly broken certificate (wrong host, untrusted chain) is worth one alert even when the date is fine.
    if (cert.error && cert.expiresAt && cert.error !== row.cert_error && !/EXPIRED/i.test(cert.error))
      alert('critical', `SSL certificate problem on ${cert.host}`, `Browsers reject the certificate: ${cert.error}. Visitors see a security warning.`)
    ctx.db.run(
      'UPDATE domain_health SET cert_host = ?, cert_expires_at = ?, cert_issuer = ?, cert_error = ?, cert_checked_at = ?, cert_alerted = ? WHERE project_id = ?',
      [cert.host, cert.expiresAt, cert.issuer, cert.error, now.toISOString(), alerted, p.id],
    )
  }

  if (force || age(row.domain_checked_at) > 6 * DAY) {
    const root = rootDomain(p.domain)
    const d = await probes.domain(root).catch(() => ({ expiresAt: null, registrar: null }))
    let alerted = row.domain_alerted
    if (d.expiresAt) {
      const left = daysLeft(d.expiresAt)
      const bucket = bucketFor(left)
      if (row.domain_expires_at && new Date(d.expiresAt) > new Date(row.domain_expires_at)) alerted = null
      if (bucket !== null && (alerted === null || bucket < alerted)) {
        alert(
          left <= 14 ? 'critical' : 'warning',
          left < 0 ? `${root} registration has expired` : `${root} registration expires in ${left} day${left === 1 ? '' : 's'}`,
          `Expiry date: ${d.expiresAt.slice(0, 10)}${d.registrar ? ` (registrar: ${d.registrar})` : ''}. An expired domain takes the whole site — and its rankings — offline. Turn on auto-renew.`,
        )
        alerted = bucket
      }
    }
    ctx.db.run('UPDATE domain_health SET domain_expires_at = ?, registrar = ?, domain_checked_at = ?, domain_alerted = ? WHERE project_id = ?', [
      d.expiresAt,
      d.registrar,
      now.toISOString(),
      alerted,
      p.id,
    ])
  }
  return healthFor(ctx, p.id)
}

export function healthFor(ctx: Ctx, projectId: string) {
  const r = ctx.db.get<Row & { cert_issuer: string | null; registrar: string | null }>('SELECT * FROM domain_health WHERE project_id = ?', [projectId])
  if (!r) return null
  return {
    certificate: r.cert_checked_at ? { host: r.cert_host, expiresAt: r.cert_expires_at, issuer: r.cert_issuer, error: r.cert_error, checkedAt: r.cert_checked_at } : null,
    domain: r.domain_checked_at ? { expiresAt: r.domain_expires_at, registrar: r.registrar, checkedAt: r.domain_checked_at } : null,
  }
}

export async function sweepHealth(ctx: Ctx, probes: HealthProbes) {
  const ps = ctx.db.all<{ id: string }>('SELECT id FROM projects')
  for (const p of ps) await checkHealth(ctx, p.id, probes).catch((e) => console.error('[health]', p.id, e))
  return { projects: ps.length }
}
