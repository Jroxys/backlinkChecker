import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Filter, MoreHorizontal, RefreshCw, Send, X, Check, Minus, Link as LinkIcon, FileSearch } from 'lucide-react'
import type { IndexStatus, UrlRecord } from '@/types'
import { cn } from '@/lib/cn'
import { Table, THead, TH, TR, TD } from '@/components/ui/Table'
import { Checkbox, SearchInput } from '@/components/ui/Controls'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Dropdown, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Dropdown'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { statusMeta } from '@/data/urls'
import { timeAgo, formatDate, formatNumber } from '@/utils/format'
import { HttpBadge, IndexStatusBadge } from './StatusBadge'

type SortKey = 'path' | 'status' | 'http' | 'lastCrawl' | 'lastChecked'
const statusOrder: IndexStatus[] = ['indexed', 'crawled', 'discovered', 'blocked', 'error']

export function UrlTable({
  data,
  loading,
  pageSize = 10,
  initialStatus,
  dense,
}: {
  data: UrlRecord[]
  loading?: boolean
  pageSize?: number
  initialStatus?: IndexStatus[]
  dense?: boolean
}) {
  const [q, setQ] = useState('')
  const [statuses, setStatuses] = useState<IndexStatus[]>(initialStatus ?? [])
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'lastChecked', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const nav = useNavigate()
  const toast = useToast()

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    let xs = data.filter(
      (u) => (!s || u.path.toLowerCase().includes(s) || u.title.toLowerCase().includes(s)) && (!statuses.length || statuses.includes(u.status)),
    )
    xs = [...xs].sort((a, b) => {
      const d = sort.dir === 'asc' ? 1 : -1
      switch (sort.key) {
        case 'path':
          return a.path.localeCompare(b.path) * d
        case 'status':
          return (statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)) * d
        case 'http':
          return (a.http - b.http) * d
        case 'lastCrawl':
          return ((a.lastCrawl ?? '').localeCompare(b.lastCrawl ?? '')) * d
        default:
          return a.lastChecked.localeCompare(b.lastChecked) * d
      }
    })
    return xs
  }, [data, q, statuses, sort])

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))
  const someOnPage = pageRows.some((r) => selected.has(r.id))

  const toggleSort = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))
  const sorted = (k: SortKey) => (sort.key === k ? sort.dir : false)
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    data.forEach((u) => (c[u.status] = (c[u.status] ?? 0) + 1))
    return c
  }, [data])

  const bulk = (label: string) => {
    toast({ title: `${label} queued`, description: `${selected.size} URL${selected.size > 1 ? 's' : ''} will be processed in the next run.` })
    setSelected(new Set())
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
            width={250}
            trigger={({ toggle, open }) => (
              <Button size="md" variant="secondary" onClick={toggle} leftIcon={<Filter />} className={cn(open && 'bg-surface-2')}>
                Status
                {statuses.length > 0 && (
                  <span className="tnum rounded bg-primary-soft px-1.5 text-[11px] text-primary-ink">{statuses.length}</span>
                )}
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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="md"
            leftIcon={<Download />}
            onClick={() => toast({ title: 'Export started', description: `${formatNumber(filtered.length)} URLs exported to CSV.` })}
          >
            Export
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mx-5 mb-3 flex animate-pop flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary-soft px-3 py-2">
          <span className="tnum text-[13px] font-medium text-primary-ink">{selected.size} selected</span>
          <span className="mx-1 h-4 w-px bg-primary/25" />
          <Button size="xs" variant="ghost" leftIcon={<RefreshCw />} onClick={() => bulk('Re-inspection')}>
            Re-inspect
          </Button>
          <Button size="xs" variant="ghost" leftIcon={<Send />} onClick={() => bulk('Indexing request')}>
            Request indexing
          </Button>
          <Button size="xs" variant="ghost" leftIcon={<Download />} onClick={() => bulk('Export')}>
            Export
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[12.5px] font-medium text-primary-ink hover:underline">
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={Math.min(pageSize, 8)} cols={6} />
      ) : filtered.length === 0 ? (
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
        <>
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
                      pageRows.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id)))
                      return n
                    })
                  }
                />
              </TH>
              <TH sortable sorted={sorted('path')} onSort={() => toggleSort('path')}>
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
              {pageRows.map((u) => (
                <TR key={u.id} selected={selected.has(u.id)} onClick={() => nav(`/app/indexing/${u.id}`)}>
                  <TD className="w-10 !pr-0">
                    <Checkbox
                      label={`Select ${u.path}`}
                      checked={selected.has(u.id)}
                      onChange={() =>
                        setSelected((s) => {
                          const n = new Set(s)
                          n.has(u.id) ? n.delete(u.id) : n.add(u.id)
                          return n
                        })
                      }
                    />
                  </TD>
                  <TD className={cn('max-w-[340px]', dense ? 'h-11' : 'h-13')}>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-fg group-hover:text-primary-ink">{u.path}</div>
                      {!dense && <div className="truncate text-[12px] text-fg-4">{u.title}</div>}
                    </div>
                  </TD>
                  <TD>
                    <IndexStatusBadge status={u.status} />
                  </TD>
                  <TD>
                    <HttpBadge code={u.http} />
                  </TD>
                  <TD>
                    {u.indexable ? (
                      <span className="inline-flex items-center gap-1.5 text-fg-2">
                        <Check className="size-3.5 text-success" /> Indexable
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-fg-3">
                        <Minus className="size-3.5 text-fg-4" />
                        {u.robots === 'noindex' ? 'Noindex' : u.robots === 'blocked' ? 'Robots blocked' : 'Non-indexable'}
                      </span>
                    )}
                  </TD>
                  <TD>
                    {u.canonical === 'self' ? (
                      <span className="text-fg-2">Self</span>
                    ) : u.canonical === 'other' ? (
                      <Tooltip content={`Canonicalised to ${u.canonicalTarget}`}>
                        <span className="inline-flex items-center gap-1 text-warning-ink">
                          <LinkIcon className="size-3" /> Other
                        </span>
                      </Tooltip>
                    ) : (
                      <span className="text-error-ink">Missing</span>
                    )}
                  </TD>
                  <TD className="tnum">
                    {u.lastCrawl ? (
                      <Tooltip content={formatDate(u.lastCrawl)}>
                        <span>{timeAgo(u.lastCrawl)}</span>
                      </Tooltip>
                    ) : (
                      <span className="text-fg-4">Never</span>
                    )}
                  </TD>
                  <TD className="tnum">{timeAgo(u.lastChecked)}</TD>
                  <TD className="w-10" onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      align="right"
                      width={200}
                      trigger={({ toggle }) => (
                        <button
                          onClick={toggle}
                          aria-label="Row actions"
                          className="rounded-md p-1 text-fg-4 opacity-60 transition hover:bg-surface-3 hover:text-fg group-hover:opacity-100"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      )}
                    >
                      {(close) => (
                        <>
                          <MenuItem icon={<FileSearch />} onClick={() => nav(`/app/indexing/${u.id}`)}>
                            Inspect URL
                          </MenuItem>
                          <MenuItem
                            icon={<RefreshCw />}
                            onClick={() => {
                              toast({ title: 'Re-inspection queued', description: u.path })
                              close()
                            }}
                          >
                            Re-inspect now
                          </MenuItem>
                          <MenuItem
                            icon={<Send />}
                            onClick={() => {
                              toast({ title: 'Indexing requested', description: u.path })
                              close()
                            }}
                          >
                            Request indexing
                          </MenuItem>
                        </>
                      )}
                    </Dropdown>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="border-t border-line">
            <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
