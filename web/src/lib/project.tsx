import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useProjects } from '@/api/hooks'
import { useSource } from '@/api/source'
import type { Project } from '@/api/types'

interface ProjectCtx {
  project: Project | undefined
  projects: Project[]
  loading: boolean
  setProjectId: (id: string) => void
}

const Ctx = createContext<ProjectCtx | null>(null)

/** The project the user is currently looking at. Remembered per mode in localStorage. */
export function ProjectProvider({ children }: { children: ReactNode }) {
  const { mode } = useSource()
  const key = `indexora-project-${mode}`
  const q = useProjects()
  const [id, setId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  })
  const projects = useMemo(() => q.data ?? [], [q.data])
  const project = projects.find((p) => p.id === id) ?? projects[0]

  useEffect(() => {
    try {
      if (project) localStorage.setItem(key, project.id)
    } catch {
      /* ignore */
    }
  }, [project, key])

  return <Ctx.Provider value={{ project, projects, loading: q.isLoading, setProjectId: setId }}>{children}</Ctx.Provider>
}

export function useProject() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useProject must be used inside ProjectProvider')
  return c
}
