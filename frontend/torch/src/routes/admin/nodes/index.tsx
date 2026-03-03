import { createFileRoute, Link } from '@tanstack/react-router'
import { RequireAdmin } from '../../../components/RequireAdmin'
import { AdminSidebar } from '../../../components/admin-sidebar'
import {
  AdminPageHeader,
  RefreshButton,
  SearchBar,
  FilterPills,
  ListPanel,
  AdminPagination,
  EmptyState,
  NoMatchState,
} from '../../../components/admin/AdminUI'
import { useSidebar } from '../../../contexts/SidebarContext'
import { logout } from '../../../lib/auth-api'
import {
  getAdminNodes,
  createAdminNode,
  deleteAdminNode,
  healthCheckNode,
  formatTimestamp,
  type AdminNode,
} from '../../../lib/admin-api'
import { useEffect, useMemo, useState } from 'react'
import {
  PlusIcon,
  ArrowPathIcon,
  TrashIcon,
  SignalIcon,
  SignalSlashIcon,
  ExclamationTriangleIcon,
  ServerIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  GlobeAltIcon,
  ClockIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline'
import {
  SignalIcon as SignalSolidIcon,
} from '@heroicons/react/24/solid'
import { RefreshCcw } from 'lucide-react'

export const Route = createFileRoute('/admin/nodes/')({
  component: AdminNodesPage,
})

const NODES_PER_PAGE = 10

type StatusFilter = 'all' | 'online' | 'offline' | 'error' | 'unknown'

function AdminNodesPage() {
  return (
    <RequireAdmin>
      {(user) => <AdminNodesContent user={user} />}
    </RequireAdmin>
  )
}

function AdminNodesContent({ user }: { user: any }) {
  const { isCollapsed, isMobile } = useSidebar()
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [healthChecking, setHealthChecking] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [currentPage, setCurrentPage] = useState(1)

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  useEffect(() => {
    fetchNodes()
  }, [])

  const fetchNodes = async () => {
    setLoading(true)
    try {
      const data = await getAdminNodes()
      setNodes(data.nodes || [])
    } catch (err) {
      console.error('Failed to fetch nodes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleHealthCheck = async (nodeUuid: string) => {
    setHealthChecking(nodeUuid)
    try {
      await healthCheckNode(nodeUuid)
      await fetchNodes()
    } catch (err) {
      console.error('Health check failed:', err)
    } finally {
      setHealthChecking(null)
    }
  }

  const handleDelete = async (node: AdminNode) => {
    if (!confirm(`Are you sure you want to delete node "${node.name}"?`)) return
    try {
      await deleteAdminNode(node.uuid)
      await fetchNodes()
    } catch (err) {
      console.error('Failed to delete node:', err)
      alert('Failed to delete node')
    }
  }

  // Filtered + searched nodes
  const filteredNodes = useMemo(() => {
    let result = nodes
    if (statusFilter !== 'all') {
      result = result.filter((n) => n.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.fqdn.toLowerCase().includes(q) ||
          n.ip?.toLowerCase().includes(q) ||
          n.host.host.toLowerCase().includes(q),
      )
    }
    return result
  }, [nodes, statusFilter, search])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredNodes.length / NODES_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedNodes = filteredNodes.slice(
    (safePage - 1) * NODES_PER_PAGE,
    safePage * NODES_PER_PAGE,
  )

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter])


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <SignalSolidIcon className="h-3.5 w-3.5 text-emerald-500" />
      case 'offline':
        return <SignalSlashIcon className="h-3.5 w-3.5 text-red-500" />
      case 'error':
        return <ExclamationTriangleIcon className="h-3.5 w-3.5 text-orange-500" />
      default:
        return <SignalIcon className="h-3.5 w-3.5 text-neutral-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const base = 'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider border'
    switch (status) {
      case 'online':
        return `${base} bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800`
      case 'offline':
        return `${base} bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800`
      case 'error':
        return `${base} bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800`
      default:
        return `${base} bg-neutral-50 dark:bg-neutral-900/30 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800`
    }
  }


  return (
    <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <AdminSidebar user={user} onLogout={onLogout} />
      <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
        <div className="space-y-6">

          {/* Header */}
          <AdminPageHeader
            title="NODES"
            subtitle="Manage lightd daemon nodes across your infrastructure"
            icon={<ServerStackIcon className="h-8 w-8 text-red-500" />}
            actions={
              <>
                <RefreshButton onClick={fetchNodes} loading={loading} />
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white text-xs transition-colors"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  ADD NODE
                </button>
              </>
            }
          />

          {/* Search + Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name, FQDN, IP, or host..."
            />
            <FilterPills
              options={['all', 'online', 'offline', 'error'] as StatusFilter[]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>

          {/* Nodes list */}
          <ListPanel
            header={
              filteredNodes.length === nodes.length
                ? `All Nodes (${nodes.length})`
                : `Showing ${filteredNodes.length} of ${nodes.length}`
            }
            headerRight={
              filteredNodes.length > NODES_PER_PAGE
                ? `Page ${safePage} of ${totalPages}`
                : undefined
            }
            loading={loading}
            loadingText="Loading nodes..."
            empty={filteredNodes.length === 0 && !loading}
            emptyContent={
              nodes.length === 0 ? (
                <EmptyState
                  icon={<ServerIcon className="h-10 w-10 text-neutral-300 dark:text-neutral-700 mx-auto" />}
                  title="No nodes yet"
                  subtitle="Add your first node to start deploying servers."
                  action={
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs transition-colors"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      ADD FIRST NODE
                    </button>
                  }
                />
              ) : (
                <NoMatchState onClear={() => { setSearch(''); setStatusFilter('all') }} />
              )
            }
            footer={
              totalPages > 1 ? (
                <AdminPagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  totalItems={filteredNodes.length}
                  pageSize={NODES_PER_PAGE}
                  onPageChange={setCurrentPage}
                />
              ) : undefined
            }
          >
                {paginatedNodes.map((node) => (
                  <Link
                    key={node.uuid}
                    to="/admin/nodes/$nodeId"
                    params={{ nodeId: node.uuid }}
                    className="group block px-4 py-4 hover:bg-white dark:hover:bg-neutral-900 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* Node icon */}
                      <div className="shrink-0">
                        {node.image ? (
                          <img
                            src={node.image}
                            alt={node.name}
                            className="w-10 h-10 object-cover border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none'
                              ;(e.currentTarget.nextSibling as HTMLElement)?.classList.remove('hidden')
                            }}
                          />
                        ) : null}
                        <div className={`w-10 h-10 flex items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 ${node.image ? 'hidden' : ''}`}>
                          <ServerIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-600" />
                        </div>
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate" style={{ fontFamily: "'Space Mono', monospace" }}>
                            {node.name}
                          </span>
                          <span className={getStatusBadge(node.status)} style={{ fontFamily: "'Space Mono', monospace" }}>
                            {getStatusIcon(node.status)}
                            {node.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                          <GlobeAltIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{node.scheme}://{node.host.host}:{node.host.port}</span>
                          <span className="text-neutral-300 dark:text-neutral-700">|</span>
                          <span className="truncate">{node.fqdn}</span>
                        </div>
                      </div>

                      {/* Servers count */}
                      <div className="hidden md:flex flex-col items-center gap-0.5 shrink-0 min-w-20">
                        <div className="text-xs text-neutral-900 dark:text-neutral-100" style={{ fontFamily: "'Space Mono', monospace" }}>
                          {node.currentServers}/{node.maxServers}
                        </div>
                        <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              node.maxServers > 0 && (node.currentServers / node.maxServers) > 0.9
                                ? 'bg-red-500'
                                : node.maxServers > 0 && (node.currentServers / node.maxServers) > 0.7
                                  ? 'bg-yellow-500'
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${node.maxServers > 0 ? Math.min(100, (node.currentServers / node.maxServers) * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                          SERVERS
                        </span>
                      </div>

                      {/* Timestamps */}
                      <div className="hidden lg:flex flex-col items-end gap-0.5 shrink-0 text-[10px] text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-3 w-3" />
                          <span>{formatTimestamp(node.createdAt)}</span>
                        </div>
                        {node.lastHealthCheck && (
                          <div className="flex items-center gap-1">
                            <RefreshCcw className="h-3 w-3 text-red-500 " />
                            <span>{formatTimestamp(node.lastHealthCheck)}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1.5 shrink-0" onClick={(e) => e.preventDefault()}>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            handleHealthCheck(node.uuid)
                          }}
                          disabled={healthChecking === node.uuid}
                          className="p-2 text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors disabled:opacity-50 border border-transparent hover:border-blue-200 dark:hover:border-blue-900"
                          title="Run health check"
                        >
                          <RefreshCcw className={`h-4 w-4 ${healthChecking === node.uuid ? 'animate-pulse' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            handleDelete(node)
                          }}
                          className="p-2 text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900"
                          title="Delete node"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}
          </ListPanel>
        </div>
      </main>

      {showCreateModal && (
        <CreateNodeModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            fetchNodes()
          }}
        />
      )}
    </div>
  )
}

/* ─── Create Node Modal ─── */

function CreateNodeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    fqdn: '',
    ip: '',
    host: '',
    port: 8070,
    sftpPort: 2022,
    image: '',
    secretToken: '',
    scheme: 'http',
    maxServers: 100,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await createAdminNode(formData)
      setSuccess(true)
      setTimeout(() => onSuccess(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create node')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2 border bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500'
  const labelCls =
    'block text-[10px] uppercase tracking-[0.15em] mb-2 text-neutral-500 dark:text-neutral-400'
  const mono = { fontFamily: "'Space Mono', monospace" } as const

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl border p-6 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <PlusIcon className="h-5 w-5 text-red-500" />
            <h2 className="text-base font-medium" style={mono}>
              Add New Node
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="flex items-center gap-2.5 p-4 border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 text-sm" style={mono}>
            <CheckCircleIcon className="h-5 w-5 shrink-0" />
            Node created successfully! Running initial health check...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 text-xs" style={mono}>
                <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls} style={mono}>Node Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="us-east-1" className={inputCls} style={mono} />
              </div>
              <div>
                <label className={labelCls} style={mono}>FQDN *</label>
                <input type="text" value={formData.fqdn} onChange={(e) => setFormData({ ...formData, fqdn: e.target.value })} required placeholder="node1.example.com" className={inputCls} style={mono} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls} style={mono}>IP Address</label>
                <input type="text" value={formData.ip} onChange={(e) => setFormData({ ...formData, ip: e.target.value })} placeholder="192.168.1.100" className={inputCls} style={mono} />
              </div>
              <div>
                <label className={labelCls} style={mono}>Image URL</label>
                <input type="text" value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} placeholder="https://example.com/logo.png" className={inputCls} style={mono} />
                <span className="text-[9px] mt-1 text-neutral-400 block" style={mono}>Optional: URL or data URI for node icon</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls} style={mono}>Host *</label>
                <input type="text" value={formData.host} onChange={(e) => setFormData({ ...formData, host: e.target.value })} required placeholder="localhost" className={inputCls} style={mono} />
              </div>
              <div>
                <label className={labelCls} style={mono}>API Port *</label>
                <input type="number" value={formData.port} onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 8070 })} required min="1" max="65535" className={inputCls} style={mono} />
              </div>
              <div>
                <label className={labelCls} style={mono}>SFTP Port *</label>
                <input type="number" value={formData.sftpPort} onChange={(e) => setFormData({ ...formData, sftpPort: parseInt(e.target.value) || 2022 })} required min="1" max="65535" className={inputCls} style={mono} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls} style={mono}>Scheme *</label>
                <select value={formData.scheme} onChange={(e) => setFormData({ ...formData, scheme: e.target.value })} required className={inputCls} style={mono}>
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                </select>
              </div>
              <div>
                <label className={labelCls} style={mono}>Max Servers</label>
                <input type="number" value={formData.maxServers} onChange={(e) => setFormData({ ...formData, maxServers: parseInt(e.target.value) || 100 })} min="1" className={inputCls} style={mono} />
              </div>
            </div>

            <div>
              <label className={labelCls} style={mono}>Secret Token *</label>
              <input type="password" value={formData.secretToken} onChange={(e) => setFormData({ ...formData, secretToken: e.target.value })} required placeholder="lightd_..." className={inputCls} style={mono} />
              <span className="text-[9px] mt-1 text-neutral-400 block" style={mono}>Get your token with: ./lightd --token what</span>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-xs border bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 transition-colors" style={mono}>
                Cancel
              </button>
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 text-xs bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white disabled:opacity-50 transition-colors" style={mono}>
                {loading && <ArrowPathIcon className="h-3 w-3 animate-spin" />}
                {loading ? 'Creating...' : 'Create Node'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
