import { cn } from '@/lib/cn'

export function Avatar({ initials, size = 28, className }: { initials: string; size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#818CF8] to-[#4F46E5] font-semibold text-white ring-2 ring-surface',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  )
}

/** Deterministic favicon-like tile for a domain. */
export function DomainIcon({ domain, size = 20 }: { domain: string; size?: number }) {
  const hues = ['#6366F1', '#0F172A', '#0D9488', '#475569', '#4F46E5', '#334155', '#0E7490', '#1E293B']
  let h = 0
  for (const ch of domain) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[5px] font-semibold text-white uppercase"
      style={{ width: size, height: size, fontSize: size * 0.5, background: hues[h % hues.length] }}
      aria-hidden="true"
    >
      {domain.replace(/^www\./, '')[0]}
    </span>
  )
}
