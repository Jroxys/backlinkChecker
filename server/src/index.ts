import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { config } from './config.js'
import type { Ctx } from './context.js'
import { openDb } from './db/index.js'
import { startWorker } from './jobs/worker.js'
import { PoliteFetcher } from './lib/fetcher.js'
import { DataForSeoProvider } from './services/discovery.js'
import { createGoogleClient } from './services/google.js'
import { createNotifier } from './services/notifier.js'
import { defaultProbes } from './services/health.js'
import { createCruxClient } from './services/cwv.js'

const db = openDb(config.databasePath)
const ctx: Ctx = {
  db,
  config,
  fetcher: new PoliteFetcher({ userAgent: config.userAgent, allowPrivate: config.crawlerAllowPrivate }),
  notifier: await createNotifier(config.smtpUrl, config.mailFrom),
  provider: config.dataforseo.login ? new DataForSeoProvider(config.dataforseo.login, config.dataforseo.password) : null,
  google: createGoogleClient(config.google.clientId, config.google.clientSecret),
  probes: defaultProbes(config.crawlerAllowPrivate),
  crux: createCruxClient(config.cruxApiKey),
  now: () => new Date(),
}

const app = createApp(ctx)
const server = serve({ fetch: app.fetch, port: config.port }, (info) => console.log(`Indexora API listening on http://localhost:${info.port}`))
const worker = config.runWorker ? startWorker(ctx) : null
if (worker) console.log('Background worker started')

let closing = false
for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.on(sig, async () => {
    if (closing) return
    closing = true
    console.log(`${sig} received, shutting down…`)
    server.close()
    await worker?.stop()
    db.close()
    process.exit(0)
  })
