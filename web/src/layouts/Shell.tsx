import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { DataSourceProvider } from '@/api/source'
import type { DataSource } from '@/api/source'
import { useMe } from '@/api/hooks'
import { ApiError } from '@/api/client'
import { AppBase } from '@/lib/router'
import { ProjectProvider } from '@/lib/project'
import { LogoMark } from '@/components/ui/Logo'
import { AppLayout } from './AppLayout'

function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe()
  const loc = useLocation()
  if (me.isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <LogoMark size={36} className="animate-pulse" />
      </div>
    )
  if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <>{children}</>
}

/** One app shell, two data sources: /app talks to the API, /demo to seeded mock data. */
export function Shell({ source }: { source: DataSource }) {
  const inner = (
    <ProjectProvider>
      <AppLayout />
    </ProjectProvider>
  )
  return (
    <AppBase base={source.base}>
      <DataSourceProvider source={source}>{source.mode === 'live' ? <RequireAuth>{inner}</RequireAuth> : inner}</DataSourceProvider>
    </AppBase>
  )
}
