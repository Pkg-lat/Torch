import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { RequireAdmin } from '../../components/RequireAdmin'
import { AdminSidebar } from '../../components/admin-sidebar'
import {
  AdminPageHeader,
  RefreshButton,
  ListPanel,
  AdminPagination,
} from '../../components/admin/AdminUI'
import { useSidebar } from '../../contexts/SidebarContext'
import { logout } from '../../lib/auth-api'
import { FileTextIcon, PaperclipIcon } from 'lucide-react'

export const Route = createFileRoute('/admin/logs')({
  component: AdminLogsPage,
})

type AuditLog = {
  uuid: string
  adminUuid: string
  adminEmail: string
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  status: string
  errorMsg?: string
  timestamp: string
}

function AdminLogsPage() {
  return (
    <RequireAdmin>
      {(user) => <AdminLogsContent user={user} />}
    </RequireAdmin>
  )
}

function AdminLogsContent({ user }: { user: any }) {
  const { isCollapsed, isMobile } = useSidebar()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  useEffect(() => {
    void fetchLogs()
  }, [page, pageSize])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const skip = (page - 1) * pageSize
      const response = await fetch(`/api/admin/audit-logs?limit=${pageSize}&skip=${skip}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
        setTotal(data.total || 0)
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp: string) => new Date(timestamp).toLocaleString()
  const timeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const getStatusColor = (status: string) => {
    return status === 'success'
      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
      : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <AdminSidebar user={user} onLogout={onLogout} />
      <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
        <div className="space-y-6 ">

          <AdminPageHeader
            title="AUDIT LOGS"
            subtitle="Track all administrative actions and system changes"
            icon={<FileTextIcon className="h-8 w-8 text-red-500" />}
            actions={<RefreshButton onClick={() => void fetchLogs()} loading={loading} />}
          />

          <ListPanel
            header={`Activity Log`}
            loading={loading}
            loadingText="Loading logs..."
            empty={logs.length === 0 && !loading}
            emptyContent={
              <p className="text-xs text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                No audit logs found
              </p>
            }
            footer={
              <AdminPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
                pageSizeOptions={[25, 50, 100, 200]}
              />
            }
          >
            {logs.map((log) => (
              <div key={log.uuid} className="px-4 py-4 hover:bg-white dark:hover:bg-neutral-900 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider border ${getStatusColor(log.status)}`}
                        style={{ fontFamily: "'Space Mono', monospace" }}
                      >
                        {log.status.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100" style={{ fontFamily: "'Space Mono', monospace" }}>
                        {log.action}
                      </span>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                        on {log.resource}
                      </span>
                      {log.resourceId && (
                        <span className="text-xs text-neutral-400 dark:text-neutral-600" style={{ fontFamily: "'Space Mono', monospace" }}>
                          #{log.resourceId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                      by {log.adminEmail} {log.ipAddress && `from ${log.ipAddress}`}
                    </div>
                    {log.errorMsg && (
                      <div className="text-[10px] text-red-600 dark:text-red-400 mt-1" style={{ fontFamily: "'Space Mono', monospace" }}>
                        Error: {log.errorMsg}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                      {timeAgo(log.timestamp)}
                    </div>
                    <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5" style={{ fontFamily: "'Space Mono', monospace" }}>
                      {formatTimestamp(log.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </ListPanel>
        </div>
      </main>
    </div>
  )
}
