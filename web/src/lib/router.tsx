import { forwardRef, useCallback, useContext, createContext, type ReactNode } from 'react'
import {
  Link as RLink,
  NavLink as RNavLink,
  useNavigate as useRNavigate,
  type LinkProps,
  type NavLinkProps,
  type NavigateOptions,
  type To,
} from 'react-router-dom'

/**
 * In-app links are written as "/app/…". In the demo they must point to "/demo/…".
 * These wrappers rewrite the prefix based on the surrounding AppBase.
 */
const BaseCtx = createContext('/app')

export function AppBase({ base, children }: { base: string; children: ReactNode }) {
  return <BaseCtx.Provider value={base}>{children}</BaseCtx.Provider>
}

export function useBase() {
  return useContext(BaseCtx)
}

function rewrite(to: To, base: string): To {
  if (typeof to === 'string') return to === '/app' || to.startsWith('/app/') || to.startsWith('/app?') ? base + to.slice(4) : to
  if (to.pathname) return { ...to, pathname: rewrite(to.pathname, base) as string }
  return to
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, ...rest }, ref) {
  return <RLink ref={ref} to={rewrite(to, useBase())} {...rest} />
})

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink({ to, ...rest }, ref) {
  return <RNavLink ref={ref} to={rewrite(to, useBase())} {...rest} />
})

export function useNavigate() {
  const nav = useRNavigate()
  const base = useBase()
  return useCallback(
    (to: To | number, opts?: NavigateOptions) => (typeof to === 'number' ? nav(to) : nav(rewrite(to, base), opts)),
    [nav, base],
  )
}

/** Strip the base so "/demo/indexing" and "/app/indexing" compare equal. */
export function useAppPath(pathname: string) {
  const base = useBase()
  return pathname.startsWith(base) ? '/app' + pathname.slice(base.length) : pathname
}
