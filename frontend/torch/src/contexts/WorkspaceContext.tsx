import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Org } from '../lib/auth-api'
import { listOrgs, createTenantApiRequest, getSession } from '../lib/auth-api'

type WorkspaceContextType = {
  workspaces: Org[]
  selectedWorkspace: Org | null
  selectedWorkspaceId: string | null
  tenantId: string | null
  setSelectedWorkspaceId: (id: string) => void
  refreshWorkspaces: () => Promise<void>
  isLoading: boolean
  hasWorkspaces: boolean
  tenantApi: <T>(path: string, init?: RequestInit) => Promise<T>
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

const STORAGE_KEY = 'torch_selected_workspace'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Org[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState<string | null>(() => {
    // Try to restore from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY)
    }
    return null
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const refreshWorkspaces = useCallback(async () => {
    try {
      const orgs = await listOrgs()
      setWorkspaces(orgs)

      // Check if selected workspace still exists in the list
      const selectedStillExists = orgs.find((o) => o.uuid === selectedWorkspaceId)
      
      if (!selectedStillExists) {
        // User was removed from workspace or workspace deleted
        if (orgs.length > 0) {
          // Switch to first available workspace
          const newWorkspaceId = orgs[0].uuid
          setSelectedWorkspaceIdState(newWorkspaceId)
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, newWorkspaceId)
          }
        } else {
          // No workspaces available
          setSelectedWorkspaceIdState(null)
          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY)
          }
        }
      } else if (!selectedWorkspaceId && orgs.length > 0) {
        // No workspace selected but workspaces exist - select first one
        const newWorkspaceId = orgs[0].uuid
        setSelectedWorkspaceIdState(newWorkspaceId)
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, newWorkspaceId)
        }
      }
    } catch (error) {
      console.error('Failed to refresh workspaces:', error)
      setWorkspaces([])
      setSelectedWorkspaceIdState(null)
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY)
      }
    } finally {
      setIsLoading(false)
    }
  }, [selectedWorkspaceId])

  const setSelectedWorkspaceId = useCallback((id: string) => {
    // Verify the workspace exists before selecting
    const workspaceExists = workspaces.find((w) => w.uuid === id)
    if (!workspaceExists) {
      console.warn(`Attempted to select non-existent workspace: ${id}`)
      return
    }
    
    setSelectedWorkspaceIdState(id)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id)
    }
  }, [workspaces])

  // Check auth state first, then fetch workspaces
  useEffect(() => {
    let active = true
    async function checkAuthAndLoad() {
      try {
        const session = await getSession()
        if (!active) return
        if (session.authenticated) {
          setIsAuthenticated(true)
        } else {
          setIsAuthenticated(false)
          setIsLoading(false)
        }
      } catch {
        if (active) {
          setIsAuthenticated(false)
          setIsLoading(false)
        }
      }
    }
    void checkAuthAndLoad()
    return () => { active = false }
  }, [])

  // Fetch workspaces when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      void refreshWorkspaces()
    }
  }, [isAuthenticated, refreshWorkspaces])

  // Poll for workspace changes every 30 seconds to detect removals
  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      void refreshWorkspaces()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [isAuthenticated, refreshWorkspaces])

  const selectedWorkspace = workspaces.find((w) => w.uuid === selectedWorkspaceId) || null
  const tenantId = selectedWorkspace?.tenantId || selectedWorkspace?.uuid || null
  const hasWorkspaces = workspaces.length > 0

  // Create tenant-scoped API helper
  const tenantApi = <T,>(path: string, init?: RequestInit): Promise<T> => {
    if (!tenantId) {
      return Promise.reject(new Error('No workspace selected'))
    }
    return createTenantApiRequest(tenantId)<T>(path, init)
  }

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        selectedWorkspace,
        selectedWorkspaceId,
        tenantId,
        setSelectedWorkspaceId,
        refreshWorkspaces,
        isLoading,
        hasWorkspaces,
        tenantApi,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
