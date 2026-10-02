import { cn } from '@/lib/cn'

/**
 * Indexora mark: four connected nodes ascending left → right.
 * Reads as a crawl path / link graph that resolves into growth.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ix-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#818CF8" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8.5" fill="url(#ix-g)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="none" stroke="#fff" strokeOpacity="0.18" />
      <path
        d="M8.5 22.5 L13.5 16 L18.5 19 L23.5 9.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.9"
      />
      <circle cx="8.5" cy="22.5" r="2.3" fill="#fff" />
      <circle cx="13.5" cy="16" r="2.3" fill="#fff" />
      <circle cx="18.5" cy="19" r="2.3" fill="#fff" />
      <circle cx="23.5" cy="9.5" r="3" fill="#fff" />
      <circle cx="23.5" cy="9.5" r="1.2" fill="#4F46E5" />
    </svg>
  )
}

export function Logo({ className, collapsed, size = 26 }: { className?: string; collapsed?: boolean; size?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      {!collapsed && <span className="heading text-[16px] font-semibold tracking-[-0.03em] text-fg">Indexora</span>}
    </span>
  )
}
