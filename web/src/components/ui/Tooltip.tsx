import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'right'
  className?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-[80] w-max max-w-64 animate-fade-in rounded-lg bg-[#0B0F19] px-2.5 py-1.5 text-[12px] leading-snug font-medium text-white shadow-pop dark:bg-[#1F2937]',
            side === 'top' && 'bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2',
            side === 'bottom' && 'top-[calc(100%+6px)] left-1/2 -translate-x-1/2',
            side === 'right' && 'top-1/2 left-[calc(100%+8px)] -translate-y-1/2',
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
