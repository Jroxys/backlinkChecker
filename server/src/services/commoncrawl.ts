import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import type { Ctx } from '../context.js'
import { id } from '../lib/ids.js'
import { rootDomain } from '../lib/url.js'

/**
 * Common Crawl web graph importer (https://commoncrawl.org/web-graphs).
 *
 * Common Crawl publishes a domain-level link graph a few times a year: a vertices file
 * ("id \t reversed.domain \t hostCount") and an edges file ("fromId \t toId"), both gzipped,
 * free to download. The full graph is billions of edges, so we never load it: we stream it and
 * keep only edges that point at domains our customers care about (their projects and competitors).
 *
 *   pass 1  vertices → ids of the target domains
 *   pass 2  edges    → for each target, the ids of domains linking to it
 *   pass 3  vertices → names (and host counts) of those linking domains
 *
 * Runs outside the web process (see scripts/cc-import.ts): it takes a while over the network.
 */

export const CC_BASE = 'https://data.commoncrawl.org/projects/hyperlinkgraph'

/** File URLs of a release, e.g. "cc-main-2025-may-jun-jul". */
export function releaseFiles(release: string) {
  const dir = `${CC_BASE}/${release}/domain`
  return { vertices: `${dir}/${release}-domain-vertices.txt.gz`, edges: `${dir}/${release}-domain-edges.txt.gz` }
}

/** Lines of a local file or http(s) URL, gunzipped when the name ends in .gz. */
export async function* readLines(src: string): AsyncGenerator<string> {
  let stream: NodeJS.ReadableStream
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src)
    if (!res.ok || !res.body) throw new Error(`${src}: HTTP ${res.status}`)
    stream = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream)
  } else {
    stream = createReadStream(src)
  }
  if (src.endsWith('.gz')) stream = stream.pipe(createGunzip())
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) if (line) yield line
}

/** "com.example" → "example.com" */
export const unreverse = (rev: string) => rev.split('.').reverse().join('.')

/** Every domain customers watch: their projects and their competitors. */
export function importTargets(ctx: Ctx) {
  return [
    ...new Set(
      [...ctx.db.all<{ domain: string }>('SELECT domain FROM projects'), ...ctx.db.all<{ domain: string }>('SELECT domain FROM competitors')].map((r) => rootDomain(r.domain)),
    ),
  ]
}

export interface ImportOptions {
  release: string
  vertices: string
  edges: string
  targets: string[]
  /** Keep at most this many linking domains per target (largest sites first). */
  maxPerTarget?: number
  log?: (msg: string) => void
}

export async function importDomainGraph(ctx: Ctx, opts: ImportOptions) {
  const log = opts.log ?? (() => {})
  const maxPer = opts.maxPerTarget ?? 20_000
  const want = new Set(opts.targets.map((t) => rootDomain(t)))
  const runId = id('cc')
  ctx.db.run('INSERT INTO cc_imports (id, release, started_at, targets) VALUES (?, ?, ?, ?)', [runId, opts.release, ctx.now().toISOString(), want.size])

  try {
    // pass 1
    const targetIds = new Map<number, string>()
    let n = 0
    for await (const line of readLines(opts.vertices)) {
      if (++n % 10_000_000 === 0) log(`vertices: ${n / 1e6}M lines, ${targetIds.size}/${want.size} targets found`)
      const a = line.indexOf('\t')
      const b = line.indexOf('\t', a + 1)
      const name = unreverse(line.slice(a + 1, b === -1 ? undefined : b))
      if (want.has(name)) {
        targetIds.set(Number(line.slice(0, a)), name)
        if (targetIds.size === want.size) break
      }
    }
    log(`pass 1 done: ${targetIds.size} of ${want.size} targets are in the graph`)

    // pass 2
    const inLinks = new Map<number, number[]>() // linking id → target ids
    let edges = 0
    n = 0
    for await (const line of readLines(opts.edges)) {
      if (++n % 50_000_000 === 0) log(`edges: ${n / 1e6}M lines, ${edges} kept`)
      const tab = line.indexOf('\t')
      const to = Number(line.slice(tab + 1))
      if (!targetIds.has(to)) continue
      const from = Number(line.slice(0, tab))
      if (from === to) continue
      const xs = inLinks.get(from)
      if (xs) xs.push(to)
      else inLinks.set(from, [to])
      edges++
    }
    log(`pass 2 done: ${edges} edges from ${inLinks.size} domains`)

    // pass 3 (ids are assigned in file order, so we can stop at the largest one we need)
    const names = new Map<number, { name: string; hosts: number }>()
    let maxId = -1
    for (const k of inLinks.keys()) if (k > maxId) maxId = k
    for await (const line of readLines(opts.vertices)) {
      const a = line.indexOf('\t')
      const vid = Number(line.slice(0, a))
      if (inLinks.has(vid)) {
        const b = line.indexOf('\t', a + 1)
        names.set(vid, { name: unreverse(line.slice(a + 1, b === -1 ? undefined : b)), hosts: b === -1 ? 1 : Number(line.slice(b + 1)) || 1 })
      }
      if (vid >= maxId) break
    }

    // group by target, biggest linking sites first, capped
    const byTarget = new Map<string, { name: string; hosts: number }[]>()
    for (const [from, tos] of inLinks) {
      const src = names.get(from)
      if (!src) continue
      for (const to of tos) {
        const t = targetIds.get(to)!
        const list = byTarget.get(t) ?? []
        list.push(src)
        byTarget.set(t, list)
      }
    }

    const at = ctx.now().toISOString()
    ctx.db.tx(() => {
      for (const t of want) {
        ctx.db.run("DELETE FROM domain_links WHERE dst_domain = ? AND source = 'cc'", [t])
        ctx.db.run(
          'INSERT INTO graph_domains (domain, cc_release, updated_at) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET cc_release = excluded.cc_release, updated_at = excluded.updated_at',
          [t, opts.release, at],
        )
      }
      for (const [t, list] of byTarget) {
        list.sort((a, b) => b.hosts - a.hosts)
        for (const s of list.slice(0, maxPer)) {
          ctx.db.run("INSERT OR IGNORE INTO domain_links (dst_domain, src_domain, source, seen_at) VALUES (?, ?, 'cc', ?)", [t, s.name, at])
          ctx.db.run('INSERT INTO graph_domains (domain, hosts, updated_at) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET hosts = excluded.hosts, updated_at = excluded.updated_at', [s.name, s.hosts, at])
        }
      }
    })
    ctx.db.run('UPDATE cc_imports SET finished_at = ?, edges = ? WHERE id = ?', [ctx.now().toISOString(), edges, runId])
    log(`stored: ${[...byTarget.values()].reduce((a, l) => a + Math.min(l.length, maxPer), 0)} links for ${byTarget.size} targets`)
    return { targets: want.size, found: targetIds.size, edges, linkingDomains: names.size }
  } catch (e) {
    ctx.db.run('UPDATE cc_imports SET finished_at = ?, error = ? WHERE id = ?', [ctx.now().toISOString(), (e as Error).message, runId])
    throw e
  }
}
