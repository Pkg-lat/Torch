import { createFileRoute } from '@tanstack/react-router'
import { RequireAdmin } from '../../components/RequireAdmin'
import { AdminSidebar } from '../../components/admin-sidebar'
import { useSidebar } from '../../contexts/SidebarContext'
import { logout } from '../../lib/auth-api'

export const Route = createFileRoute('/admin/servers')({
  component: AdminServersPage,
})

function AdminServersPage() {
  return (
    <RequireAdmin>
      {(user) => <AdminServersContent user={user} />}
    </RequireAdmin>
  )
}

function AdminServersContent({ user }: { user: any }) {
  const { isCollapsed, isMobile } = useSidebar()

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <AdminSidebar user={user} onLogout={onLogout} />
      <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
        <div className="space-y-6">
          <div>
            <h1 className="text-5xl mb-2" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
              SERVER MANAGEMENT
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
              View and manage all servers across the platform
            </p>
          </div>

          <div className="border bg-neutral-50 dark:bg-neutral-900/70 border-neutral-200 dark:border-neutral-800">
            <div className="border-b px-4 py-3 border-neutral-200 dark:border-neutral-800">
              <h2 className="text-sm uppercase tracking-widest text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                All Servers
              </h2>
            </div>
            <div className="p-4">
              <p className="text-xs text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                Server list will be displayed here
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
