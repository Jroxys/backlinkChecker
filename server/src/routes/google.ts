import { randomBytes } from 'node:crypto'
import { ApiError, requireUser, router } from '../http.js'
import { now } from '../lib/ids.js'
import { accessTokenFor, saveConnection } from '../services/google.js'

export const googleRoutes = router()

const redirectUri = (apiUrl: string) => `${apiUrl}/api/google/callback`

googleRoutes.get('/connect', requireUser, (c) => {
  const { google, config, db } = c.var.ctx
  if (!google.configured) throw new ApiError(503, 'google_not_configured', 'Google sign-in is not configured on this server (GOOGLE_CLIENT_ID/SECRET)')
  const state = randomBytes(24).toString('base64url')
  db.run('INSERT INTO oauth_states (state, user_id, created_at) VALUES (?, ?, ?)', [state, c.var.user.id, now()])
  return c.redirect(google.authUrl(state, redirectUri(config.apiUrl)))
})

/** OAuth callback. The state row ties the response to the user who started the flow (CSRF protection). */
googleRoutes.get('/callback', async (c) => {
  const { google, config, db } = c.var.ctx
  const back = (q: string) => c.redirect(`${config.appUrl}/app/settings?tab=integrations&${q}`)
  const state = c.req.query('state') ?? ''
  const row = db.get<{ user_id: string; created_at: string }>('SELECT user_id, created_at FROM oauth_states WHERE state = ?', [state])
  db.run('DELETE FROM oauth_states WHERE state = ?', [state])
  if (!row || Date.now() - new Date(row.created_at).getTime() > 15 * 60_000) return back('google=expired')
  if (c.req.query('error')) return back(`google=denied`)
  try {
    const tokens = await google.exchangeCode(c.req.query('code') ?? '', redirectUri(config.apiUrl))
    saveConnection(db, row.user_id, tokens)
    return back('google=connected')
  } catch (e) {
    console.error('[google] token exchange failed', e)
    return back('google=error')
  }
})

googleRoutes.get('/sites', requireUser, async (c) => {
  const { google, db } = c.var.ctx
  const token = await accessTokenFor(db, google, c.var.user.id)
  if (!token) throw new ApiError(409, 'google_not_connected', 'Connect Google Search Console first')
  return c.json({ sites: await google.listSites(token) })
})

googleRoutes.delete('/', requireUser, (c) => {
  c.var.ctx.db.run('DELETE FROM google_connections WHERE user_id = ?', [c.var.user.id])
  return c.json({ ok: true })
})
