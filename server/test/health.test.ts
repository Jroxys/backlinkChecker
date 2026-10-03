import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seedProject, seedUser, testCtx } from './helpers.js'
import { bucketFor, checkHealth, type CertInfo, type DomainInfo, type HealthProbes } from '../src/services/health.js'

const DAY = 86_400_000

function fakeProbes(state: { cert: (host: string) => CertInfo; domain: () => DomainInfo }) {
  const calls = { cert: [] as string[], domain: 0 }
  const probes: HealthProbes = {
    certificate: async (h) => (calls.cert.push(h), state.cert(h)),
    domain: async () => (calls.domain++, state.domain()),
  }
  return { probes, calls }
}

test('bucketFor maps days left onto alert thresholds', () => {
  assert.equal(bucketFor(45), null)
  assert.equal(bucketFor(30), 30)
  assert.equal(bucketFor(12), 14)
  assert.equal(bucketFor(2), 3)
  assert.equal(bucketFor(-4), 0)
})


test('certificate: 30-day warning, no repeat, critical at 7 days, renewal resets', async () => {
  const { ctx, advance } = testCtx()
  const projectId = seedProject(ctx, seedUser(ctx), 'shop.example')
  let expires = new Date(ctx.now().getTime() + 25 * DAY)
  const { probes, calls } = fakeProbes({
    cert: (host) => ({ host, expiresAt: expires.toISOString(), issuer: "Let's Encrypt", error: null }),
    domain: () => ({ expiresAt: null, registrar: null }),
  })
  const alerts = () => ctx.db.all<{ title: string; severity: string }>('SELECT title, severity FROM alerts ORDER BY rowid')

  await checkHealth(ctx, projectId, probes)
  assert.deepEqual(alerts().map((a) => a.severity), ['warning'])
  assert.match(alerts()[0].title, /expires in 25 days/)

  advance(2)
  await checkHealth(ctx, projectId, probes)
  assert.equal(calls.cert.length, 1, 'certificates are checked at most every 20 hours')

  advance(24 * 5) // 20 days left: still the 30 bucket
  await checkHealth(ctx, projectId, probes)
  assert.equal(alerts().length, 1)

  advance(24 * 14) // ~6 days left: crosses 14 and 7 at once → one critical alert
  await checkHealth(ctx, projectId, probes)
  assert.deepEqual(alerts().map((a) => a.severity), ['warning', 'critical'])

  expires = new Date(ctx.now().getTime() + 90 * DAY)
  advance(24)
  await checkHealth(ctx, projectId, probes)
  assert.equal(alerts().at(-1)!.severity, 'success')
  assert.match(alerts().at(-1)!.title, /renewed/)
})

test('falls back to www, flags untrusted certificates once, and warns before the domain expires', async () => {
  const { ctx } = testCtx()
  const projectId = seedProject(ctx, seedUser(ctx), 'brand.co.uk')
  const far = new Date(ctx.now().getTime() + 200 * DAY).toISOString()
  const { probes, calls } = fakeProbes({
    cert: (host) => (host.startsWith('www.') ? { host, expiresAt: far, issuer: 'Acme CA', error: 'ERR_TLS_CERT_ALTNAME_INVALID' } : { host, expiresAt: null, issuer: null, error: 'ECONNREFUSED' }),
    domain: () => ({ expiresAt: new Date(ctx.now().getTime() + 10 * DAY).toISOString(), registrar: 'Example Registrar' }),
  })
  const h = await checkHealth(ctx, projectId, probes)
  assert.deepEqual(calls.cert, ['brand.co.uk', 'www.brand.co.uk'])
  assert.equal(h!.certificate!.host, 'www.brand.co.uk')
  assert.equal(h!.domain!.registrar, 'Example Registrar')
  const titles = ctx.db.all<{ title: string }>('SELECT title FROM alerts ORDER BY rowid').map((a) => a.title)
  assert.ok(titles.some((t) => /SSL certificate problem on www\.brand\.co\.uk/.test(t)))
  assert.ok(titles.some((t) => /brand\.co\.uk registration expires in 10 days/.test(t)))

  await checkHealth(ctx, projectId, probes, { force: true })
  assert.equal(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM alerts')!.n, titles.length, 'no repeats for the same state')
})
