import { test } from 'node:test'
import assert from 'node:assert/strict'
import { injectHead, robotsTxt, sitemapXml } from '../src/seo.js'

const shell = '<html><head><title>x</title><meta name="description" content="old" /></head><body></body></html>'

test('public pages get title, description, canonical and OG tags', () => {
  const h = injectHead(shell, '/tools/backlink-checker/', 'https://indexora.app')
  assert.match(h, /<title>Free Backlink Checker/)
  assert.match(h, /<link rel="canonical" href="https:\/\/indexora.app\/tools\/backlink-checker" \/>/)
  assert.match(h, /og:title/)
  assert.equal((h.match(/name="description"/g) ?? []).length, 1, 'old description replaced, not duplicated')
})

test('app and auth pages are noindex', () => {
  for (const p of ['/app', '/app/backlinks', '/login', '/demo/backlinks']) assert.match(injectHead(shell, p, 'https://x.test'), /noindex/, p)
})

test('robots.txt and sitemap list only public pages', () => {
  assert.match(robotsTxt('https://x.test'), /Disallow: \/app/)
  const s = sitemapXml('https://x.test')
  assert.match(s, /<loc>https:\/\/x.test\/tools\/indexability-checker<\/loc>/)
  assert.doesNotMatch(s, /login|signup/)
})

test('Turkish landing page: lang, Turkish meta and hreflang pairs with the English page', async () => {
  const { injectHead } = await import('../src/seo.js')
  const shell = '<!doctype html><html lang="en"><head><title>x</title></head><body><div id="root"></div></body></html>'
  const tr = injectHead(shell, '/tr', 'https://indexora.app')
  assert.match(tr, /<html lang="tr">/)
  assert.match(tr, /<title>Indexora — Google sitende/)
  assert.match(tr, /hreflang="en" href="https:\/\/indexora\.app\/"/)
  assert.match(tr, /hreflang="tr" href="https:\/\/indexora\.app\/tr"/)
  const en = injectHead(shell, '/', 'https://indexora.app')
  assert.match(en, /<html lang="en">/)
  assert.match(en, /hreflang="tr"/)
  assert.ok(!injectHead(shell, '/pricing-nope', 'https://indexora.app').includes('hreflang'))
})
