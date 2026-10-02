import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeHtml, findBacklink } from '../src/lib/html.js'

const page = (body: string, head = '') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`

test('finds a followed link to the domain with its anchor', () => {
  const a = analyzeHtml(page('<p>Read <a href="https://www.example.com/guide">the guide</a></p>'), 'https://blog.test/post')
  const m = findBacklink(a, 'example.com')
  assert.equal(m.found, true)
  assert.equal(m.rel, 'dofollow')
  assert.equal(m.anchor, 'the guide')
})

test('classifies nofollow, ugc and sponsored', () => {
  for (const rel of ['nofollow', 'ugc', 'sponsored'] as const) {
    const a = analyzeHtml(page(`<a rel="${rel} noopener" href="https://example.com/">x</a>`), 'https://blog.test/')
    assert.equal(findBacklink(a, 'example.com').rel, rel)
  }
})

test('page-level meta nofollow makes every link nofollow', () => {
  const a = analyzeHtml(page('<a href="https://example.com/">x</a>', '<meta name="robots" content="index, nofollow">'), 'https://blog.test/')
  assert.equal(findBacklink(a, 'example.com').rel, 'nofollow')
  assert.equal(a.noindex, false)
})

test('X-Robots-Tag header noindex is detected', () => {
  const a = analyzeHtml(page('<a href="https://example.com/">x</a>'), 'https://blog.test/', new Headers({ 'x-robots-tag': 'noindex' }))
  assert.equal(a.noindex, true)
})

test('resolves relative hrefs against <base>', () => {
  const a = analyzeHtml(page('<a href="/docs">docs</a>', '<base href="https://example.com/">'), 'https://mirror.test/page')
  assert.equal(findBacklink(a, 'example.com').href, 'https://example.com/docs')
})

test('exact target matching ignores www, trailing slash and fragments', () => {
  const a = analyzeHtml(page('<a href="https://WWW.example.com/blog/post/#top">x</a>'), 'https://blog.test/')
  assert.equal(findBacklink(a, 'example.com', 'https://example.com/blog/post').found, true)
  assert.equal(findBacklink(a, 'example.com', 'https://example.com/other').found, false)
  assert.equal(findBacklink(a, 'example.com', 'https://example.com/other').matches, 1)
})

test('prefers a followed link when the page has several', () => {
  const a = analyzeHtml(page('<a rel="nofollow" href="https://example.com/">a</a><a href="https://example.com/">b</a>'), 'https://blog.test/')
  const m = findBacklink(a, 'example.com')
  assert.equal(m.rel, 'dofollow')
  assert.equal(m.anchor, 'b')
})

test('image links use alt text as anchor; lookalike domains do not match', () => {
  const a = analyzeHtml(page('<a href="https://example.com"><img src="l.png" alt="Example logo"></a><a href="https://notexample.com">n</a>'), 'https://blog.test/')
  assert.equal(findBacklink(a, 'example.com').anchor, '[img] Example logo')
  assert.equal(findBacklink(a, 'example.com').matches, 1)
})
