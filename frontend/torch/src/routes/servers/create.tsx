import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { RequireAuth } from '../../components/RequireAuth'
import { Sidebar } from '../../components/sidebar'
import { useSidebar } from '../../contexts/SidebarContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import { logout } from '../../lib/auth-api'
import {
  createServer,
  listSoftware,
  type CreateServerRequest,
} from '../../lib/servers-api'
import { listAvailableNodes, listVolumes } from '../../lib/volumes-api'
import { useState, useEffect } from 'react'
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ServerIcon,
} from '@heroicons/react/24/outline'
import { PageHeader, mono, Button, Input } from '../../components/ui'
import LoadingAnimation from '../../components/loader'
import { motion } from 'framer-motion'

export const Route = createFileRoute('/servers/create')({
  component: CreateServerPage,
})

function CreateServerPage() {
  return (
    <RequireAuth>
      {(user) => <CreateServerContent user={user} />}
    </RequireAuth>
  )
}

function CreateServerContent({ user }: { user: any }) {
  const { isCollapsed, isMobile } = useSidebar()
  const { selectedWorkspace } = useWorkspace()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    softwareUuid: '',
    nodeUuid: '',
    volumeUuid: '',
    variables: {} as Record<string, string>,
  })

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  // Check if user is a guest
  const isGuest = selectedWorkspace?.role === 'guest'

  const { data: softwareData, isLoading: loadingSoftware } = useQuery({
    queryKey: ['software'],
    queryFn: listSoftware,
  })

  const { data: nodesData, isLoading: loadingNodes } = useQuery({
    queryKey: ['available-nodes'],
    queryFn: listAvailableNodes,
  })

  const { data: volumesData, isLoading: loadingVolumes } = useQuery({
    queryKey: ['volumes', selectedWorkspace?.uuid],
    queryFn: () => (selectedWorkspace ? listVolumes(selectedWorkspace.uuid, 1, 100) : Promise.resolve({ volumes: [], meta: { total: 0, page: 1, limit: 100 } })),
    enabled: !!selectedWorkspace,
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
    mutationFn: (data: CreateServerRequest) => {
      if (!selectedWorkspace) throw new Error('No workspace selected')
      return createServer(selectedWorkspace.uuid, data)
    },
    onSuccess: () => {
      setSuccess(true)
      setTimeout(() => {
        navigate({ to: '/servers' })
      }, 2000)
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create server')
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedWorkspace) {
      setError('Please select a workspace')
      return
    }

    if (!formData.volumeUuid) {
      setError('Please select a volume - persistent storage is required')
      return
    }

    const payload: CreateServerRequest = {
      name: formData.name,
      softwareUuid: formData.softwareUuid,
      nodeUuid: formData.nodeUuid,
      volumeUuid: formData.volumeUuid,
    }

    if (Object.keys(formData.variables).length > 0) {
      payload.variables = formData.variables
    }

    createMutation.mutate(payload)
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

  // Show access denied for guests
  if (isGuest) {
    return (
      <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        <Sidebar user={user} onLogout={onLogout} />
        <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
          >
            <PageHeader
              title="CREATE SERVER"
              subtitle="Deploy a new game server or application"
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate({ to: '/servers' })}
                  icon={<ArrowLeftIcon className="h-3.5 w-3.5" />}
                >
                  BACK
                </Button>
              }
            />
            <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-8">
              <div className="flex items-center gap-3 p-4 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300" style={mono}>
                <ExclamationCircleIcon className="h-6 w-6 shrink-0" />
                <div>
                  <p className="font-medium mb-1">Access Denied</p>
                  <p className="text-sm">Guests do not have permission to create servers. Please contact an administrator or owner to upgrade your role.</p>
                </div>
              </div>
            </div>
          </motion.div>
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
          className="space-y-8 "
        >
          <PageHeader
            title="CREATE SERVER"
            subtitle="Deploy a new game server or application"
            actions={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate({ to: '/servers' })}
                icon={<ArrowLeftIcon className="h-3.5 w-3.5" />}
              >
                BACK
              </Button>
            }
          />

          {success ? (
            <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-8">
              <div className="flex items-center gap-3 p-4 border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300" style={mono}>
                <CheckCircleIcon className="h-6 w-6 shrink-0" />
                <div>
                  <p className="font-medium mb-1">Server created successfully!</p>
                  <p className="text-sm">Installing and starting your server... Redirecting to servers list.</p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-3 p-4 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300" style={mono}>
                  <ExclamationCircleIcon className="h-5 w-5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Basic Info */}
              <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <h2
                    className="text-lg text-neutral-900 dark:text-neutral-100 tracking-wider"
                    style={{ fontFamily: "'Seven Segment', sans-serif" }}
                  >
                    BASIC INFO
                  </h2>
                  <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
                </div>

                <Input
                  label="Server Name *"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="My Minecraft Server"
                  helpText="A friendly name to identify your server"
                />
              </div>

              {/* Software Selection */}
              <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <h2
                    className="text-lg text-neutral-900 dark:text-neutral-100 tracking-wider"
                    style={{ fontFamily: "'Seven Segment', sans-serif" }}
                  >
                    SOFTWARE
                  </h2>
                  <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
                </div>

                {loadingSoftware ? (
                  <div className="flex h-16 w-16 justify-center items-center">
                    <LoadingAnimation />
                  </div>
                ) : software.length === 0 ? (
                  <div className="p-4 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20">
                    <p className="text-sm text-red-600 dark:text-red-400" style={mono}>
                      No software available. Please contact an administrator.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {software.map((sw) => (
                      <button
                        key={sw.uuid}
                        type="button"
                        onClick={() => setFormData({ ...formData, softwareUuid: sw.uuid })}
                        className={`p-4 border text-left transition-all ${
                          formData.softwareUuid === sw.uuid
                            ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                            : 'border-neutral-300 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {sw.icon_url ? (
                            <img src={sw.icon_url} alt={sw.name} className="w-10 h-10 object-contain" />
                          ) : (
                            <div className="w-10 h-10 flex items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900">
                              <ServerIcon className="h-5 w-5 text-neutral-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1" style={mono}>
                              {sw.name}
                            </h3>
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400" style={mono}>
                              {Object.keys(sw.docker_images).length} image(s) available
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Location & Resources */}
              <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <h2
                    className="text-lg text-neutral-900 dark:text-neutral-100 tracking-wider"
                    style={{ fontFamily: "'Seven Segment', sans-serif" }}
                  >
                    LOCATION
                  </h2>
                  <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest mb-2 text-neutral-500 dark:text-neutral-400" style={mono}>
                      Node *
                    </label>
                    {loadingNodes ? (
                      <div className="flex h-16 w-16 justify-center items-center">
                        <LoadingAnimation />
                      </div>
                    ) : nodes.length === 0 ? (
                      <div className="p-4 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20">
                        <p className="text-sm text-red-600 dark:text-red-400" style={mono}>
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
                      Volume *
                    </label>
                    {loadingVolumes ? (
                      <div className="flex h-16 w-16 justify-center items-center">
                        <LoadingAnimation />
                      </div>
                    ) : volumes.length === 0 ? (
                      <div className="p-4 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20">
                        <p className="text-sm text-red-600 dark:text-red-400" style={mono}>
                          No volumes available. Please create a volume first.
                        </p>
                      </div>
                    ) : (
                      <select
                        value={formData.volumeUuid}
                        onChange={(e) => setFormData({ ...formData, volumeUuid: e.target.value })}
                        required
                        className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                        style={mono}
                      >
                        <option value="">Select a volume...</option>
                        {volumes.map((vol) => (
                          <option key={vol.uuid} value={vol.uuid}>
                            {vol.name} ({vol.sizeMb} MB)
                          </option>
                        ))}
                      </select>
                    )}
                    <span className="text-[9px] mt-1 text-neutral-400 block" style={mono}>
                      Persistent storage is required for all servers
                    </span>
                  </div>
                </div>
              </div>

              {/* Configuration Variables */}
              {selectedSoftware && selectedSoftware.variables.length > 0 && (
                <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <h2
                      className="text-lg text-neutral-900 dark:text-neutral-100 tracking-wider"
                      style={{ fontFamily: "'Seven Segment', sans-serif" }}
                    >
                      CONFIGURATION
                    </h2>
                    <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
                  </div>

                  <div className="space-y-4">
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

              {/* Submit */}
              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate({ to: '/servers' })}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || 
                    loadingNodes || 
                    loadingSoftware || 
                    nodes.length === 0 || 
                    software.length === 0 || 
                    volumes.length === 0 ||
                    !formData.volumeUuid
                  }
                  isLoading={createMutation.isPending}
                >
                  Create Server
                </Button>
              </div>
            </form>
          )}
        </motion.div>
      </main>
    </div>
  )
}
