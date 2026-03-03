import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RequireAuth } from '../../components/RequireAuth'
import { Sidebar } from '../../components/sidebar'
import { useSidebar } from '../../contexts/SidebarContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import { logout } from '../../lib/auth-api'
import {
  listVolumes,
  deleteVolume,
  createVolume,
  formatMB,
  listAvailableNodes,
  type Volume,
  type CreateVolumeRequest,
} from '../../lib/volumes-api'
import { useState, useEffect } from 'react'
import {
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CubeIcon,
} from '@heroicons/react/24/outline'
import {
  AdminPageHeader,
  RefreshButton,
  ListPanel,
  AdminPagination,
  EmptyState,
} from '../../components/admin/AdminUI'
import { Modal, Button, Input, mono } from '../../components/ui'
import LoadingAnimation from '../../components/loader'
import { motion } from 'framer-motion'

export const Route = createFileRoute('/volumes/')({
  component: VolumesPage,
})

function VolumesPage() {
  return (
    <RequireAuth>
      {(user) => <VolumesContent user={user} />}
    </RequireAuth>
  )
}

function VolumesContent({ user }: { user: any }) {
  const { isCollapsed, isMobile } = useSidebar()
  const { selectedWorkspace } = useWorkspace()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const queryClient = useQueryClient()

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  // Fetch volumes with TanStack Query
  const { data: volumesData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['volumes', selectedWorkspace?.uuid, currentPage],
    queryFn: () => selectedWorkspace ? listVolumes(selectedWorkspace.uuid, currentPage, 20) : Promise.resolve({ volumes: [], meta: { total: 0, page: 1, limit: 20 } }),
    enabled: !!selectedWorkspace,
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (volumeUuid: string) => deleteVolume(volumeUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volumes', selectedWorkspace?.uuid] })
    },
  })

  const volumes = volumesData?.volumes || []
  const totalVolumes = volumesData?.meta.total || 0
  const totalPages = Math.max(1, Math.ceil(totalVolumes / 20))

  const handleDelete = async (volume: Volume) => {
    if (!confirm(`Are you sure you want to delete volume "${volume.name}"?`)) return
    try {
      await deleteMutation.mutateAsync(volume.uuid)
    } catch (err) {
      console.error('Failed to delete volume:', err)
      alert('Failed to delete volume')
    }
  }

  const getStatusBadge = (status: string) => {
    const base = 'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider border'
    switch (status) {
      case 'active':
        return `${base} bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800`
      case 'deleting':
        return `${base} bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800`
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
          {/* Header */}
          <AdminPageHeader
            title="VOLUMES"
            subtitle="Persistent storage for your servers"
            //icon={<CubeIcon className="h-8 w-8 text-red-500" />}
            actions={
              <>
                <RefreshButton onClick={() => refetch()} loading={isLoading || isFetching} />
                <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)} icon={<PlusIcon className="h-3.5 w-3.5" />}>
                  CREATE VOLUME
                </Button>
              </>
            }
          />

          {/* Volumes list */}
          <ListPanel
            header={`${totalVolumes} ${totalVolumes === 1 ? 'Volume' : 'Volumes'}`}
            headerRight={totalPages > 1 ? `Page ${currentPage} of ${totalPages}` : undefined}
            loading={isLoading && volumes.length === 0}
            loadingText="Loading volumes..."
            empty={volumes.length === 0 && !isLoading}
            emptyContent={
              <EmptyState
                icon={<CubeIcon className="h-10 w-10 text-neutral-300 dark:text-neutral-700 mx-auto" />}
                title="No volumes yet"
                subtitle="Create your first volume to get started with persistent storage."
                action={
                  <Button variant="primary" onClick={() => setShowCreateModal(true)} icon={<PlusIcon className="h-3.5 w-3.5" />}>
                    CREATE FIRST VOLUME
                  </Button>
                }
              />
            }
            footer={
              totalPages > 1 ? (
                <AdminPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalVolumes}
                  pageSize={20}
                  onPageChange={setCurrentPage}
                  disabled={isLoading}
                />
              ) : undefined
            }
          >
            {volumes.map((volume) => (
              <div
                key={volume.uuid}
                className="px-4 py-4 hover:bg-white dark:hover:bg-neutral-900 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <div className="w-10 h-10 flex items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900">
                      <CubeIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-600" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate" style={{ fontFamily: "'Space Mono', monospace" }}>
                        {volume.name}
                      </span>
                      <span className={getStatusBadge(volume.status)} style={{ fontFamily: "'Space Mono', monospace" }}>
                        {volume.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                      <span>{formatMB(volume.sizeMb)}</span>
                      <span className="text-neutral-300 dark:text-neutral-700">|</span>
                      <span>Used: {formatMB(volume.usedMb)}</span>
                      <span className="text-neutral-300 dark:text-neutral-700">|</span>
                      <span className="truncate">ID: {volume.uuid.slice(0, 8)}...</span>
                    </div>
                  </div>

                  <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0 text-[10px] text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                    <span>Created {new Date(volume.createdAt).toLocaleDateString()}</span>
                    <span>Updated {new Date(volume.updatedAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleDelete(volume)}
                      className="p-2 text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900"
                      title="Delete volume"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </ListPanel>
        </motion.div>
      </main>

      {showCreateModal && selectedWorkspace && (
        <CreateVolumeModal
          workspaceId={selectedWorkspace.uuid}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            queryClient.invalidateQueries({ queryKey: ['volumes', selectedWorkspace.uuid] })
          }}
        />
      )}
    </div>
  )
}

/* ─── Create Volume Modal ─── */

function CreateVolumeModal({
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
  const [customSize, setCustomSize] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    sizeMb: 1024,
    nodeUuid: '',
  })

  // Fetch nodes with TanStack Query
  const { data: nodesData, isLoading: loadingNodes } = useQuery({
    queryKey: ['available-nodes'],
    queryFn: listAvailableNodes,
  })

  const nodes = nodesData?.nodes || []

  // Set default node when nodes are loaded
  useEffect(() => {
    if (nodes.length > 0 && !formData.nodeUuid) {
      setFormData((prev) => ({ ...prev, nodeUuid: nodes[0].uuid }))
    }
  }, [nodes, formData.nodeUuid])

  // Create volume mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateVolumeRequest) => createVolume(data),
    onSuccess: () => {
      setSuccess(true)
      setTimeout(() => onSuccess(), 1500)
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create volume')
    },
  })

  // Preset sizes in MB
  const presetSizes = [
    { label: '1 GB', value: 1024 },
    { label: '5 GB', value: 5120 },
    { label: '10 GB', value: 10240 },
    { label: '20 GB', value: 20480 },
    { label: 'Custom', value: -1 },
  ]

  const handleSizePresetChange = (value: number) => {
    if (value === -1) {
      setCustomSize(true)
    } else {
      setCustomSize(false)
      setFormData({ ...formData, sizeMb: value })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    createMutation.mutate({
      ...formData,
      workspaceId,
    })
  }

  const inputCls = 'w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors'
  const labelCls = 'block text-[10px] uppercase tracking-widest mb-2 text-neutral-500 dark:text-neutral-400'

  return (
    <Modal isOpen={true} onClose={onClose} title="Create New Volume">
      {success ? (
        <div className="flex items-center gap-2.5 p-4 border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 text-sm" style={mono}>
          <CheckCircleIcon className="h-5 w-5 shrink-0" />
          Volume created successfully!
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
            label="Volume Name *"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="my-volume"
          />

          <div>
            <label className={labelCls} style={mono}>
              Volume Size *
            </label>

            {/* Size presets */}
            <div className="grid grid-cols-5 gap-2 mb-3">
              {presetSizes.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleSizePresetChange(preset.value)}
                  className={`px-2 py-2 text-[10px] uppercase tracking-wider border transition-colors ${(preset.value === -1 && customSize) || (preset.value !== -1 && !customSize && formData.sizeMb === preset.value)
                    ? 'bg-red-500 dark:bg-red-600 text-white border-red-500 dark:border-red-600'
                    : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600'
                    }`}
                  style={mono}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom size input */}
            {customSize && (
              <>
                <input
                  type="number"
                  value={formData.sizeMb}
                  onChange={(e) => setFormData({ ...formData, sizeMb: parseInt(e.target.value) || 1024 })}
                  required
                  min="1"
                  max="102400"
                  placeholder="Enter size in MB"
                  className={inputCls}
                  style={mono}
                />
                <span className="text-[9px] mt-1 text-neutral-400 block" style={mono}>
                  Enter custom size in MB (1024 MB = 1 GB, 10240 MB = 10 GB)
                </span>
              </>
            )}

            {!customSize && (
              <div className="text-[9px] text-neutral-500 dark:text-neutral-400" style={mono}>
                Selected: {formatMB(formData.sizeMb)}
              </div>
            )}
          </div>

          <div>
            <label className={labelCls} style={mono}>
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
                className={inputCls}
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

          <div className="flex gap-2 justify-end mt-6">
            <Button type="button" variant="secondary" onClick={onClose} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || loadingNodes || nodes.length === 0}
              isLoading={createMutation.isPending}
            >
              Create Volume
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
