import { Badge } from '@/components/ui/Badge'
import { useState } from 'react'
import { Filter, MoreHorizontal, RefreshCw, X, Check, Minus, Link as LinkIcon, FileSearch, Plus, ExternalLink } from 'lucide-react'
import type { IndexStatus, UrlItem } from '@/api/types'
import { useUrls, useAction } from '@/api/hooks'
import { cn } from '@/lib/cn'
import { useNavigate } from '@/lib/router'
import { statusMeta, statusOrder } from '@/lib/status'
import { Table, THead, TH, TR, TD } from '@/components/ui/Table'
import { Checkbox, SearchInput } from '@/components/ui/Controls'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Dropdown, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Dropdown'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Tooltip } from '@/components/ui/Tooltip'
import { timeAgo, formatDate } from '@/utils/format'
import { HttpBadge, IndexStatusBadge } from './StatusBadge'

type SortKey = 'url' | 'status' | 'http' | 'lastCrawl' | 'lastChecked'

/** Server-paginated table of monitored URLs for one project. */
export function UrlTable({
  projectId,
  pageSize = 10,
  initialStatus,
  dense,
  onAddUrls,
}: {
  projectId: string | undefined
  pageSize?: number
  initialStatus?: IndexStatus[]
  dense?: boolean
  onAddUrls?: () => void
}) {
  const [q, setQ] = useState('')
  const [statuses, setStatuses] = useState<IndexStatus[]>(initialStatus ?? [])
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'lastChecked', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const nav = useNavigate()
  const query = useUrls(projectId, { page, pageSize, q: q || undefined, status: statuses, sort: sort.key, dir: sort.dir })
  const recheck = useAction((s) => s.recheckUrl, { invalidate: ['urls', 'url', 'projects'], success: () => ({ title: 'Re-checked', description: 'Latest results are in the table.' }) })

  const rows = query.data?.urls ?? []
  const total = query.data?.total ?? 0
  const counts = query.data?.counts ?? {}
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someOnPage = rows.some((r) => selected.has(r.id))
  const toggleSort = (key: SortKey) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))
    setPage(1)
  }
  const sorted = (k: SortKey) => (sort.key === k ? sort.dir : false)

  const recheckSelected = async () => {
    const ids = [...selected]
    setSelected(new Set())
    for (const id of ids.slice(0, 20)) await recheck.mutateAsync([id]).catch(() => undefined)
  }

  return (
    <div>
      <div className="flex flex-col gap-3 px-5 py-3.5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v)
              setPage(1)
            }}
            placeholder="Filter by URL or title…"
            className="w-full sm:w-72"
          />
          <Dropdown
            width={260}
            trigger={({ toggle, open }) => (
              <Button size="md" variant="secondary" onClick={toggle} leftIcon={<Filter />} className={cn(open && 'bg-surface-2')}>
                Status
                {statuses.length > 0 && <span className="tnum rounded bg-primary-soft px-1.5 text-[11px] text-primary-ink">{statuses.length}</span>}
              </Button>
            )}
          >
            {() => (
              <>
                <MenuLabel>Index status</MenuLabel>
                {statusOrder.map((s) => (
                  <MenuItem
                    key={s}
                    selected={statuses.includes(s)}
                    hint={String(counts[s] ?? 0)}
                    onClick={() => {
                      setStatuses((xs) => (xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s]))
                      setPage(1)
                    }}
                  >
                    {statusMeta[s].label}
                  </MenuItem>
                ))}
                {statuses.length > 0 && (
                  <>
                    <MenuSeparator />
                    <MenuItem icon={<X />} onClick={() => setStatuses([])}>
                      Clear filter
                    </MenuItem>
                  </>
                )}
              </>
            )}
          </Dropdown>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatuses((xs) => xs.filter((x) => x !== s))}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed border-line-strong px-2 text-[12px] text-fg-2 hover:bg-surface-3"
            >
              {statusMeta[s].label}
              <X className="size-3 text-fg-4" />
            </button>
          ))}
        </div>
        {onAddUrls && (
          <Button variant="secondary" size="md" leftIcon={<Plus />} onClick={onAddUrls}>
            Add URLs
          </Button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="mx-5 mb-3 flex animate-pop flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary-soft px-3 py-2">
          <span className="tnum text-[13px] font-medium text-primary-ink">{selected.size} selected</span>
          <span className="mx-1 h-4 w-px bg-primary/25" />
          <Button size="xs" variant="ghost" leftIcon={<RefreshCw />} loading={recheck.isPending} onClick={recheckSelected}>
            Re-check now
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[12.5px] font-medium text-primary-ink hover:underline">
            Clear
          </button>
        </div>
      )}

      {query.isLoading ? (
        <TableSkeleton rows={Math.min(pageSize, 8)} cols={6} />
      ) : rows.length === 0 ? (
        q || statuses.length ? (
          <EmptyState
            icon={<FileSearch />}
            title="No URLs match these filters"
            description="Try removing a status filter or searching for a shorter path, like “/blog”."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setQ('')
                  setStatuses([])
                }}
              >
                Reset filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<FileSearch />}
            title="No URLs monitored yet"
            description="We add your homepage and every URL in your sitemaps automatically. You can also add important pages by hand."
            action={onAddUrls && <Button size="sm" variant="primary" leftIcon={<Plus />} onClick={onAddUrls}>Add URLs</Button>}
          />
        )
      ) : (
        <div className={cn('transition-opacity', query.isPlaceholderData && 'opacity-60')}>
          <Table minWidth={980}>
            <THead>
              <TH className="w-10 !pr-0">
                <Checkbox
                  label="Select all on page"
                  checked={allOnPage}
                  indeterminate={!allOnPage && someOnPage}
                  onChange={() =>
                    setSelected((s) => {
                      const n = new Set(s)
                      rows.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id)))
                      return n
                    })
                  }
                />
              </TH>
              <TH sortable sorted={sorted('url')} onSort={() => toggleSort('url')}>
                URL
              </TH>
              <TH sortable sorted={sorted('status')} onSort={() => toggleSort('status')}>
                Status
              </TH>
              <TH sortable sorted={sorted('http')} onSort={() => toggleSort('http')}>
                HTTP
              </TH>
              <TH>Indexability</TH>
              <TH>Canonical</TH>
              <TH sortable sorted={sorted('lastCrawl')} onSort={() => toggleSort('lastCrawl')}>
                Last Crawl
              </TH>
              <TH sortable sorted={sorted('lastChecked')} onSort={() => toggleSort('lastChecked')}>
                Last Checked
              </TH>
              <TH className="w-10" />
            </THead>
            <tbody>
              {rows.map((u) => (
                <UrlRow
                  key={u.id}
                  u={u}
                  dense={dense}
                  selected={selected.has(u.id)}
                  onSelect={() =>
                    setSelected((s) => {
                      const n = new Set(s)
                      if (n.has(u.id)) n.delete(u.id)
                      else n.add(u.id)
                      return n
                    })
                  }
                  onOpen={() => nav(`/app/indexing/${u.id}`)}
                  onRecheck={() => recheck.mutate([u.id])}
                />
              ))}
            </tbody>
          </Table>
          <div className="border-t border-line">
            <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  )
}

function Indexability({ u }: { u: UrlItem }) {
  if (u.indexable === null) return <span className="text-fg-4">Checking…</span>
  if (u.indexable)
    return (
      <span className="inline-flex items-center gap-1.5 text-fg-2">
        <Check className="size-3.5 text-success" /> Indexable
      </span>
    )
  const why =
    u.robots === 'noindex' ? 'Noindex' : u.robots === 'blocked' ? 'Robots blocked' : u.http && u.http >= 300 && u.http < 400 ? 'Redirects' : u.http && u.http >= 400 ? `HTTP ${u.http}` : u.canonical === 'other' ? 'Canonicalised' : 'Non-indexable'
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-3">
      <Minus className="size-3.5 text-fg-4" />
      {why}
    </span>
  )
}

function UrlRow({ u, dense, selected, onSelect, onOpen, onRecheck }: { u: UrlItem; dense?: boolean; selected: boolean; onSelect: () => void; onOpen: () => void; onRecheck: () => void }) {
  return (
    <TR selected={selected} onClick={onOpen}>
      <TD className="w-10 !pr-0">
        <Checkbox label={`Select ${u.path}`} checked={selected} onChange={onSelect} />
      </TD>
      <TD className={cn('max-w-[340px]', dense ? 'h-11' : 'h-13')}>
        <div className="min-w-0">
          <div className="truncate font-medium text-fg group-hover:text-primary-ink">{u.path}</div>
          {!dense && <div className="truncate text-[12px] text-fg-4">{u.title ?? '—'}</div>}
        </div>
      </TD>
      <TD>
        {u.paused ? <Badge tone="outline">Paused</Badge> : <IndexStatusBadge status={u.status} />}
      </TD>
      <TD>
        <HttpBadge code={u.http} />
      </TD>
      <TD>
        <Indexability u={u} />
      </TD>
      <TD>
        {u.canonical === 'self' ? (
          <span className="text-fg-2">Self</span>
        ) : u.canonical === 'other' ? (
          <Tooltip content={`Canonicalised to ${u.canonicalUrl}`}>
            <span className="inline-flex items-center gap-1 text-warning-ink">
              <LinkIcon className="size-3" /> Other
            </span>
          </Tooltip>
        ) : u.canonical === 'missing' ? (
          <span className="text-error-ink">Missing</span>
        ) : (
          <span className="text-fg-4">—</span>
        )}
      </TD>
      <TD className="tnum">
        {u.lastCrawl ? (
          <Tooltip content={`Googlebot: ${formatDate(u.lastCrawl)}`}>
            <span>{timeAgo(u.lastCrawl)}</span>
          </Tooltip>
        ) : (
          <span className="text-fg-4">{u.status === 'unknown' ? '—' : 'Never'}</span>
        )}
      </TD>
      <TD className="tnum">{u.lastChecked ? timeAgo(u.lastChecked) : <span className="text-fg-4">Queued</span>}</TD>
      <TD className="w-10" onClick={(e) => e.stopPropagation()}>
        <Dropdown
          align="right"
          width={200}
          trigger={({ toggle }) => (
            <button onClick={toggle} aria-label="Row actions" className="rounded-md p-1 text-fg-4 opacity-60 transition group-hover:opacity-100 hover:bg-surface-3 hover:text-fg">
              <MoreHorizontal className="size-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<FileSearch />} onClick={onOpen}>
                Inspect URL
              </MenuItem>
              <MenuItem
                icon={<RefreshCw />}
                onClick={() => {
                  onRecheck()
                  close()
                }}
              >
                Re-check now
              </MenuItem>
              <MenuItem icon={<ExternalLink />} onClick={() => (window.open(u.url, '_blank', 'noopener'), close())}>
                Open live page
              </MenuItem>
            </>
          )}
        </Dropdown>
      </TD>
    </TR>
  )
}
