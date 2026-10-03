/** Minimal fetch wrapper for the Indexora API. Cookies carry the session. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export async function request<T>(method: string, path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const isText = typeof body === 'string'
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'content-type': isText ? 'text/plain' : 'application/json' },
      body: body === undefined ? undefined : isText ? body : JSON.stringify(body),
      ...init,
    })
  } catch {
    throw new ApiError(0, 'network', 'Can’t reach the Indexora server. Check your connection and try again.')
  }
  const json = (await res.json().catch(() => null)) as { error?: { code: string; message: string; details?: unknown } } | null
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? 'http_error', json?.error?.message ?? res.statusText, json?.error?.details)
  return json as T
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b: unknown = {}) => request<T>('POST', p, b),
  put: <T>(p: string, b: unknown = {}) => request<T>('PUT', p, b),
  patch: <T>(p: string, b: unknown = {}) => request<T>('PATCH', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
}

export function qs(params: Record<string, string | number | boolean | undefined | null | string[]>) {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue
    u.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  const s = u.toString()
  return s ? `?${s}` : ''
}
