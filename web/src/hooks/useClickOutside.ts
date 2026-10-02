import { useEffect, type RefObject } from 'react'

export function useClickOutside(refs: RefObject<HTMLElement | null>[], handler: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (refs.some((r) => r.current && r.current.contains(e.target as Node))) return
      handler()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && handler()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [refs, handler, active])
}
