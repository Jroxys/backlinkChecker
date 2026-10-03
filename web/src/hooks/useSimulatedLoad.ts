import { useEffect, useState } from 'react'

/** Simulates network latency so skeleton states are exercised with mock data. */
export function useSimulatedLoad(ms = 650, deps: unknown[] = []) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), ms)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return loading
}
