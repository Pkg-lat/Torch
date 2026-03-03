import { useEffect, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { getSession, logout, type SessionUser } from '../lib/auth-api'
import { useSidebar } from '../contexts/SidebarContext'
import { AdminSidebar } from './admin-sidebar'
import { LoadingScreen } from './loader'

type RequireAdminProps = {
  children: (user: SessionUser) => React.ReactNode
  redirectTo?: string
}

export function RequireAdmin({ children, redirectTo = '/auth' }: RequireAdminProps) {
  const navigate = useNavigate()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const { isCollapsed, isMobile } = useSidebar()

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  useEffect(() => {
    let active = true

    async function checkAuth() {
      try {
        const session = await getSession()
        if (!active) return

        if (!session.authenticated || !session.user) {
          await navigate({ to: redirectTo })
          return
        }

        // Check if user has admin role
        if (session.user.role !== 'admin') {
          setAccessDenied(true)
          setLoading(false)
          return
        }

        setUser(session.user)
      } catch (error) {
        console.error('Auth check failed:', error)
        if (active) {
          await navigate({ to: redirectTo })
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void checkAuth()

    return () => {
      active = false
    }
  }, [navigate, redirectTo])

  if (loading) {
    return <LoadingScreen message="Checking authentication…" />
  }

  if (!user || accessDenied) {
    return (
      <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        <AdminSidebar user={user || { uuid: '', email: '', usrname: '' }} onLogout={onLogout} />
        <main className={`flex-1 flex items-center justify-center transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
          <div className="text-center max-w-md">
            <img 
              src="/undraw/denied.svg" 
              alt="Access Denied" 
              className="w-64 mx-auto mb-8"
            />
            
            <h1 className="text-4xl mb-4" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
              ADMIN ACCESS REQUIRED
            </h1>
            
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6" style={{ fontFamily: "'Space Mono', monospace" }}>
              This area is restricted to administrators only.
            </p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs transition-colors"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                GO BACK
              </button>
              <Link
                to="/"
                className="px-4 py-2 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white text-xs transition-colors"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                DASHBOARD
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return <>{children(user)}</>
}
