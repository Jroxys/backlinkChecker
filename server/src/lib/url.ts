/** URL helpers shared by the crawler, verifier and API validation. */

/** "https://www.Example.com/foo" | "example.com" -> "example.com" */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase()
  if (!s) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = 'http://' + s
  try {
    const host = new URL(s).hostname.replace(/^www\./, '').replace(/\.$/, '')
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && host !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null
    return host
  } catch {
    return null
  }
}

/** Parse an absolute http(s) URL, adding https:// if no scheme is given. */
export function parseHttpUrl(input: string): URL | null {
  let s = input.trim()
  if (!s) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    return u
  } catch {
    return null
  }
}

/** Canonical string form used for equality: lowercase host, no www, no fragment, no trailing slash (except root). */
export function urlKey(u: URL | string): string {
  const x = typeof u === 'string' ? new URL(u) : new URL(u.href)
  const host = x.hostname.toLowerCase().replace(/^www\./, '')
  let path = x.pathname.replace(/\/+$/, '') || '/'
  try {
    path = decodeURI(path)
  } catch {
    /* keep raw */
  }
  return `${host}${x.port ? ':' + x.port : ''}${path}${x.search}`
}

/** True when `host` is `domain` or a subdomain of it (www-insensitive). */
export function hostMatches(host: string, domain: string) {
  const h = host.toLowerCase().replace(/^www\./, '')
  const d = domain.toLowerCase().replace(/^www\./, '')
  return h === d || h.endsWith('.' + d)
}

/** Registrable-ish domain for grouping referring domains. Good enough without the PSL. */
export function rootDomain(host: string) {
  const parts = host.toLowerCase().replace(/^www\./, '').split('.')
  if (parts.length <= 2) return parts.join('.')
  const sld = parts[parts.length - 2]
  // co.uk, com.tr, com.au … keep three labels
  if (sld.length <= 3 && ['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'gen', 'web', 'bel', 'k12'].includes(sld)) return parts.slice(-3).join('.')
  return parts.slice(-2).join('.')
}

/** Reject URLs that would make our crawler hit private infrastructure (SSRF guard). */
export function isPublicHost(hostname: string) {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return false
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return false
  }
  if (h.startsWith('[') || h.includes(':')) return false // literal IPv6 — not needed for SEO targets
  return true
}
