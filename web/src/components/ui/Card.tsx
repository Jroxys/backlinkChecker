import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, interactive, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface shadow-xs',
        interactive && 'transition-[border-color,box-shadow,transform] duration-200 hover:border-line-strong hover:shadow-card',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  icon,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  icon?: ReactNode
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-4.5 pb-0', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && (
          <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-2 [&_svg]:size-3.5">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="heading text-[14px] font-semibold text-fg">{title}</h3>
          {description && <p className="mt-0.5 text-[12.5px] text-fg-3">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-line', className)} />
}
