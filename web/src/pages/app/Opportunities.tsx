import { useMemo, useState } from 'react'
import { ArrowUpRight, Bookmark, BookmarkCheck, Mail, Swords, Unlink, MessageSquareQuote, LibraryBig, Sparkles, Target, Copy } from 'lucide-react'
import type { Opportunity } from '@/types'
import { cn } from '@/lib/cn'
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Segmented } from '@/components/ui/Tabs'
import { Select } from '@/components/ui/Dropdown'
import { Modal } from '@/components/ui/Modal'
import { Input, Label } from '@/components/ui/Controls'
import { Skeleton } from '@/components/ui/Skeleton'
import { DomainIcon } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { opportunities } from '@/data/opportunities'
import { formatCompact } from '@/utils/format'

const kinds = {
  'competitor-gap': { label: 'Competitor gap', icon: Swords },
  'unlinked-mention': { label: 'Unlinked mention', icon: MessageSquareQuote },
  'broken-link': { label: 'Broken link', icon: Unlink },
  'resource-page': { label: 'Resource page', icon: LibraryBig },
} as const

type KindFilter = 'all' | Opportunity['kind']

export function Opportunities() {
  const loading = useSimulatedLoad(650)
  const [kind, setKind] = useState<KindFilter>('all')
  const [sort, setSort] = useState<'relevance' | 'authority' | 'easy'>('relevance')
  const [saved, setSaved] = useState<Set<string>>(new Set(['op2']))
  const [outreach, setOutreach] = useState<Opportunity | null>(null)
  const toast = useToast()

  const list = useMemo(() => {
    const diff = { Easy: 0, Moderate: 1, Hard: 2 }
    return opportunities
      .filter((o) => kind === 'all' || o.kind === kind)
      .sort((a, b) =>
        sort === 'authority' ? b.authority - a.authority : sort === 'easy' ? diff[a.difficulty] - diff[b.difficulty] || b.relevance - a.relevance : b.relevance - a.relevance,
      )
  }, [kind, sort])

  const count = (k: Opportunity['kind']) => opportunities.filter((o) => o.kind === k).length

  return (
    <>
      <PageHeader
        eyebrow={
          <Badge tone="primary" icon={<Sparkles />}>
            Updated after last night’s competitor scan
          </Badge>
        }
        title={`${opportunities.length} backlink opportunities found`}
        description="Ranked by how relevant the source is to your content and how likely a link is. Each one explains why it’s worth your time."
      />

      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {(Object.keys(kinds) as Opportunity['kind'][]).map((k) => {
          const K = kinds[k]
          return (
            <button
              key={k}
              onClick={() => setKind(kind === k ? 'all' : k)}
              className={cn('flex items-center gap-3 bg-surface px-4 py-3.5 text-left transition-colors hover:bg-surface-2', kind === k && 'bg-primary-soft hover:bg-primary-soft')}
            >
              <span className={cn('flex size-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-2', kind === k && 'border-primary/30 text-primary')}>
                <K.icon className="size-4" />
              </span>
              <div>
                <div className="tnum text-[18px] leading-none font-semibold text-fg">{count(k)}</div>
                <div className="mt-1 text-[12px] text-fg-3">{K.label}s</div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented<KindFilter>
          value={kind}
          onChange={setKind}
          className="max-w-full overflow-x-auto"
          items={[
            { value: 'all', label: 'All' },
            { value: 'competitor-gap', label: 'Gaps' },
            { value: 'unlinked-mention', label: 'Mentions' },
            { value: 'broken-link', label: 'Broken' },
            { value: 'resource-page', label: 'Resources' },
          ]}
        />
        <Select
          size="sm"
          align="right"
          label="Sort"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'relevance', label: 'Relevance' },
            { value: 'authority', label: 'Authority' },
            { value: 'easy', label: 'Easiest first' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
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
                <div className="mt-5 flex gap-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
              </Card>
            ))
          : list.map((o, i) => {
              const K = kinds[o.kind]
              const isSaved = saved.has(o.id)
              return (
                <Card key={o.id} interactive className="flex animate-rise flex-col" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="flex items-start justify-between gap-3 p-5 pb-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <DomainIcon domain={o.domain} size={36} />
                      <div className="min-w-0">
                        <div className="truncate text-[14.5px] font-semibold text-fg">{o.domain}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-fg-3">
                          <span className="tnum">
                            Authority <span className="font-semibold text-fg">{o.authority}</span>
                          </span>
                          <span className="text-fg-4">·</span>
                          <span className="tnum">{formatCompact(o.traffic)} visits/mo</span>
                        </div>
                      </div>
                    </div>
                    <Badge tone="outline" icon={<K.icon />}>
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

                  <div className="grid grid-cols-3 gap-3 px-5 pt-4">
                    <div>
                      <div className="text-[11.5px] text-fg-4">Relevance</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="tnum text-[13px] font-semibold text-fg">{o.relevance}%</span>
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${o.relevance}%` }} />
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11.5px] text-fg-4">Difficulty</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-fg">
                        <span className="flex gap-0.5">
                          {[0, 1, 2].map((d) => (
                            <span
                              key={d}
                              className={cn('h-2.5 w-1 rounded-full', d <= { Easy: 0, Moderate: 1, Hard: 2 }[o.difficulty] ? 'bg-fg-2' : 'bg-line-strong')}
                            />
                          ))}
                        </span>
                        {o.difficulty}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11.5px] text-fg-4">Pitch page</div>
                      <div className="mt-1 flex items-center gap-1 truncate font-mono text-[12px] text-fg-2">
                        <Target className="size-3 shrink-0 text-fg-4" />
                        <span className="truncate">{o.suggestedTarget}</span>
                      </div>
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

                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line-soft px-5 py-3.5 mt-5">
                    <a href={`https://${o.domain}`} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" rightIcon={<ArrowUpRight />}>
                        View Source
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      variant={isSaved ? 'soft' : 'secondary'}
                      leftIcon={isSaved ? <BookmarkCheck /> : <Bookmark />}
                      onClick={() => {
                        setSaved((s) => {
                          const n = new Set(s)
                          isSaved ? n.delete(o.id) : n.add(o.id)
                          return n
                        })
                        toast({ title: isSaved ? 'Removed from your list' : 'Added to opportunities', description: o.domain })
                      }}
                    >
                      {isSaved ? 'Saved' : 'Add to Opportunities'}
                    </Button>
                    <Button size="sm" variant="primary" leftIcon={<Mail />} className="ml-auto" onClick={() => setOutreach(o)}>
                      Create Outreach
                    </Button>
                  </div>
                </Card>
              )
            })}
      </div>

      <Modal
        open={!!outreach}
        onClose={() => setOutreach(null)}
        size="lg"
        title="Create outreach"
        description={outreach ? `Drafted from the context of this ${kinds[outreach.kind].label.toLowerCase()}. Edit before sending.` : ''}
        footer={
          <>
            <Button variant="ghost" leftIcon={<Copy />} onClick={() => toast({ title: 'Email copied to clipboard' })}>
              Copy
            </Button>
            <Button
              variant="primary"
              leftIcon={<Mail />}
              onClick={() => {
                toast({ title: 'Outreach scheduled', description: `Follow-up reminder set for 5 days. (${outreach?.domain})` })
                setOutreach(null)
              }}
            >
              Schedule send
            </Button>
          </>
        }
      >
        {outreach && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>To</Label>
                <Input defaultValue={`editor@${outreach.domain}`} />
              </div>
              <div>
                <Label>Subject</Label>
                <Input
                  defaultValue={
                    outreach.kind === 'broken-link'
                      ? 'Broken link on your article (+ a replacement)'
                      : outreach.kind === 'unlinked-mention'
                        ? 'Thanks for mentioning Northwind'
                        : 'A resource for your readers'
                  }
                />
              </div>
            </div>
            <div>
              <Label hint="Personalised from opportunity data">Message</Label>
              <textarea
                rows={9}
                className="w-full resize-none rounded-lg border border-line bg-surface p-3 text-[13.5px] leading-relaxed text-fg shadow-xs focus:border-primary focus:ring-3 focus:ring-[var(--ring)] focus:outline-none"
                defaultValue={`Hi there,

I'm Ömer from Northwind Labs. ${
                  outreach.kind === 'broken-link'
                    ? 'While reading your article I noticed one of the outbound links now returns a 404.'
                    : outreach.kind === 'unlinked-mention'
                      ? 'Thanks so much for mentioning us in your recent piece — it made our week.'
                      : 'I came across your article and really liked how practical it is.'
                }

We recently published https://northwindlabs.com${outreach.suggestedTarget}, which covers the topic in depth and is kept up to date for 2026. ${
                  outreach.kind === 'unlinked-mention' ? 'Would you consider linking the mention so readers can find us?' : 'If it’s useful, it could be a good fit for your readers.'
                }

Either way, thanks for the great work.

Best,
Ömer`}
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
