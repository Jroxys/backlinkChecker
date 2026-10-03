import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { marked } from 'marked'

export interface PostMeta {
  slug: string
  title: string
  description: string
  date: string
  updated: string | null
  readingMinutes: number
}
export interface Post extends PostMeta {
  html: string
}

/**
 * Blog posts are Markdown files in the repo (content/blog/<slug>.md) with a small front matter:
 *   ---
 *   title: …
 *   description: …          (meta description, 150–160 chars)
 *   date: 2026-10-01        (future dates stay hidden until that day — scheduled publishing)
 *   updated: 2026-10-20     (optional)
 *   draft: true             (optional, never published)
 *   ---
 * Content is ours, written by us, so the rendered HTML is trusted.
 */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

function parse(slug: string, src: string): (Post & { draft: boolean }) | null {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!m) return null
  const fm: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim()
  }
  if (!fm.title || !fm.description || !/^\d{4}-\d{2}-\d{2}$/.test(fm.date ?? '')) return null
  const body = m[2]
  const words = body.split(/\s+/).filter(Boolean).length
  return {
    slug,
    title: fm.title,
    description: fm.description,
    date: fm.date,
    updated: /^\d{4}-\d{2}-\d{2}$/.test(fm.updated ?? '') ? fm.updated : null,
    readingMinutes: Math.max(1, Math.round(words / 230)),
    html: marked.parse(body, { async: false, gfm: true }) as string,
    draft: fm.draft === 'true',
  }
}

let cache: { key: string; posts: Post[] } = { key: '', posts: [] }

/** Published posts, newest first. Re-reads the folder only when a file changed. */
export function loadPosts(dir: string, today = new Date().toISOString().slice(0, 10)): Post[] {
  if (!existsSync(dir)) return []
  const files = readdirSync(dir).filter((f) => f.endsWith('.md') && SLUG.test(f.slice(0, -3)))
  const key = files.map((f) => `${f}:${statSync(join(dir, f)).mtimeMs}`).join('|')
  if (key !== cache.key) {
    const all: Post[] = []
    for (const f of files) {
      const p = parse(f.slice(0, -3), readFileSync(join(dir, f), 'utf8'))
      if (p && !p.draft) {
        const { draft: _d, ...post } = p
        all.push(post)
      } else if (!p) console.warn(`[blog] skipped ${f}: missing or invalid front matter`)
    }
    cache = { key, posts: all.sort((a, b) => b.date.localeCompare(a.date)) }
  }
  return cache.posts.filter((p) => p.date <= today)
}

export const metaOf = ({ html: _h, ...meta }: Post): PostMeta => meta
