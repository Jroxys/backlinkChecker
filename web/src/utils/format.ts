const nf = new Intl.NumberFormat('en-US')
const cf = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export const formatNumber = (n: number) => nf.format(n)
export const formatCompact = (n: number) => cf.format(n)

export function formatPercent(n: number, digits = 1, signed = true) {
  const s = Math.abs(n).toFixed(digits) + '%'
  if (!signed) return s
  return (n > 0 ? '+' : n < 0 ? '−' : '') + s
}

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const shortFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

export const formatDate = (d: string | Date) => dateFmt.format(new Date(d))
export const formatShortDate = (d: string | Date) => shortFmt.format(new Date(d))
export const formatTime = (d: string | Date) => timeFmt.format(new Date(d))

/** Reference "now". Demo data is generated relative to it. */
export const NOW = new Date()

export function timeAgo(d: string | Date) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 0) return 'in ' + formatShortDate(d)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.round(diff / 86400)}d ago`
  return formatDate(d)
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function formatNextRun(d: string) {
  const t = new Date(d)
  if (Number.isNaN(t.getTime())) return '—'
  const days = Math.floor((Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate())) / 86400000)
  const hm = t.toISOString().slice(11, 16)
  if (days === 0) return `today ${hm}`
  if (days === 1) return `tomorrow ${hm}`
  return `${formatShortDate(t)} ${hm}`
}
