import { cn } from '@/lib/cn'
import { Card } from './Card'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} />
}

export function MetricCardSkeleton() {
  return (
    <Card className="p-4.5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-7 w-28" />
      <div className="mt-4 flex items-end justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-24" />
      </div>
    </Card>
  )
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  const bars = [38, 52, 44, 61, 57, 70, 64, 78, 72, 85, 80, 92]
  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-0 flex flex-col justify-between py-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-px bg-line-soft" />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-2 flex h-[85%] items-end gap-[3%] px-2">
        {bars.map((h, i) => (
          <div key={i} className="skeleton flex-1 rounded-t-md opacity-70" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line-soft">
      <div className="flex gap-6 bg-surface-2 px-5 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn('h-2.5', i === 0 ? 'w-48' : 'w-16')} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 px-5 py-3.5">
          <Skeleton className="size-4 rounded" />
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn('h-3', i === 0 ? 'w-[min(240px,40%)]' : i === 1 ? 'h-5 w-24 rounded-md' : 'w-14')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Route-level fallback while a page chunk loads. */
export function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
      <Card className="p-5">
        <ChartSkeleton height={260} />
      </Card>
    </div>
  )
}
