import { createFileRoute, Link } from '@tanstack/react-router'
import { RequireAdmin } from '../../../components/RequireAdmin'
import { AdminSidebar } from '../../../components/admin-sidebar'
import { useSidebar } from '../../../contexts/SidebarContext'
import { logout } from '../../../lib/auth-api'
import {
  getAdminSoftware,
  deleteAdminSoftware,
  type Software,
} from '../../../lib/admin-api'
import { useEffect, useState } from 'react'
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CubeIcon,
} from '@heroicons/react/24/outline'
import {
  AdminPageHeader,
  RefreshButton,
  ListPanel,
  EmptyState,
} from '../../../components/admin/AdminUI'

export const Route = createFileRoute('/admin/software/')({
  component: AdminSoftwareListPage,
})

function AdminSoftwareListPage() {
  return (
    <RequireAdmin>
      {(user) => <AdminSoftwareListContent user={user} />}
    </RequireAdmin>
  )
}

function AdminSoftwareListContent({ user }: { user: any }) {
  const { isCollapsed, isMobile } = useSidebar()
  const [software, setSoftware] = useState<Software[]>([])
  const [loading, setLoading] = useState(true)

  const mono = { fontFamily: "'Space Mono', monospace" } as const

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  useEffect(() => {
    fetchSoftware()
  }, [])

  const fetchSoftware = async () => {
    setLoading(true)
    try {
      const data = await getAdminSoftware()
      setSoftware(data.software || [])
    } catch (err) {
      console.error('Failed to fetch software:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (uuid: string, name: string) => {
    if (!confirm(`Delete software "${name}"?`)) return

    try {
      await deleteAdminSoftware(uuid)
      await fetchSoftware()
    } catch (err) {
      console.error('Failed to delete software:', err)
      alert('Failed to delete software')
    }
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <AdminSidebar user={user} onLogout={onLogout} />
      <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
        <div className="space-y-6">
          <AdminPageHeader
            title="SOFTWARE"
            subtitle="Manage server software definitions and configurations"
            icon={<CubeIcon className="h-8 w-8 text-red-500" />}
            actions={
              <>
                <RefreshButton onClick={fetchSoftware} loading={loading} />
                <Link
                  to="/admin/software/new"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white text-xs transition-colors"
                  style={mono}
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  ADD SOFTWARE
                </Link>
              </>
            }
          />

          <ListPanel
            header={`${software.length} Software ${software.length === 1 ? 'Package' : 'Packages'}`}
            loading={loading}
            loadingText="Loading software..."
            empty={software.length === 0 && !loading}
            emptyContent={
              <EmptyState
                icon={<CubeIcon className="h-10 w-10 text-neutral-300 dark:text-neutral-700 mx-auto" />}
                title="No software configured"
                subtitle="Add your first software package to get started."
                action={
                  <Link
                    to="/admin/software/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs transition-colors"
                    style={mono}
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    ADD FIRST SOFTWARE
                  </Link>
                }
              />
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {software.map((sw) => (
                <Link
                  key={sw.uuid}
                  to="/admin/software/$softwareId"
                  params={{ softwareId: sw.uuid }}
                  className="group bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-4 hover:border-red-500 dark:hover:border-red-500 transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    {sw.icon_url ? (
                      <img src={sw.icon_url} alt={sw.name} className="w-12 h-12 object-contain" />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                        <CubeIcon className="w-6 h-6 text-neutral-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg text-neutral-900 dark:text-neutral-100 tracking-wider mb-1 truncate" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
                        {sw.name.toUpperCase()}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-500" style={mono}>
                        <span>{Object.keys(sw.docker_images || {}).length} IMAGES</span>
                        <span>•</span>
                        <span>{sw.variables?.length || 0} VARS</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                    <Link
                      to="/admin/software/$softwareId"
                      params={{ softwareId: sw.uuid }}
                      className="flex-1 text-center px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs transition-colors border border-neutral-200 dark:border-neutral-700"
                      style={mono}
                    >
                      <PencilIcon className="h-3 w-3 inline mr-1" />
                      EDIT
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(sw.uuid, sw.name)
                      }}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs transition-colors border border-red-600"
                      style={mono}
                    >
                      <TrashIcon className="h-3 w-3 inline" />
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          </ListPanel>
        </div>
      </main>
    </div>
  )
}
