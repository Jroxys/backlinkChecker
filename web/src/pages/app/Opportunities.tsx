import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Bookmark, BookmarkCheck, Mail, Swords, Unlink, MessageSquareQuote, LibraryBig, Undo2, CornerUpRight, Copy, Sparkles, Plus } from 'lucide-react'
import type { Opportunity } from '@/api/types'
import { useOpportunities, useMe } from '@/api/hooks'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/router'
import { useProject } from '@/lib/project'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Segmented } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { Input, Label } from '@/components/ui/Controls'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { DomainIcon } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'

const kinds: Record<Opportunity['kind'], { label: string; icon: typeof Swords }> = {
  reclaim: { label: 'Reclaim lost link', icon: Undo2 },
  redirect: { label: 'Redirect fix', icon: CornerUpRight },
  'competitor-gap': { label: 'Competitor gap', icon: Swords },
  'unlinked-mention': { label: 'Unlinked mention', icon: MessageSquareQuote },
  'broken-link': { label: 'Broken link', icon: Unlink },
  'resource-page': { label: 'Resource page', icon: LibraryBig },
}

type KindFilter = 'all' | Opportunity['kind']

export function Opportunities() {
  const { project } = useProject()
  const me = useMe().data
  const q = useOpportunities(project?.id)
  const [kind, setKind] = useState<KindFilter>('all')
  const [outreach, setOutreach] = useState<Opportunity | null>(null)
  const [fix, setFix] = useState<Opportunity | null>(null)
  const storeKey = `indexora-saved-opps-${project?.id}`
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const toast = useToast()

  useEffect(() => {
    try {
      setSaved(new Set(JSON.parse(localStorage.getItem(storeKey) ?? '[]')))
    } catch {
      setSaved(new Set())
    }
  }, [storeKey])
  const toggleSave = (id: string) =>
    setSaved((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      try {
        localStorage.setItem(storeKey, JSON.stringify([...n]))
      } catch {
        /* ignore */
      }
      return n
    })

  const all = useMemo(() => q.data?.opportunities ?? [], [q.data])
  const present = (Object.keys(kinds) as Opportunity['kind'][]).filter((k) => all.some((o) => o.kind === k))
  const list = all.filter((o) => kind === 'all' || o.kind === kind)
  const gap = q.data?.gapStatus

  return (
    <>
      <PageHeader
        eyebrow={
          <Badge tone="primary" icon={<Sparkles />}>
            Ranked by impact
          </Badge>
        }
        title={q.isLoading ? 'Backlink opportunities' : `${all.length} backlink ${all.length === 1 ? 'opportunity' : 'opportunities'} found`}
        description="Each one explains why it’s worth your time — starting with links you can win back without any cold outreach."
      />

      {present.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented<KindFilter>
            value={kind}
            onChange={setKind}
            className="max-w-full overflow-x-auto"
            items={[{ value: 'all' as KindFilter, label: `All (${all.length})` }, ...present.map((k) => ({ value: k as KindFilter, label: `${kinds[k].label} (${all.filter((o) => o.kind === k).length})` }))]}
          />
        </div>
      )}

      {gap && gap !== 'ok' && (
        <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Swords className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="text-[13px] text-fg-2">
              {gap === 'no_competitors' ? (
                <>
                  <span className="font-medium text-fg">Add competitors to find gap opportunities.</span> We’ll list sites that link to them but not to you.
                </>
              ) : gap === 'no_provider' ? (
                <>
                  <span className="font-medium text-fg">Competitor gap analysis is coming to Pro.</span> It needs a commercial backlink index, which we switch on as our first Pro customers arrive. Reclaim and redirect opportunities below are already live.
                </>
              ) : (
                <>
                  <span className="font-medium text-fg">Competitor data is temporarily unavailable.</span> Try again later.
                </>
              )}
            </div>
          </div>
          {gap === 'no_competitors' && (
            <Link to="/app/competitors">
              <Button size="sm" leftIcon={<Plus />}>
                Add competitors
              </Button>
            </Link>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {q.isLoading &&
          [0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <div className="flex gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="mt-5 h-4 w-3/4" />
              <Skeleton className="mt-3 h-14 w-full rounded-lg" />
            </Card>
          ))}
        {!q.isLoading && list.length === 0 && (
          <Card className="lg:col-span-2">
            <EmptyState
              icon={<Sparkles />}
              title="No opportunities right now"
              description="That’s good news: no lost links to reclaim and no backlinks pointing at broken pages. We re-check daily and list new opportunities here as soon as they appear."
              action={
                <Link to="/app/backlinks">
                  <Button size="sm">Review backlinks</Button>
                </Link>
              }
            />
          </Card>
        )}
        {list.map((o, i) => {
          const K = kinds[o.kind]
          const isSaved = saved.has(o.id)
          return (
            <Card key={o.id} interactive className="flex animate-rise flex-col" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
              <div className="flex items-start justify-between gap-3 p-5 pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <DomainIcon domain={o.domain} size={36} />
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-semibold text-fg">{o.domain}</div>
                    <div className="mt-0.5 text-[12px] text-fg-3">
                      {o.authority !== null ? (
                        <span className="tnum">
                          Authority <span className="font-semibold text-fg">{o.authority}</span>
                        </span>
                      ) : (
                        'Authority unknown'
                      )}
                    </div>
                  </div>
                </div>
                <Badge tone={o.kind === 'reclaim' || o.kind === 'redirect' ? 'primary' : 'outline'} icon={<K.icon />}>
                  {K.label}
                </Badge>
              </div>
              <div className="px-5 pt-4">
                <h3 className="text-[14px] leading-snug font-medium text-fg">{o.headline}</h3>
                <div className="mt-3 rounded-lg border border-line-soft bg-surface-2 p-3.5">
                  <div className="mb-1 text-[11px] font-semibold tracking-wide text-primary-ink uppercase">Why it matters</div>
                  <p className="text-[13px] leading-relaxed text-fg-2">{o.reason}</p>
                </div>
              </div>
              {o.competitors.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-5 pt-4 text-[12px] text-fg-3">
                  <span>Links to</span>
                  {o.competitors.map((c) => (
                    <span key={c} className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-medium text-fg-2">
                      {c}
                    </span>
                  ))}
                  <span>— not you</span>
                </div>
              )}
              <div className="min-h-5 flex-1" />
              <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-5 py-3.5">
                {o.sourceUrl && (
                  <a href={o.sourceUrl} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" rightIcon={<ArrowUpRight />}>
                      View Source
                    </Button>
                  </a>
                )}
                <Button size="sm" variant={isSaved ? 'soft' : 'secondary'} leftIcon={isSaved ? <BookmarkCheck /> : <Bookmark />} onClick={() => (toggleSave(o.id), toast({ title: isSaved ? 'Removed from your list' : 'Added to your list', description: o.domain }))}>
                  {isSaved ? 'Saved' : 'Save'}
                </Button>
                {o.kind === 'redirect' ? (
                  <Button size="sm" variant="primary" leftIcon={<CornerUpRight />} className="ml-auto" onClick={() => setFix(o)}>
                    Show the fix
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" leftIcon={<Mail />} className="ml-auto" onClick={() => setOutreach(o)}>
                    Create Outreach
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <OutreachModal o={outreach} name={me?.user.name ?? ''} domain={project?.domain ?? ''} onClose={() => setOutreach(null)} />
      <RedirectModal o={fix} onClose={() => setFix(null)} />
    </>
  )
}

function emailFor(o: Opportunity, name: string, domain: string) {
  const first = name.split(' ')[0] || 'there'
  const target = o.targetUrl ?? `https://${domain}/`
  if (o.kind === 'reclaim')
    return {
      subject: `Quick question about your page on ${o.domain}`,
      body: `Hi,\n\nThanks again for featuring ${domain} on your site — it sent us some great readers.\n\nI noticed the link on ${o.sourceUrl} seems to have disappeared in a recent update. Was that intentional? If it was an oversight, here’s the URL in case it helps:\n${target}\n\nEither way, thanks for the work you put into that page.\n\nBest,\n${first}`,
    }
  if (o.kind === 'unlinked-mention')
    return {
      subject: `Thanks for mentioning ${domain}`,
      body: `Hi,\n\nThanks so much for mentioning us in your article — it made our week.\n\nWould you consider linking the mention so readers can find us? Here’s the page: ${target}\n\nBest,\n${first}`,
    }
  return {
    subject: 'A resource for your readers',
    body: `Hi,\n\nI came across ${o.sourceUrl ?? o.domain} and really liked how practical it is.\n\nWe recently published ${target}, which covers the topic in depth and is kept up to date. If it’s useful, it could be a good addition for your readers.\n\nEither way, thanks for the great work.\n\nBest,\n${first}`,
  }
}

function OutreachModal({ o, name, domain, onClose }: { o: Opportunity | null; name: string; domain: string; onClose: () => void }) {
  const toast = useToast()
  const draft = o ? emailFor(o, name, domain) : { subject: '', body: '' }
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  useEffect(() => {
    setSubject(draft.subject)
    setBody(draft.body)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o?.id])
  return (
    <Modal
      open={!!o}
      onClose={onClose}
      size="lg"
      title="Create outreach"
      description="A short, specific email works best. Edit it, then send it from your own inbox."
      footer={
        <>
          <Button
            variant="ghost"
            leftIcon={<Copy />}
            onClick={() => {
              navigator.clipboard?.writeText(`Subject: ${subject}\n\n${body}`).catch(() => {})
              toast({ title: 'Email copied to clipboard' })
            }}
          >
            Copy
          </Button>
          <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`} onClick={onClose}>
            <Button variant="primary" leftIcon={<Mail />}>
              Open in email app
            </Button>
          </a>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <Label hint="Personalised from the opportunity">Message</Label>
          <textarea
            rows={11}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full resize-none rounded-lg border border-line bg-surface p-3 text-[13.5px] leading-relaxed text-fg shadow-xs focus:border-primary focus:ring-3 focus:ring-[var(--ring)] focus:outline-none"
          />
        </div>
      </div>
    </Modal>
  )
}

function RedirectModal({ o, onClose }: { o: Opportunity | null; onClose: () => void }) {
  const toast = useToast()
  const [server, setServer] = useState<'nginx' | 'apache' | 'netlify'>('nginx')
  let from = '/old-page'
  try {
    if (o?.targetUrl) from = new URL(o.targetUrl).pathname
  } catch {
    /* keep */
  }
  const snippet =
    server === 'nginx' ? `location = ${from} {\n  return 301 /new-page;\n}` : server === 'apache' ? `Redirect 301 ${from} /new-page` : `[[redirects]]\n  from = "${from}"\n  to = "/new-page"\n  status = 301`
  return (
    <Modal open={!!o} onClose={onClose} title="Recover this link with a redirect" description="Replace /new-page with the closest live page on your site. Google passes the link’s value through a 301.">
      <Segmented
        value={server}
        onChange={setServer}
        className="mb-3"
        items={[
          { value: 'nginx', label: 'nginx' },
          { value: 'apache', label: 'Apache' },
          { value: 'netlify', label: 'Netlify' },
        ]}
      />
      <pre className={cn('overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-[12.5px] text-fg')}>{snippet}</pre>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          leftIcon={<Copy />}
          onClick={() => {
            navigator.clipboard?.writeText(snippet).catch(() => {})
            toast({ title: 'Redirect rule copied' })
          }}
        >
          Copy rule
        </Button>
      </div>
      <p className="mt-3 text-[12.5px] text-fg-3">Using WordPress? The free “Redirection” plugin does the same without touching server config.</p>
    </Modal>
  )
}
