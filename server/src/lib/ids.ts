import { randomBytes } from 'node:crypto'

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** Short, URL-safe, roughly time-sortable ids: `<prefix>_<time36><random>`. */
export function id(prefix: string) {
  const t = Date.now().toString(36).padStart(9, '0')
  const bytes = randomBytes(10)
  let r = ''
  for (const b of bytes) r += ALPHABET[b % 36]
  return `${prefix}_${t}${r}`
}

export const now = () => new Date().toISOString()

export function addHours(iso: string | Date, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString()
}
