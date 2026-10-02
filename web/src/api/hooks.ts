import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSource, type BacklinkQuery, type UrlQuery } from './source'
import { ApiError } from './client'
import { useToast } from '@/components/ui/Toast'

/* ---------------------------------------------------------------- reads */

export function useMe() {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'me'], queryFn: s.me, retry: false, staleTime: 60_000 })
}

export function usePlans() {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'plans'], queryFn: s.plans, staleTime: 5 * 60_000 })
}

export function useProjects() {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'projects'], queryFn: s.projects })
}

export function useProjectData(id: string | undefined) {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'project', id], queryFn: () => s.project(id!), enabled: !!id })
}

export function useHistory(projectId: string | undefined, days: number) {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'history', projectId, days], queryFn: () => s.history(projectId!, days), enabled: !!projectId, placeholderData: keepPreviousData })
}

export function useSitemaps(projectId: string | undefined) {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'sitemaps', projectId], queryFn: () => s.sitemaps(projectId!), enabled: !!projectId })
}

export function useUrls(projectId: string | undefined, q: UrlQuery) {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'urls', projectId, q], queryFn: () => s.urls(projectId!, q), enabled: !!projectId, placeholderData: keepPreviousData })
}

export function useUrl(id: string | undefined) {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'url', id], queryFn: () => s.url(id!), enabled: !!id, retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2 })
}

export function useBacklinks(projectId: string | undefined, q: BacklinkQuery) {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'backlinks', projectId, q], queryFn: () => s.backlinks(projectId!, q), enabled: !!projectId, placeholderData: keepPreviousData })
}

export function useBacklinkProfile(projectId: string | undefined) {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'backlinkProfile', projectId], queryFn: () => s.backlinkProfile(projectId!), enabled: !!projectId })
}

export function useAlerts(opts?: { unread?: boolean }) {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'alerts', opts], queryFn: () => s.alerts(opts), refetchInterval: s.mode === 'live' ? 60_000 : false })
}

export function useNotificationSettings() {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'notificationSettings'], queryFn: s.notificationSettings })
}

export function useAudit(projectId: string | undefined) {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'audit', projectId], queryFn: () => s.audit(projectId!), enabled: !!projectId })
}

export function useKeywords(projectId: string | undefined) {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'keywords', projectId], queryFn: () => s.keywords(projectId!), enabled: !!projectId, staleTime: 10 * 60_000 })
}

export function useOpportunities(projectId: string | undefined) {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'opportunities', projectId], queryFn: () => s.opportunities(projectId!), enabled: !!projectId })
}

export function useCompetitors(projectId: string | undefined) {
  const s = useSource()
  return useQuery({ queryKey: [s.mode, 'competitors', projectId], queryFn: () => s.competitors(projectId!), enabled: !!projectId })
}

/* --------------------------------------------------------------- writes */

/**
 * Wraps a DataSource write with invalidation and error toasts.
 * `invalidate` lists query keys (without the mode prefix) to refresh on success.
 */
export function useAction<A extends unknown[], R>(
  pick: (s: ReturnType<typeof useSource>) => (...args: A) => Promise<R>,
  opts: { invalidate?: string[]; success?: (r: R) => { title: string; description?: string } | null } = {},
) {
  const s = useSource()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (args: A) => pick(s)(...args),
    onSuccess: (r) => {
      for (const k of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: [s.mode, k] })
      const msg = opts.success?.(r)
      if (msg) toast({ ...msg, tone: 'success' })
    },
    onError: (e) => {
      const err = e as ApiError
      toast({
        title: err.code === 'demo' ? 'Demo mode' : err.code === 'plan_limit' || err.code === 'plan_feature' ? 'Plan limit reached' : 'Something went wrong',
        description: err.message,
        tone: err.code === 'demo' ? 'info' : 'error',
      })
    },
  })
}
