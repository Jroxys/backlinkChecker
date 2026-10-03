import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 sm:flex-1">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="heading text-[22px] leading-tight font-semibold text-fg sm:text-[24px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13.5px] text-fg-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">{actions}</div>}
    </div>
  )
}
