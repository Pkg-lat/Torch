import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { logout } from '../lib/auth-api'
import { listVolumes } from '../lib/volumes-api'
import { Sidebar } from '../components/sidebar'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useSidebar } from '../contexts/SidebarContext'
import { RequireAuth } from '../components/RequireAuth'
import { useCallback } from 'react'
import {
  AdminPageHeader,
  ListPanel,
  AdminPagination,
  EmptyState,
} from '@/components/admin/AdminUI'
import { HomeIcon, ClockIcon } from 'lucide-react'
import { motion } from 'framer-motion'

export const Route = createFileRoute('/')({ component: App })

interface WorkspaceAuditLog {
  uuid: string
  workspaceId: string
  userUuid: string
  userEmail: string
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  timestamp: string
}

// Resource bar with gradient
function ResourceBar({ label, used, total, unit }: { label: string; used: number; total: number; unit: string }) {
  const percent = total > 0 ? Math.round((used / total) * 100) : 0
  const barSegments = 20
  const filledSegments = Math.round((percent / 100) * barSegments)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
          {label}
        </span>
        <span className="text-xs text-neutral-700 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
          {used}{unit} / {total}{unit}
        </span>
      </div>
      <div className="flex gap-[2px]">
        {Array.from({ length: barSegments }).map((_, i) => {
          const isFilled = i < filledSegments
          const segmentPercent = (i / barSegments) * 100
          let color = 'bg-neutral-300 dark:bg-neutral-800'
          if (isFilled) {
            if (segmentPercent < 33) color = 'bg-yellow-500'
            else if (segmentPercent < 66) color = 'bg-orange-500'
            else color = 'bg-red-500'
          }
          return (
            <motion.div
              key={i}
              className={`h-4 flex-1 ${color}`}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: isFilled ? 1 : 0.3 }}
              transition={{ duration: 0.3, delay: i * 0.02, ease: "easeOut" }}
            />
          )
        })}
      </div>
      <div className="text-right">
        <span className="text-lg text-red-600 dark:text-red-400" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
          {percent}%
        </span>
      </div>
    </div>
  )
}

function App() {
  return (
    <RequireAuth>
      {(user) => <HomePage user={user} />}
    </RequireAuth>
  )
}

function HomePage({ user }: { user: any }) {
  const { selectedWorkspace, hasWorkspaces } = useWorkspace()
  const { isCollapsed, isMobile } = useSidebar()

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  // Fetch volumes for storage calculation
  const { data: volumesData, isLoading: volumesLoading } = useQuery({
    queryKey: ['volumes', selectedWorkspace?.uuid],
    queryFn: () => selectedWorkspace ? listVolumes(selectedWorkspace.uuid, 1, 1000) : Promise.resolve({ volumes: [], meta: { total: 0, page: 1, limit: 1000 } }),
    enabled: !!selectedWorkspace,
  })

  // Fetch workspace members
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['workspace-members', selectedWorkspace?.uuid],
    queryFn: async () => {
      if (!selectedWorkspace) return []
      // TODO: Replace with actual API call
      return [{ userId: '1', username: user.usrname || user.email?.split('@')[0], email: user.email }]
    },
    enabled: !!selectedWorkspace,
  })

  // Fetch audit logs
  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['workspace-audit', selectedWorkspace?.uuid, 1, 5],
    queryFn: async () => {
      if (!selectedWorkspace) return { logs: [], meta: { total: 0, page: 1, limit: 5 } }
      const response = await fetch(`/api/workspaces/${selectedWorkspace.uuid}/audit?page=1&pageSize=5`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch audit logs')
      return response.json()
    },
    enabled: !!selectedWorkspace,
  })

  // Calculate storage from volumes
  const totalStorageMB = volumesData?.volumes?.reduce((sum, vol) => sum + vol.sizeMb, 0) || 0
  const serverCount = 0 // TODO: Fetch from servers API
  const workspaceMembers = membersData || []
  const auditLogs = auditData?.logs || []
  const auditTotal = auditData?.meta?.total || 0
  const auditPage = auditData?.meta?.page || 1
  const auditPageSize = auditData?.meta?.limit || 5

  const loading = volumesLoading || membersLoading

  const formatTimestamp = useCallback((timestamp: string | Date) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
    if (Number.isNaN(date.getTime())) return String(timestamp)
    const diffMs = Date.now() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    if (diffSeconds < 45) return 'just now'
    if (diffSeconds < 90) return '1 min ago'
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
    return date.toLocaleString()
  }, [])

  const formatActionLabel = useCallback((action: string) => {
    const actionMap: Record<string, string> = {
      'auth:success': 'Signed in',
      'auth:fail': 'Sign-in failed',
      'auth:logout': 'Signed out',
      'auth:register': 'Account created',
      'account:update': 'Account updated',
      'session:revoke': 'Session revoked',
      'session:issue': 'Session issued',
      'workspace:create': 'Workspace created',
      'workspace:update': 'Workspace updated',
      'workspace:delete': 'Workspace deleted',
      'server:create': 'Server created',
      'server:start': 'Server started',
      'server:stop': 'Server stopped',
      'server:delete': 'Server deleted',
      'volume:create': 'Volume created',
      'volume:delete': 'Volume deleted',
      'create': 'Created',
      'update': 'Updated',
      'delete': 'Deleted',
      'start': 'Started',
      'stop': 'Stopped',
    }
    if (actionMap[action]) return actionMap[action]
    return action.charAt(0).toUpperCase() + action.slice(1)
  }, [])

  const totalPages = Math.max(1, Math.ceil(auditTotal / auditPageSize))

  if (!hasWorkspaces) {
    return (
      <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        <Sidebar user={user} onLogout={onLogout} />
        <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'} flex items-center justify-center`}>
          <div className="max-w-lg text-center space-y-4">
            <div className="text-4xl tracking-wider text-neutral-900 dark:text-neutral-100" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
              NO WORKSPACE
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
              Seem like you've run out of Workspaces? Don't worry refresh this page if you think it's an error or create another workspace
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <Sidebar user={user} onLogout={onLogout} />
      <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <AdminPageHeader
              title="DASHBOARD"
              subtitle="Welcome to the best way to manage your servers"
             // icon={<HomeIcon className="h-8 w-8 text-red-500" />}
            />
          </div>

          {selectedWorkspace && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 }
                }
              }}
              className="space-y-6"
            >
              {/* Resource Overview */}
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <h2
                    className="text-2xl text-neutral-900 dark:text-neutral-100 tracking-wider"
                    style={{ fontFamily: "'Seven Segment', sans-serif" }}
                  >
                    RESOURCE OVERVIEW
                  </h2>
                  <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  {/* Left: Resource Bars */}
                  <div className="space-y-6">
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="h-3 w-32 bg-neutral-300 dark:bg-neutral-700 rounded animate-pulse"></div>
                            <div className="h-3 w-24 bg-neutral-300 dark:bg-neutral-700 rounded animate-pulse"></div>
                          </div>
                          <div className="flex gap-[2px]">
                            {Array.from({ length: 20 }).map((_, j) => (
                              <div key={j} className="h-4 flex-1 bg-neutral-300 dark:bg-neutral-700/50 animate-pulse" />
                            ))}
                          </div>
                          <div className="flex justify-end">
                            <div className="h-6 w-16 bg-neutral-300 dark:bg-neutral-700 rounded animate-pulse"></div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <>
                        <ResourceBar
                          label="Credits Available"
                          used={user.billing?.used || 0}
                          total={Math.max((user.billing?.credits || 0) + (user.billing?.used || 0), 100)}
                          unit=" RU"
                        />
                        <ResourceBar
                          label="Storage Used"
                          used={totalStorageMB}
                          total={user.limits?.storage_mb || 20480}
                          unit=" MB"
                        />
                        <ResourceBar
                          label="Servers Active"
                          used={serverCount}
                          total={10}
                          unit=""
                        />
                      </>
                    )}
                  </div>

                  {/* Right: Workspace Info */}
                  <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50 p-5">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-500 mb-3" style={{ fontFamily: "'Space Mono', monospace" }}>
                      Active Workspace
                    </div>
                    {loading ? (
                      <div className="space-y-4">
                        <div className="h-10 w-3/4 bg-neutral-300 dark:bg-neutral-700 rounded animate-pulse"></div>
                        <div className="space-y-2">
                          <div className="h-3 w-full bg-neutral-300 dark:bg-neutral-700 rounded animate-pulse"></div>
                          <div className="h-3 w-full bg-neutral-300 dark:bg-neutral-700 rounded animate-pulse"></div>
                          <div className="h-3 w-2/3 bg-neutral-300 dark:bg-neutral-700 rounded animate-pulse"></div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className="text-4xl text-neutral-900 dark:text-neutral-100 mb-4"
                          style={{ fontFamily: "'Seven Segment', sans-serif" }}
                        >
                          {selectedWorkspace.name.toUpperCase()}
                        </div>
                        <div className="text-xs text-neutral-600 dark:text-neutral-500 leading-relaxed" style={{ fontFamily: "'Space Mono', monospace" }}>
                          Workspaces are where your servers, volumes and resources live. You can add others to your workspace to allow them to manage everything alongside you. A workspace is essentially your team or organization within Torch. You can organize multiple workspaces for different projects or groups.
                        </div>

                        {/* Member avatars */}
                        <div className="mt-4 flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {Array.from({ length: 4 }).map((_, index) => {
                              const member = workspaceMembers[index]
                              if (member) {
                                const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500']
                                const initial = member.username?.charAt(0).toUpperCase() || member.email?.charAt(0).toUpperCase() || '?'
                                return (
                                  <div
                                    key={member.userId}
                                    className={`w-14 h-14 z-50 rounded border-2 border-white dark:border-neutral-900 flex items-center justify-center text-2xl font-bold text-black shadow-sm ${colors[index % colors.length]}`}
                                  >
                                    {initial}
                                  </div>
                                )
                              } else {
                                return (
                                  <div
                                    key={`placeholder-${index}`}
                                    className="w-14 z-10 h-14 rounded border-2 border-white dark:border-neutral-900 bg-neutral-200 dark:bg-neutral-800/30 flex items-center justify-center text-lg font-bold text-neutral-400 dark:text-white/50 shadow-sm"
                                  >
                                    --
                                  </div>
                                )
                              }
                            })}
                          </div>
                          {workspaceMembers.length > 4 && (
                            <span className="text-[10px] text-neutral-600 dark:text-neutral-500 uppercase tracking-wider" style={{ fontFamily: "'Space Mono', monospace" }}>
                              +{workspaceMembers.length - 4} more
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 pt-4 border-t border-neutral-200 dark:border-neutral-800 mt-4">
                          <div className="flex items-center justify-between text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>
                            <span className="text-neutral-500">User:</span>
                            <span className="text-neutral-900 dark:text-neutral-100">{user.username || user.email}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>
                            <span className="text-neutral-500">Role:</span>
                            <span className="text-neutral-900 dark:text-neutral-100">{user.role || 'user'}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>
                            <span className="text-neutral-500">Email:</span>
                            <span className="text-neutral-900 dark:text-neutral-100 truncate ml-2">{user.email}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Activity Log */}
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <h2
                    className="text-2xl text-neutral-900 dark:text-neutral-100 tracking-wider"
                    style={{ fontFamily: "'Seven Segment', sans-serif" }}
                  >
                    ACTIVITY LOG
                  </h2>
                  <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
                </div>

                <ListPanel
                  header="Recent Activity"
                  loading={auditLoading && auditLogs.length === 0}
                  loadingText="Loading activity..."
                  empty={auditLogs.length === 0 && !auditLoading}
                  emptyContent={
                    <EmptyState
                      icon={<ClockIcon className="h-10 w-10 text-neutral-300 dark:text-neutral-700 mx-auto" />}
                      title="No activity yet"
                      subtitle="Activity will appear here as actions are performed"
                    />
                  }
                  footer={
                    <AdminPagination
                      currentPage={auditPage}
                      totalPages={totalPages}
                      totalItems={auditTotal}
                      pageSize={auditPageSize}
                      onPageChange={() => {
                        // Refetch with new page
                        refetchAudit()
                      }}
                      onPageSizeChange={() => {
                        // Refetch with new page size
                        refetchAudit()
                      }}
                      pageSizeOptions={[3, 5, 10, 25]}
                      disabled={auditLoading}
                    />
                  }
                >
                  {auditLogs.map((item: WorkspaceAuditLog) => (
                    <div key={item.uuid} className="px-4 py-4 hover:bg-white dark:hover:bg-neutral-900 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0"></span>
                          <div className="flex-1 space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200" style={{ fontFamily: "'Space Mono', monospace" }}>
                                {formatActionLabel(item.action)}
                              </span>
                              {item.resource && (
                                <span className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded" style={{ fontFamily: "'Space Mono', monospace" }}>
                                  {item.resource}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-neutral-600 dark:text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                              {item.userEmail && (
                                <span>by {item.userEmail}</span>
                              )}
                              {item.resourceId && (
                                <span>ID: {item.resourceId.slice(0, 8)}...</span>
                              )}
                              {item.ipAddress && (
                                <span>IP: {item.ipAddress}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-600 uppercase tracking-wider whitespace-nowrap shrink-0" style={{ fontFamily: "'Space Mono', monospace" }}>
                          {formatTimestamp(item.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </ListPanel>
              </motion.div>

              {/* Quick Actions */}
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <h2
                    className="text-2xl text-neutral-900 dark:text-neutral-100 tracking-wider"
                    style={{ fontFamily: "'Seven Segment', sans-serif" }}
                  >
                    QUICK ACTIONS
                  </h2>
                  <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <motion.a
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    href="/servers"
                    className="block bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50 p-4 hover:border-red-500 dark:hover:border-red-500 transition-colors group"
                  >
                    <div className="text-sm uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2 group-hover:text-red-600 dark:group-hover:text-red-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                      Manage Servers
                    </div>
                    <div className="text-xs text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                      Create and manage your game servers
                    </div>
                  </motion.a>

                  <motion.a
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    href="/volumes"
                    className="block bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50 p-4 hover:border-red-500 dark:hover:border-red-500 transition-colors group"
                  >
                    <div className="text-sm uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2 group-hover:text-red-600 dark:group-hover:text-red-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                      Manage Volumes
                    </div>
                    <div className="text-xs text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                      Create and manage storage volumes
                    </div>
                  </motion.a>

                  <motion.a
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    href="/account"
                    className="block bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50 p-4 hover:border-red-500 dark:hover:border-red-500 transition-colors group"
                  >
                    <div className="text-sm uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2 group-hover:text-red-600 dark:group-hover:text-red-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                      Account Settings
                    </div>
                    <div className="text-xs text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                      Manage your account and preferences
                    </div>
                  </motion.a>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}
