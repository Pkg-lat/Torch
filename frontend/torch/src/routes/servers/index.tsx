import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RequireAuth } from '../../components/RequireAuth'
import { Sidebar } from '../../components/sidebar'
import { useSidebar } from '../../contexts/SidebarContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import { logout } from '../../lib/auth-api'
import {
  listServers,
  deleteServer,
  createServer,
  listSoftware,
  type Server,
  type Software,
  type CreateServerRequest,
} from '../../lib/servers-api'
import { listAvailableNodes, listVolumes, type PublicNode, type Volume } from '../../lib/volumes-api'
import { useState, useEffect } from 'react'
import {
  PlusIcon,
  TrashIcon,
  ServerIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import { PageHeader, RefreshButton, mono, Button, Modal, Input } from '../../components/ui'
import LoadingAnimation from '../../components/loader'
import { motion } from 'framer-motion'

export const Route = createFileRoute('/servers/')({
  component: ServersPage,
})

function ServersPage() {
  return (
    <RequireAuth>
      {(user) => <ServersContent user={user} />}
    </RequireAuth>
  )
}

function ServersContent({ user }: { user: any }) {
  const { isCollapsed, isMobile } = useSidebar()
  const { selectedWorkspace } = useWorkspace()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const queryClient = useQueryClient()

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  const { data: serversData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['servers', selectedWorkspace?.uuid, currentPage],
    queryFn: () =>
      selectedWorkspace
        ? listServers(selectedWorkspace.uuid, currentPage, 20)
        : Promise.resolve({ servers: [], meta: { total: 0, page: 1, limit: 20 } }),
    enabled: !!selectedWorkspace,
    refetchInterval: 5000, // Poll every 5 seconds - LightD callbacks keep DB updated
  })

  const deleteMutation = useMutation({
    mutationFn: (serverUuid: string) => deleteServer(serverUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', selectedWorkspace?.uuid] })
    },
  })

  const servers = serversData?.servers || []
  const totalServers = serversData?.meta.total || 0

  const handleDelete = async (server: Server) => {
    if (!confirm(`Are you sure you want to delete server "${server.name}"?`)) return
    try {
      await deleteMutation.mutateAsync(server.uuid)
    } catch (err) {
      console.error('Failed to delete server:', err)
      alert('Failed to delete server')
    }
  }

  const getStatusBadge = (status: string) => {
    const base = 'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider border'
    switch (status) {
      case 'running':
        return `${base} bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800`
      case 'stopped':
        return `${base} bg-neutral-50 dark:bg-neutral-900/30 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800`
      case 'starting':
        return `${base} bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800`
      case 'installing':
        return `${base} bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800`
      case 'error':
        return `${base} bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800`
      default:
        return `${base} bg-neutral-50 dark:bg-neutral-900/30 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800`
    }
  }

  if (!selectedWorkspace) {
    return (
      <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        <Sidebar user={user} onLogout={onLogout} />
        <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
          <div className="text-center py-12">
            <p className="text-neutral-500">Please select a workspace</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <Sidebar user={user} onLogout={onLogout} />
      <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <PageHeader
            title="SERVERS"
            subtitle="Manage your deployed game servers and applications"
            actions={
              <RefreshButton onClick={() => refetch()} loading={isLoading || isFetching} />
            }
          />

          {/* Servers list */}
          <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <h2
                className="text-2xl text-neutral-900 dark:text-neutral-100 tracking-wider"
                style={{ fontFamily: "'Seven Segment', sans-serif" }}
              >
                YOUR SERVERS
              </h2>
              <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
              <span className="text-xs text-neutral-500" style={mono}>
                {totalServers} {totalServers === 1 ? 'Server' : 'Servers'}
              </span>
            </div>

            {isLoading && servers.length === 0 ? (
              <div className="p-8 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent"></div>
              </div>
            ) : servers.length === 0 ? (
              <div className="p-8 text-center">
                <ServerIcon className="h-12 w-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-4" />
                <p className="text-sm text-neutral-600 dark:text-neutral-500" style={mono}>
                  No servers yet
                </p>
              </div>
            ) : (
              <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50 divide-y divide-neutral-200 dark:divide-neutral-800/50">
                {servers.map((server) => (
                  <div key={server.uuid} className="p-4 hover:bg-neutral-100 dark:hover:bg-neutral-800/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="shrink-0">
                        <div className="w-10 h-10 flex items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900">
                          <ServerIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-600" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate" style={mono}>
                            {server.name}
                          </span>
                          <span className={getStatusBadge(server.status)} style={mono}>
                            {server.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400" style={mono}>
                          <span>ID: {server.uuid.slice(0, 8)}...</span>
                          <span className="text-neutral-300 dark:text-neutral-700">|</span>
                          <span>
                            {server.limits.memory / 1024 / 1024} MB RAM, {server.limits.cpu} vCPU
                          </span>
                        </div>
                        {server.status === 'error' && server.errorMessage && (
                          <div className="mt-1 text-[10px] text-red-600 dark:text-red-400" style={mono}>
                            Error: {server.errorMessage}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => window.location.href = `/servers/${server.uuid}`}
                          className="p-2 text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-900"
                          title="Manage server"
                        >
                          <Cog6ToothIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(server)}
                          className="p-2 text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900"
                          title="Delete server"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </main>

      {showCreateModal && selectedWorkspace && (
        <CreateServerModal
          workspaceId={selectedWorkspace.uuid}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            queryClient.invalidateQueries({ queryKey: ['servers', selectedWorkspace.uuid] })
          }}
        />
      )}
    </div>
  )
}

/* ─── Create Server Modal ─── */

function CreateServerModal({
  workspaceId,
  onClose,
  onSuccess,
}: {
  workspaceId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    softwareUuid: '',
    nodeUuid: '',
    volumeUuid: '',
    variables: {} as Record<string, string>,
  })

  const { data: softwareData, isLoading: loadingSoftware } = useQuery({
    queryKey: ['software'],
    queryFn: listSoftware,
  })

  const { data: nodesData, isLoading: loadingNodes } = useQuery({
    queryKey: ['available-nodes'],
    queryFn: listAvailableNodes,
  })

  const { data: volumesData, isLoading: loadingVolumes } = useQuery({
    queryKey: ['volumes', workspaceId],
    queryFn: () => listVolumes(workspaceId, 1, 100),
  })

  const software = softwareData?.software || []
  const nodes = nodesData?.nodes || []
  const volumes = volumesData?.volumes || []

  const selectedSoftware = software.find((s) => s.uuid === formData.softwareUuid)

  // Set defaults when data loads
  useEffect(() => {
    if (nodes.length > 0 && !formData.nodeUuid) {
      setFormData((prev) => ({ ...prev, nodeUuid: nodes[0].uuid }))
    }
  }, [nodes, formData.nodeUuid])

  useEffect(() => {
    if (software.length > 0 && !formData.softwareUuid) {
      setFormData((prev) => ({ ...prev, softwareUuid: software[0].uuid }))
    }
  }, [software, formData.softwareUuid])

  const createMutation = useMutation({
    mutationFn: (data: CreateServerRequest) => createServer(workspaceId, data),
    onSuccess: () => {
      setSuccess(true)
      setTimeout(() => onSuccess(), 1500)
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create server')
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const payload: CreateServerRequest = {
      name: formData.name,
      softwareUuid: formData.softwareUuid,
      nodeUuid: formData.nodeUuid,
    }

    if (formData.volumeUuid) {
      payload.volumeUuid = formData.volumeUuid
    }

    if (Object.keys(formData.variables).length > 0) {
      payload.variables = formData.variables
    }

    createMutation.mutate(payload)
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Create New Server" maxWidth="max-w-2xl">
      {success ? (
        <div className="flex items-center gap-2.5 p-4 border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 text-sm" style={mono}>
          <CheckCircleIcon className="h-5 w-5 shrink-0" />
          Server created successfully! Installing...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 text-xs" style={mono}>
              <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Input
            label="Server Name *"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="My Minecraft Server"
          />

          <div>
            <label className="block text-[10px] uppercase tracking-widest mb-2 text-neutral-500 dark:text-neutral-400" style={mono}>
              Software *
            </label>
            {loadingSoftware ? (
              <div className="flex h-16 w-16 justify-center items-center gap-2 p-2">
                <LoadingAnimation />
              </div>
            ) : software.length === 0 ? (
              <div className="p-4 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20">
                <p className="text-xs text-red-600 dark:text-red-400" style={mono}>
                  No software available. Please contact an administrator.
                </p>
              </div>
            ) : (
              <select
                value={formData.softwareUuid}
                onChange={(e) => setFormData({ ...formData, softwareUuid: e.target.value })}
                required
                className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                style={mono}
              >
                {software.map((sw) => (
                  <option key={sw.uuid} value={sw.uuid}>
                    {sw.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest mb-2 text-neutral-500 dark:text-neutral-400" style={mono}>
              Node *
            </label>
            {loadingNodes ? (
              <div className="flex h-16 w-16 justify-center items-center gap-2 p-2">
                <LoadingAnimation />
              </div>
            ) : nodes.length === 0 ? (
              <div className="p-4 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20">
                <p className="text-xs text-red-600 dark:text-red-400" style={mono}>
                  No online nodes available. Please contact an administrator.
                </p>
              </div>
            ) : (
              <select
                value={formData.nodeUuid}
                onChange={(e) => setFormData({ ...formData, nodeUuid: e.target.value })}
                required
                className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                style={mono}
              >
                {nodes.map((node) => (
                  <option key={node.uuid} value={node.uuid}>
                    {node.name} ({node.fqdn})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest mb-2 text-neutral-500 dark:text-neutral-400" style={mono}>
              Volume (Optional)
            </label>
            {loadingVolumes ? (
              <div className="flex h-16 w-16 justify-center items-center gap-2 p-2">
                <LoadingAnimation />
              </div>
            ) : (
              <select
                value={formData.volumeUuid}
                onChange={(e) => setFormData({ ...formData, volumeUuid: e.target.value })}
                className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                style={mono}
              >
                <option value="">No volume (ephemeral storage)</option>
                {volumes.map((vol) => (
                  <option key={vol.uuid} value={vol.uuid}>
                    {vol.name} ({vol.sizeMb} MB)
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedSoftware && selectedSoftware.variables.length > 0 && (
            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4">
              <h3 className="text-[10px] uppercase tracking-widest mb-3 text-neutral-500 dark:text-neutral-400" style={mono}>
                Configuration Variables
              </h3>
              <div className="space-y-3">
                {selectedSoftware.variables
                  .filter((v) => v.user_editable)
                  .map((variable) => (
                    <Input
                      key={variable.env_variable}
                      label={variable.name}
                      type={variable.field_type === 'number' ? 'number' : 'text'}
                      value={formData.variables[variable.env_variable] || variable.default_value}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          variables: {
                            ...formData.variables,
                            [variable.env_variable]: e.target.value,
                          },
                        })
                      }
                      helpText={variable.description}
                    />
                  ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end mt-6">
            <Button type="button" variant="secondary" onClick={onClose} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || loadingNodes || loadingSoftware || nodes.length === 0 || software.length === 0}
              isLoading={createMutation.isPending}
            >
              Create Server
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
