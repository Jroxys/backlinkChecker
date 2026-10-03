import { router, notFound } from '../http.js'
import { loadPosts, metaOf } from '../services/blog.js'

export const blogRoutes = router()

blogRoutes.get('/', (c) => {
  c.header('Cache-Control', 'public, max-age=300')
  return c.json({ posts: loadPosts(c.var.ctx.config.contentDir, c.var.ctx.now().toISOString().slice(0, 10)).map(metaOf) })
})

blogRoutes.get('/:slug', (c) => {
  const posts = loadPosts(c.var.ctx.config.contentDir, c.var.ctx.now().toISOString().slice(0, 10))
  const i = posts.findIndex((p) => p.slug === c.req.param('slug'))
  if (i < 0) throw notFound('Post')
  c.header('Cache-Control', 'public, max-age=300')
  // "Read next": the neighbouring posts, so readers keep going instead of bouncing.
  const more = [posts[i - 1], posts[i + 1], posts[i + 2]].filter(Boolean).slice(0, 2).map(metaOf)
  return c.json({ post: posts[i], more })
})
