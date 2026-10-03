import { Suspense, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Sparkles, ArrowRight } from 'lucide-react'
import { useSource } from '@/api/source'
import { useProject } from '@/lib/project'
import { usePageTitle } from '@/hooks/usePageTitle'
import { navGroups, settingsItem, adminItem } from '@/components/layout/nav'
import { useAppPath } from '@/lib/router'
import { cn } from '@/lib/cn'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { PageFallback } from '@/components/ui/Skeleton'
import { useAction, useMe } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('indexora-sidebar') === 'collapsed'
    } catch {
      return false
    }
  })
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const { pathname } = useLocation()
  const source = useSource()
  const me = useMe().data
  const { projects, loading } = useProject()
  const appPath = useAppPath(pathname)
  const section = [...navGroups.flatMap((g) => g.items), settingsItem, adminItem]
    .filter((i) => (i.to === '/app' ? appPath === '/app' : appPath.startsWith(i.to)))
    .sort((a, b) => b.to.length - a.to.length)[0]
  usePageTitle(`${appPath.startsWith('/app/onboarding') ? 'Get started' : section?.label ?? 'Indexora'}${source.mode === 'demo' ? ' · Demo' : ''} · Indexora`)

  useEffect(() => {
    try {
      localStorage.setItem('indexora-sidebar', collapsed ? 'collapsed' : 'expanded')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    setDrawer(false)
    document.getElementById('app-main')?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [pathname])

  if (me?.team?.suspended) return <SeatPaused ownerName={me.team.ownerName} />

  // A live account without projects goes straight to onboarding
  if (source.mode === 'live' && !loading && projects.length === 0 && !pathname.startsWith('/app/onboarding') && !pathname.startsWith('/app/settings') && !pathname.startsWith('/app/admin'))
    return <Navigate to="/app/onboarding" replace />

  return (
    <div className="min-h-screen bg-bg">
      {source.mode === 'demo' && (
        <div className="relative z-50 flex items-center justify-center gap-3 bg-[#0B0F19] px-4 py-2 text-[12.5px] text-white/80 print:hidden">
          <Sparkles className="size-3.5 shrink-0 text-[#A5B4FC]" />
          <span className="truncate">You’re exploring a demo with sample data.</span>
          <a href="/signup" className="inline-flex shrink-0 items-center gap-1 font-medium text-white hover:underline">
            Monitor your own site free <ArrowRight className="size-3" />
          </a>
        </div>
      )}
      <Header collapsed={collapsed} onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
      <div className="flex">
        <aside
          className={cn(
            'sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 lg:block print:hidden',
          )}
        >
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 animate-fade-in bg-[#0B0F19]/40 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 animate-slide-in-left shadow-pop">
              <Sidebar collapsed={false} mobile onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        )}

        <main id="app-main" className="min-w-0 flex-1">
          <div key={pathname} className="mx-auto w-full max-w-[1440px] animate-rise px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  )
}

/** A team member whose seat the owner's plan no longer covers. Nothing was deleted; access returns on upgrade. */
function SeatPaused({ ownerName }: { ownerName: string }) {
  const leave = useAction((s) => s.leaveTeam)
  const logout = useAction((s) => s.logout)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <Logo />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
        <h1 className="heading text-[18px] font-semibold text-fg">Your seat is paused</h1>
        <p className="mt-2 text-[13.5px] text-fg-3">
          {ownerName}’s plan no longer includes enough seats for you. Nothing was deleted — your access comes back as soon as they upgrade or free up a seat.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="primary" loading={leave.isPending} onClick={() => leave.mutateAsync([]).then(() => (window.location.href = '/app'), () => undefined)}>
            Leave team and start my own
          </Button>
          <Button variant="ghost" onClick={() => logout.mutateAsync([]).then(() => (window.location.href = '/'), () => undefined)}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
