const env = process.env

function bool(v: string | undefined, d: boolean) {
  if (v === undefined || v === '') return d
  return v === 'true' || v === '1'
}

export const config = {
  port: Number(env.PORT ?? 8787),
  databasePath: env.DATABASE_PATH ?? './data/indexora.db',
  appUrl: env.APP_URL ?? 'http://localhost:5173',
  apiUrl: env.API_URL ?? 'http://localhost:8787',
  cookieSecure: bool(env.COOKIE_SECURE, false),
  userAgent: env.CRAWLER_USER_AGENT ?? 'IndexoraBot/0.1 (+https://indexora.app/bot)',
  runWorker: bool(env.RUN_WORKER, true),
  /** Let the crawler reach private/loopback hosts. Local development only — never in production. */
  crawlerAllowPrivate: bool(env.CRAWLER_ALLOW_PRIVATE, false) && env.NODE_ENV !== 'production',
  /** Built web app to serve (vite build output). Empty = API only. */
  webDist: env.WEB_DIST ?? '../web/dist',
  google: {
    clientId: env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
  },
  dataforseo: {
    login: env.DATAFORSEO_LOGIN ?? '',
    password: env.DATAFORSEO_PASSWORD ?? '',
  },
  slackWebhookUrl: env.SLACK_WEBHOOK_URL ?? '',
  smtpUrl: env.SMTP_URL ?? '',
  mailFrom: env.MAIL_FROM ?? 'Indexora <alerts@indexora.app>',
  lemonSqueezy: {
    /** Signing secret of the Lemon Squeezy webhook */
    webhookSecret: env.LEMONSQUEEZY_WEBHOOK_SECRET ?? '',
    /** JSON map of "<plan>_<cycle>[_founding]" -> hosted checkout URL, e.g. {"pro_monthly":"https://x.lemonsqueezy.com/buy/…"} */
    checkoutUrls: (() => {
      try {
        return JSON.parse(env.LEMONSQUEEZY_CHECKOUT_URLS ?? '{}') as Record<string, string>
      } catch {
        return {}
      }
    })(),
    /** JSON map of Lemon Squeezy variant id -> plan id, e.g. {"123456":"pro"} */
    variantPlans: (() => {
      try {
        return JSON.parse(env.LEMONSQUEEZY_VARIANT_PLANS ?? '{}') as Record<string, string>
      } catch {
        return {}
      }
    })(),
    customerPortalUrl: env.LEMONSQUEEZY_PORTAL_URL ?? '',
  },
}

export type Config = typeof config

/** 32-byte key for encrypting OAuth tokens at rest. Required in production. */
export const secretKey = (() => {
  const raw = process.env.SECRET_KEY ?? ''
  if (raw) return Buffer.from(raw, raw.length === 64 && /^[0-9a-f]+$/i.test(raw) ? 'hex' : 'base64')
  if (process.env.NODE_ENV === 'production') throw new Error('SECRET_KEY must be set in production (openssl rand -hex 32)')
  return Buffer.alloc(32, 7) // dev-only fallback
})()
