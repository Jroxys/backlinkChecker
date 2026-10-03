import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { Ctx } from './context.js'
import { ApiError, type Env } from './http.js'
import { authRoutes } from './routes/auth.js'
import { projectRoutes } from './routes/projects.js'
import { urlRoutes } from './routes/urls.js'
import { backlinkRoutes } from './routes/backlinks.js'
import { alertRoutes } from './routes/alerts.js'
import { googleRoutes } from './routes/google.js'
import { competitorRoutes } from './routes/competitors.js'
import { billingRoutes } from './routes/billing.js'
import { toolRoutes } from './routes/tools.js'
import { keyRoutes } from './routes/keys.js'
import { teamRoutes } from './routes/team.js'
import { reportRoutes } from './routes/reports.js'
import { exportRoutes } from './routes/exports.js'
import { blogRoutes } from './routes/blog.js'
import { hookRoutes } from './routes/hooks.js'
import { loadPosts, type Post } from './services/blog.js'
import type { PageExtra } from './seo.js'
import { adminRoutes } from './routes/admin.js'
import { injectHead, robotsTxt, sitemapXml } from './seo.js'

export function createApp(ctx: Ctx) {
  const app = new Hono<Env>()

  app.use('*', secureHeaders())
  app.use('/api/*', cors({ origin: [ctx.config.appUrl], credentials: true, allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], maxAge: 600 }))
  app.use('*', async (c, next) => {
    c.set('ctx', ctx)
    await next()
  })

  /**
   * CSRF: session cookies are SameSite=Lax, and every state-changing request must
   * come from our own origin (Origin header) — webhooks excepted, they're signed.
   */
  app.use('/api/*', async (c, next) => {
    const m = c.req.method
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && !c.req.path.startsWith('/api/billing/webhooks/')) {
      const origin = c.req.header('origin')
      if (origin && origin !== ctx.config.appUrl && origin !== ctx.config.apiUrl) throw new ApiError(403, 'bad_origin', 'Cross-site request blocked')
    }
    await next()
  })

  app.get('/api/health', (c) => c.json({ ok: true, time: ctx.now().toISOString() }))
  app.route('/api/auth', authRoutes)
  app.route('/api/projects', projectRoutes)
  app.route('/api', urlRoutes)
  app.route('/api', backlinkRoutes)
  app.route('/api', competitorRoutes)
  app.route('/api/alerts', alertRoutes)
  app.route('/api/google', googleRoutes)
  app.route('/api/billing', billingRoutes)
  app.route('/api/tools', toolRoutes)
  app.route('/api/admin', adminRoutes)
  app.route('/api/keys', keyRoutes)
  app.route('/api/team', teamRoutes)
  app.route('/api', reportRoutes)
  app.route('/api', exportRoutes)
  app.route('/api/blog', blogRoutes)
  app.route('/api/hooks', hookRoutes)

  // Serve the built web app from the same origin (cookies stay first-party, one deploy).
  const dist = ctx.config.webDist ? resolve(ctx.config.webDist) : ''
  if (dist && existsSync(resolve(dist, 'index.html'))) {
    // Re-read index.html when it changes, so a rebuild never serves stale asset hashes
    const indexPath = resolve(dist, 'index.html')
    let cached = { mtime: 0, html: '' }
    const indexHtml = () => {
      const m = statSync(indexPath).mtimeMs
      if (m !== cached.mtime) cached = { mtime: m, html: readFileSync(indexPath, 'utf8') }
      return cached.html
    }
    app.use('/assets/*', async (c, next) => {
      await next()
      c.header('cache-control', 'public, max-age=31536000, immutable')
    })
    app.get('/robots.txt', (c) => c.text(robotsTxt(ctx.config.appUrl)))
    const posts = () => loadPosts(ctx.config.contentDir, ctx.now().toISOString().slice(0, 10))
    app.get('/sitemap.xml', (c) =>
      c.body(sitemapXml(ctx.config.appUrl, posts().map((p) => ({ path: `/blog/${p.slug}`, lastmod: p.updated ?? p.date }))), 200, { 'content-type': 'application/xml; charset=utf-8' }),
    )
    // Static files, but never index.html directly: it must go through head injection below
    app.use('*', async (c, next) => (c.req.path === '/' || c.req.path === '/index.html' ? next() : serveStatic({ root: dist })(c, next)))
    // SPA fallback: any non-API GET renders the app shell
    app.get('*', (c) => {
      if (c.req.path.startsWith('/api/')) return c.json({ error: { code: 'not_found', message: 'No such endpoint' } }, 404)
      const inBlog = /^\/blog\/[^/]+\/?$/.test(c.req.path)
      const slug = c.req.path.match(/^\/blog\/([a-z0-9-]+)\/?$/)?.[1]
      const post = slug ? posts().find((p) => p.slug === slug) : undefined
      if (inBlog && !post) return c.html(injectHead(indexHtml(), c.req.path, ctx.config.appUrl), 404)
      return c.html(injectHead(indexHtml(), c.req.path, ctx.config.appUrl, post ? blogExtra(post, ctx.config.appUrl) : undefined))
    })
  }

  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'No such endpoint' } }, 404))
  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status)
    if ('status' in err && typeof err.status === 'number' && err.status < 500) return c.json({ error: { code: 'http_error', message: err.message } }, err.status as 400)
    console.error('[api] unhandled', err)
    return c.json({ error: { code: 'internal', message: 'Something went wrong on our side' } }, 500)
  })
  return app
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function blogExtra(post: Post, appUrl: string): PageExtra {
  const url = `${appUrl.replace(/\/$/, '')}/blog/${post.slug}`
  return {
    meta: { title: `${post.title} | Indexora`, description: post.description, index: true },
    ogType: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updated ?? post.date,
      mainEntityOfPage: url,
      author: { '@type': 'Organization', name: 'Indexora' },
      publisher: { '@type': 'Organization', name: 'Indexora' },
    },
    body: `<article><h1>${escHtml(post.title)}</h1>${post.html}</article>`,
  }
}
