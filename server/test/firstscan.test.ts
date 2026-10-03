import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSite, seedProject, seedUser, testCtx } from './helpers.js'
import { addUrls, checkUrl } from '../src/services/urls.js'
import { sendFirstScanEmails } from '../src/services/firstScan.js'

test('first-scan email: waits for the crawl, summarises findings, sends once', async (t) => {
  const site = await fixtureSite()
  t.after(() => site.close())
  const body = `<title>T</title><p>${'word '.repeat(300)}</p>`
  site.set('/', body)
  site.set('/hidden', `<meta name="robots" content="noindex">${body}`)
  const { ctx, notifier, advance } = testCtx()
  const userId = seedUser(ctx, 'pro', 'owner@example.com')
  const projectId = seedProject(ctx, userId, '127.0.0.1')
  ctx.db.run('UPDATE projects SET created_at = ? WHERE id = ?', [ctx.now().toISOString(), projectId])
  const { created } = addUrls(ctx, projectId, [site.url('/'), site.url('/hidden'), site.url('/missing')], 'manual')

  await checkUrl(ctx, created[0])
  assert.equal((await sendFirstScanEmails(ctx)).sent, 0, 'crawl not finished yet')

  for (const id of created.slice(1)) await checkUrl(ctx, id)
  assert.equal((await sendFirstScanEmails(ctx)).sent, 1)
  const mail = notifier.sent.at(-1)!
  assert.equal(mail.to, 'owner@example.com')
  assert.match(mail.text, /^First scan of 127\.0\.0\.1: 2 issues found/)
  assert.match(mail.text, /1 URL marked noindex/)
  assert.match(mail.text, /1 URL return an error/)
  assert.match(mail.text, /import the backlinks you already have/)

  advance(1)
  assert.equal((await sendFirstScanEmails(ctx)).sent, 0, 'once per project')
})

test('first-scan email goes out after 6 hours even if some URLs are still unchecked, and respects opt-out', async () => {
  const { ctx, notifier, advance } = testCtx()
  const userId = seedUser(ctx, 'pro', 'quiet@example.com')
  ctx.db.run('INSERT INTO notification_settings (user_id, email) VALUES (?, 0)', [userId])
  const projectId = seedProject(ctx, userId, 'example.com')
  ctx.db.run('UPDATE projects SET created_at = ? WHERE id = ?', [ctx.now().toISOString(), projectId])
  addUrls(ctx, projectId, ['https://example.com/a', 'https://example.com/b'], 'manual')
  ctx.db.run("UPDATE monitored_urls SET last_checked_at = ?, http_status = 200, robots = 'allowed' WHERE url LIKE '%/a'", [ctx.now().toISOString()])
  assert.equal((await sendFirstScanEmails(ctx)).sent, 0)
  advance(7)
  assert.equal((await sendFirstScanEmails(ctx)).sent, 0, 'opted out')
  assert.ok(ctx.db.get<{ s: string | null }>('SELECT first_scan_sent_at AS s FROM projects')!.s, 'but marked done')
  assert.equal(notifier.sent.length, 0)
})
