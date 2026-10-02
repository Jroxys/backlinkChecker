import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Table({ className, children, minWidth = 860 }: { className?: string; children: ReactNode; minWidth?: number }) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-[1] bg-surface-2">
      <tr className="border-y border-line">{children}</tr>
    </thead>
  )
}

export function TH({
  children,
  className,
  sortable,
  sorted,
  onSort,
  align = 'left',
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  sortable?: boolean
  sorted?: 'asc' | 'desc' | false
  onSort?: () => void
  align?: 'left' | 'right' | 'center'
}) {
  const content = sortable ? (
    <button
      onClick={onSort}
      className={cn(
        'group inline-flex items-center gap-1 transition-colors hover:text-fg',
        sorted && 'text-fg',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      {children}
      {sorted === 'asc' ? (
        <ArrowUp className="size-3" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="size-3" />
      ) : (
        <ChevronsUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
      )}
    </button>
  ) : (
    children
  )
  return (
    <th
      className={cn(
        'h-9 px-4 text-[11.5px] font-medium whitespace-nowrap text-fg-3 first:pl-5 last:pr-5',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
      {...props}
    >
      {content}
    </th>
  )
}

export function TR({
  className,
  selected,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return (
    <tr
      className={cn(
        'group border-b border-line-soft transition-colors last:border-0 hover:bg-surface-2',
        selected && 'bg-primary-soft/60 hover:bg-primary-soft',
        props.onClick && 'cursor-pointer',
        className,
      )}
      {...props}
    />
  )
}

export function TD({
  className,
  align = 'left',
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'h-12 px-4 align-middle whitespace-nowrap text-fg-2 first:pl-5 last:pr-5',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
      {...props}
    />
  )
}
