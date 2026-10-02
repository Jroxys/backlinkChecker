import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

export function scoreTone(score: number) {
  if (score >= 85) return { color: 'var(--success)', label: 'Healthy' }
  if (score >= 65) return { color: 'var(--warning)', label: 'Needs attention' }
  return { color: 'var(--error)', label: 'Critical' }
}

/**
 * A restrained circular gauge: thin track, tick marks, tabular score.
 * Brand indigo for the arc; health is communicated by the label, not by recoloring.
 */
export function ScoreRing({
  score,
  size = 168,
  stroke = 8,
  label = 'SEO Score',
  sublabel,
  className,
  tone = 'primary',
}: {
  score: number
  size?: number
  stroke?: number
  label?: string
  sublabel?: string
  className?: string
  tone?: 'primary' | 'auto'
}) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(score))
    return () => cancelAnimationFrame(t)
  }, [score])

  const r = (size - stroke) / 2 - 6
  const c = 2 * Math.PI * r
  const arc = 0.75 // 270° gauge
  const color = tone === 'auto' ? scoreTone(score).color : 'var(--primary)'
  const ticks = Array.from({ length: 41 })

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[135deg]">
        {ticks.map((_, i) => {
          const a = (i / (ticks.length - 1)) * arc * 2 * Math.PI
          const r1 = r + stroke / 2 + 3
          const r2 = r1 + (i % 10 === 0 ? 4 : 2)
          return (
            <line
              key={i}
              x1={size / 2 + r1 * Math.cos(a)}
              y1={size / 2 + r1 * Math.sin(a)}
              x2={size / 2 + r2 * Math.cos(a)}
              y2={size / 2 + r2 * Math.sin(a)}
              stroke="var(--line-strong)"
              strokeWidth={1}
            />
          )
        })}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * arc} ${c}`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * arc * shown) / 100} ${c}`}
          style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.2,0.8,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum display font-semibold text-fg" style={{ fontSize: size * 0.27, lineHeight: 1 }}>
          {score}
        </span>
        <span className="mt-1.5 text-[11.5px] font-medium text-fg-3">{label}</span>
        {sublabel && <span className="mt-0.5 text-[11px] text-fg-4">{sublabel}</span>}
      </div>
    </div>
  )
}

/** Small inline score ring for tables/cards. */
export function MiniScore({ score, size = 28 }: { score: number; size?: number }) {
  const stroke = 3
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={scoreTone(score).color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * score) / 100} ${c}`}
        />
      </svg>
      <span className="tnum text-[13px] font-semibold text-fg">{score}</span>
    </span>
  )
}
