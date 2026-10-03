/**
 * Import Common Crawl's domain link graph for every project and competitor domain.
 *
 *   node dist/scripts/cc-import.js <release>              # streams from data.commoncrawl.org
 *   node dist/scripts/cc-import.js <release> <vertices> <edges>   # local files (faster, re-runnable)
 *
 * Releases: https://commoncrawl.org/web-graphs (e.g. cc-main-2025-may-jun-jul). Run monthly via cron;
 * the edges file is large, expect an hour or more over the network.
 */
import { openDb } from '../db/index.js'
import { config } from '../config.js'
import { importDomainGraph, importTargets, releaseFiles } from '../services/commoncrawl.js'
import type { Ctx } from '../context.js'

const [release = process.env.CC_GRAPH_RELEASE, vertices, edges] = process.argv.slice(2)
if (!release) {
  console.error('Usage: cc-import <release> [vertices-file edges-file]   (or set CC_GRAPH_RELEASE)')
  process.exit(1)
}
const files = vertices && edges ? { vertices, edges } : releaseFiles(release)
const db = openDb(config.databasePath)
const ctx = { db, config, now: () => new Date() } as unknown as Ctx
const targets = importTargets(ctx)
if (!targets.length) {
  console.log('No project or competitor domains yet — nothing to import.')
  process.exit(0)
}
console.log(`Importing ${release} for ${targets.length} domains…`)
const r = await importDomainGraph(ctx, { release, ...files, targets, log: (m) => console.log(new Date().toISOString(), m) })
console.log('Done', r)
