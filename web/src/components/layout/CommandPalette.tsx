import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from '@/lib/router'
import { CornerDownLeft, FileText, FolderKanban, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Kbd } from '@/components/ui/Badge'
import { urls } from '@/data/urls'
import { projects } from '@/data/projects'
import { navGroups, settingsItem } from './nav'

interface Cmd {
  id: string
  label: string
  hint?: string
  group: string
  icon: React.ReactNode
  to: string
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const nav = useNavigate()
  const input = useRef<HTMLInputElement>(null)

  const all = useMemo<Cmd[]>(() => {
    const pages = [...navGroups.flatMap((g) => g.items), settingsItem].map((i) => ({
      id: i.to,
      label: i.label,
      group: 'Pages',
      icon: <i.icon className="size-4" />,
      to: i.to,
    }))
    const proj = projects.map((p) => ({
      id: p.id,
      label: p.domain,
      hint: p.name,
      group: 'Projects',
      icon: <FolderKanban className="size-4" />,
      to: '/app/projects',
    }))
    const u = urls.map((x) => ({
      id: x.id,
      label: x.path,
      hint: x.title,
      group: 'URLs',
      icon: <FileText className="size-4" />,
      to: `/app/indexing/${x.id}`,
    }))
    return [...pages, ...proj, ...u]
  }, [])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    const r = s ? all.filter((c) => (c.label + ' ' + (c.hint ?? '')).toLowerCase().includes(s)) : all.filter((c) => c.group !== 'URLs')
    return r.slice(0, 12)
  }, [q, all])

  useEffect(() => {
    if (open) {
      setQ('')
      setIdx(0)
    }
  }, [open])
  useEffect(() => setIdx(0), [q])

  if (!open) return null

  const go = (c?: Cmd) => {
    if (!c) return
    nav(c.to)
    onClose()
  }

  let lastGroup = ''
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-[#0B0F19]/40 backdrop-blur-[2px] dark:bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-pop overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-fg-4" />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIdx((i) => Math.min(results.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIdx((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') go(results[idx])
              else if (e.key === 'Escape') onClose()
            }}
            placeholder="Search pages, projects or URLs…"
            className="h-13 flex-1 bg-transparent text-[14.5px] text-fg placeholder:text-fg-4 focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <div className="px-4 py-10 text-center text-[13px] text-fg-3">
              No matches for “{q}”. Try a URL path like <span className="font-mono text-fg-2">/blog</span>.
            </div>
          )}
          {results.map((c, i) => {
            const header = c.group !== lastGroup
            lastGroup = c.group
            return (
              <div key={c.group + c.id}>
                {header && <div className="px-2.5 pt-2.5 pb-1 text-[11px] font-medium text-fg-4">{c.group}</div>}
                <button
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => go(c)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px]',
                    i === idx ? 'bg-surface-3 text-fg' : 'text-fg-2',
                  )}
                >
                  <span className={cn(i === idx ? 'text-primary' : 'text-fg-4')}>{c.icon}</span>
                  <span className="truncate font-medium">{c.label}</span>
                  {c.hint && <span className="truncate text-fg-4">{c.hint}</span>}
                  {i === idx && <CornerDownLeft className="ml-auto size-3.5 shrink-0 text-fg-4" />}
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-surface-2 px-4 py-2 text-[11.5px] text-fg-4">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
