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
