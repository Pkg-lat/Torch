import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { logout, type SessionUser } from '../lib/auth-api'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useSidebar } from '../contexts/SidebarContext'
import { Sidebar } from './sidebar'
import { LoadingScreen } from './loader'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'

type WorkspaceRole = 'owner' | 'admin' | 'moderator' | 'guest'

type RequireAuthProps = {
  children: (user: SessionUser, provider?: string) => React.ReactNode
  redirectTo?: string
  minRole?: WorkspaceRole
  requireWorkspace?: boolean
}

const roleHierarchy: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  guest: 1,
}

function hasPermission(userRole: string | undefined, minRole: WorkspaceRole): boolean {
  if (!userRole) return false
  const userLevel = roleHierarchy[userRole as WorkspaceRole] || 0
  const minLevel = roleHierarchy[minRole]
  return userLevel >= minLevel
}

// Global auth check - only runs once and caches
async function checkSession() {
  const response = await fetch('/authenticate/session', {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Not authenticated')
  }

  return response.json()
}

export function RequireAuth({
  children,
  redirectTo = '/auth',
  minRole,
  requireWorkspace = false,
}: RequireAuthProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [permissionDenied, setPermissionDenied] = useState(false)
  const { selectedWorkspace, isLoading: workspaceLoading } = useWorkspace()
  const { isCollapsed, isMobile } = useSidebar()

  // Use TanStack Query for auth check - only runs once and caches
  const { data: session, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['session'],
    queryFn: checkSession,
    retry: false,
    staleTime: Infinity, // Never refetch automatically
  })

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && (error || !session?.authenticated || !session?.user)) {
      navigate({ to: redirectTo })
    }
  }, [isLoading, error, session, navigate, redirectTo])

  // Check workspace permissions after workspace loads
  useEffect(() => {
    if (isLoading || workspaceLoading || !session?.user) return

    // Check if workspace is required
    if (requireWorkspace && !selectedWorkspace) {
      setPermissionDenied(true)
      return
    }

    // Check role permissions if minRole is specified
    if (minRole && selectedWorkspace) {
      const hasAccess = hasPermission(selectedWorkspace.role, minRole)
      setPermissionDenied(!hasAccess)
    } else {
      setPermissionDenied(false)
    }
  }, [isLoading, workspaceLoading, session, selectedWorkspace, minRole, requireWorkspace])

  if (isLoading || workspaceLoading) {
    return <LoadingScreen message="Checking authentication…" />
  }

  if (!session?.user) {
    return null
  }

  if (permissionDenied) {
    const noWorkspace = requireWorkspace && !selectedWorkspace

    return (
      <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        <Sidebar user={session.user} onLogout={onLogout} />
        <main className={`flex-1 flex items-center justify-center transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
          <div className="text-center max-w-md">
            <img
              src="/undraw/denied.svg"
              alt="Access Denied"
              className="w-64 mx-auto mb-8"
            />

            <h1 className="text-4xl mb-4" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
              ACCESS DENIED
            </h1>

            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6" style={{ fontFamily: "'Space Mono', monospace" }}>
              {noWorkspace
                ? 'You need to be in a workspace to access this page.'
                : `This page requires ${minRole?.toUpperCase()} permissions or higher. If you think this is a mistake contact the workspace/organization owner`
              }
            </p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs transition-colors"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                GO BACK
              </button>
              <button
                onClick={() => window.location.replace("/")}
                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs transition-colors"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                DASHBOARD
              </button>

            </div>
          </div>
        </main>
      </div>
    )
  }

  // Attach refetch onto the user object so children can easily refetch their session data (like credit changes)
  const userObj = {
    ...session.user,
    refetch,
  }

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="contents"
    >
      {children(userObj as any, session.provider)}
    </motion.div>
  )
}
