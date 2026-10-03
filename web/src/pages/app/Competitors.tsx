import { useState } from 'react'
import { Plus, Swords, Trash2, ArrowRight, Info } from 'lucide-react'
import { useAction, useCompetitors, useMe, useOpportunities } from '@/api/hooks'
import { useSource } from '@/api/source'
import { Link } from '@/lib/router'
import { useProject } from '@/lib/project'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Controls'
import { DomainIcon } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, THead, TH, TR, TD } from '@/components/ui/Table'
import { AuthorityPill } from '@/components/domain/StatusBadge'
import { formatDate } from '@/utils/format'
import { CompetitorsDemo } from './CompetitorsDemo'

export function Competitors() {
  const { mode } = useSource()
  return mode === 'demo' ? <CompetitorsDemo /> : <CompetitorsLive />
}

function CompetitorsLive() {
  const { project } = useProject()
  const me = useMe().data
  const list = useCompetitors(project?.id)
  const opps = useOpportunities(project?.id)
  const [domain, setDomain] = useState('')
  const add = useAction((s) => s.addCompetitor, { invalidate: ['competitors', 'opportunities'], success: () => ({ title: 'Competitor added' }) })
  const remove = useAction((s) => s.deleteCompetitor, { invalidate: ['competitors', 'opportunities'], success: () => ({ title: 'Competitor removed' }) })
  const max = me?.plan.limits.competitorsPerProject ?? 0
  const comps = list.data?.competitors ?? []
  const gap = (opps.data?.opportunities ?? []).filter((o) => o.kind === 'competitor-gap')

  return (
    <>
      <PageHeader title="Competitors" description={project ? `Sites competing with ${project.domain} for the same links and rankings.` : ''} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Tracked competitors" description={max ? `${comps.length} of ${max} on your plan` : 'Available from the Starter plan'} icon={<Swords />} />
          <div className="p-5">
            {max > 0 && comps.length < max && (
              <form
                className="mb-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (project) add.mutateAsync([project.id, domain]).then(() => setDomain(''), () => undefined)
                }}
              >
                <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="rival.com" />
                <Button type="submit" variant="primary" leftIcon={<Plus />} disabled={!/\w+\.\w+/.test(domain)} loading={add.isPending}>
                  Add
                </Button>
              </form>
            )}
            {max === 0 && (
              <Link to="/app/settings?tab=billing">
                <Button variant="primary" className="mb-4 w-full" rightIcon={<ArrowRight />}>
                  Upgrade to track competitors
                </Button>
              </Link>
            )}
            {list.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : comps.length === 0 ? (
              <p className="text-[13px] text-fg-3">No competitors yet. Add the 2–3 sites you most often see above you in Google.</p>
            ) : (
              <ul className="divide-y divide-line-soft rounded-lg border border-line">
                {comps.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                    <DomainIcon domain={c.domain} size={22} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-fg">{c.domain}</div>
                      <div className="text-[11.5px] text-fg-4">Added {formatDate(c.createdAt)}</div>
                    </div>
                    <button aria-label={`Remove ${c.domain}`} onClick={() => project && remove.mutate([project.id, c.id])} className="rounded-md p-1 text-fg-4 hover:bg-error-soft hover:text-error-ink">
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Backlink gap" description="Sites linking to your competitors but not to you — your warmest outreach targets" />
          {comps.length === 0 ? (
            <EmptyState icon={<Swords />} title="Add a competitor to see the gap" description="We’ll compare referring domains and list the ones you’re missing." />
          ) : opps.isLoading ? (
            <div className="p-5">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : gap.length === 0 && opps.data?.gapStatus !== 'ok' ? (
            <EmptyState
              icon={<Info />}
              title="Mapping who links to them"
              description="Our link map grows with every page we crawl and with each import of the Common Crawl web graph. Sites linking to your competitors appear here as soon as we find them."
            />
          ) : gap.length === 0 ? (
            <EmptyState icon={<Swords />} title="No gap found" description="Every domain linking to your competitors also links to you. Impressive." />
          ) : (
            <div className="mt-3">
              <Table minWidth={620}>
                <THead>
                  <TH>Referring domain</TH>
                  <TH>Found</TH>
                  <TH>Links to</TH>
                  <TH />
                </THead>
                <tbody>
                  {gap.map((g) => (
                    <TR key={g.id}>
                      <TD>
                        <span className="flex items-center gap-2">
                          <DomainIcon domain={g.domain} />
                          <span className="font-medium text-fg">{g.domain}</span>
                        </span>
                      </TD>
                      <TD>{g.authority !== null ? <AuthorityPill value={g.authority} /> : <span className="text-[12.5px] text-fg-3">{g.evidence === 'page' ? 'Linking page' : 'Site-level'}</span>}</TD>
                      <TD>{g.competitors.join(', ')}</TD>
                      <TD align="right">
                        <Link to="/app/opportunities" className="text-[12.5px] font-medium text-primary-ink hover:underline">
                          Outreach
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
