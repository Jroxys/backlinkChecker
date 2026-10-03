import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/utils/format'

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  className,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (p: number) => void
  className?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  const nums: (number | '…')[] = []
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }

  const btn =
    'inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[12.5px] font-medium transition-colors tnum'

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 px-5 py-3', className)}>
      <p className="tnum text-[12.5px] text-fg-3">
        Showing <span className="font-medium text-fg-2">{formatNumber(from)}–{formatNumber(to)}</span> of{' '}
        <span className="font-medium text-fg-2">{formatNumber(total)}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          className={cn(btn, 'text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-40')}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </button>
        {nums.map((n, i) =>
          n === '…' ? (
            <span key={`e${i}`} className="px-1 text-fg-4">
              …
            </span>
          ) : (
            <button
              key={n}
              onClick={() => onChange(n)}
              aria-current={n === page ? 'page' : undefined}
              className={cn(
                btn,
                n === page ? 'bg-surface text-fg shadow-xs ring-1 ring-line' : 'text-fg-3 hover:bg-surface-3 hover:text-fg',
              )}
            >
              {n}
            </button>
          ),
        )}
        <button
          className={cn(btn, 'text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-40')}
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
