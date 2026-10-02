import type { Db } from './db/index.js'
import type { Config } from './config.js'
import type { PoliteFetcher } from './lib/fetcher.js'
import type { Notifier } from './services/notifier.js'
import type { BacklinkProvider } from './services/discovery.js'
import type { GoogleClient } from './services/google.js'

/** Everything a service needs, passed explicitly so tests can swap any part. */
export interface Ctx {
  db: Db
  config: Config
  fetcher: PoliteFetcher
  notifier: Notifier
  provider: BacklinkProvider | null
  google: GoogleClient
  now: () => Date
}
