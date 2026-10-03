import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate } from '@/utils/format'
import { Container, Footer, Nav } from './Landing'
import { NotFound } from '../NotFound'

interface PostMeta {
  slug: string
  title: string
  description: string
  date: string
  updated: string | null
  readingMinutes: number
}

export function BlogIndex() {
  usePageTitle('Blog — practical guides to indexing and backlinks | Indexora')
  const q = useQuery({ queryKey: ['blog'], queryFn: () => api.get<{ posts: PostMeta[] }>('/api/blog') })
  return (
    <Page>
      <Container className="max-w-3xl py-16 sm:py-20">
        <p className="eyebrow">Blog</p>
        <h1 className="display mt-3 text-[38px] leading-tight font-semibold text-fg sm:text-[48px]">Practical SEO, without the fluff.</h1>
        <p className="mt-4 max-w-xl text-[16px] text-fg-3">Short, specific guides to getting pages indexed, keeping backlinks alive and catching technical problems before they cost traffic.</p>
        <div className="mt-12 divide-y divide-line border-y border-line">
          {q.isLoading &&
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="py-7">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="mt-3 h-4 w-full" />
              </div>
            ))}
          {q.data?.posts.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} className="group block py-7">
              <div className="text-[12.5px] text-fg-4">
                {formatDate(p.date)} · {p.readingMinutes} min read
              </div>
              <h2 className="heading mt-1.5 text-[21px] font-semibold text-fg group-hover:text-primary-ink">{p.title}</h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-fg-3">{p.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary-ink">
                Read <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
          {q.data?.posts.length === 0 && <p className="py-7 text-[14px] text-fg-3">The first guides are on their way.</p>}
        </div>
      </Container>
    </Page>
  )
}

export function BlogPost() {
  const { slug = '' } = useParams()
  const q = useQuery({
    queryKey: ['blog', slug],
    queryFn: () => api.get<{ post: PostMeta & { html: string }; more: PostMeta[] }>(`/api/blog/${encodeURIComponent(slug)}`),
    retry: false,
  })
  const p = q.data?.post
  usePageTitle(p ? `${p.title} | Indexora` : 'Blog | Indexora')
  if (q.isError) return <NotFound />

  return (
    <Page>
      <Container className="max-w-[720px] py-14 sm:py-16">
        <Link to="/blog" className="inline-flex items-center gap-1 text-[13px] font-medium text-fg-3 hover:text-fg">
          <ArrowLeft className="size-3.5" /> All guides
        </Link>
        {!p ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-10 w-5/6" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-8 h-64 w-full" />
          </div>
        ) : (
          <article>
            <h1 className="display mt-5 text-[34px] leading-[1.15] font-semibold text-fg sm:text-[42px]">{p.title}</h1>
            <p className="mt-4 text-[13px] text-fg-4">
              {p.updated ? `Updated ${formatDate(p.updated)}` : formatDate(p.date)} · {p.readingMinutes} min read
            </p>
            <div className="prose-ix mt-10" dangerouslySetInnerHTML={{ __html: p.html }} />
          </article>
        )}

        <div className="mt-14 rounded-2xl border border-primary/25 bg-primary-soft p-6">
          <h2 className="text-[18px] font-semibold text-fg">Let Indexora do the checking.</h2>
          <p className="mt-1.5 text-[14.5px] text-fg-2">Index status, indexability and every backlink, verified daily — with an alert the day something changes. Free for one site.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/signup">
              <Button variant="primary" rightIcon={<ArrowRight />}>
                Start free
              </Button>
            </Link>
            <Link to="/tools">
              <Button variant="secondary">Try the free tools</Button>
            </Link>
          </div>
        </div>

        {!!q.data?.more.length && (
          <div className="mt-14">
            <h2 className="eyebrow">Read next</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {q.data.more.map((m) => (
                <Link key={m.slug} to={`/blog/${m.slug}`} className="group rounded-2xl border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card">
                  <h3 className="text-[15px] font-semibold text-fg group-hover:text-primary-ink">{m.title}</h3>
                  <p className="mt-1.5 line-clamp-3 text-[13px] text-fg-3">{m.description}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </Container>
    </Page>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
