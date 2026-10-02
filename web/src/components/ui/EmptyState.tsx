import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondary,
  className,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  secondary?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="relative mb-5">
        <div className="bg-dots absolute -inset-10 rounded-full [mask-image:radial-gradient(closest-side,black,transparent)]" />
        <div className="relative flex size-12 items-center justify-center rounded-xl border border-line bg-surface text-primary shadow-card [&_svg]:size-5">
          {icon}
        </div>
      </div>
      <h3 className="heading text-[15px] font-semibold text-fg">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-fg-3">{description}</p>
      {(action || secondary) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      )}
    </div>
  )
}
