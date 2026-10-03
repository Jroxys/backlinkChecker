import { useId } from 'react'

/** Lightweight inline SVG sparkline — cheaper than a full chart for KPI tiles. */
export function Sparkline({
  data,
  color = 'var(--primary)',
  width = 96,
  height = 32,
  fill = true,
  className,
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
  fill?: boolean
  className?: string
}) {
  const id = useId()
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pad = 2
  const span = max - min || 1
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    pad + (1 - (v - min) / span) * (height - pad * 2),
  ])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true" overflow="visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  )
}
