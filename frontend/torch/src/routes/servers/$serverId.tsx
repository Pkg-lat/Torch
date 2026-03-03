import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RequireAuth } from '../../components/RequireAuth'
import { Sidebar } from '../../components/sidebar'
import { useSidebar } from '../../contexts/SidebarContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import { logout } from '../../lib/auth-api'
import { getServer, updateServerLimits, type Server } from '../../lib/servers-api'
import { useState } from 'react'
import { ArrowLeftIcon, ServerIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { PageHeader, Button, Input, mono } from '../../components/ui'
import { motion } from 'framer-motion'

export const Route = createFileRoute('/servers/$serverId')({
  component: ServerManagePage,
})

function ServerManagePage() {
  return (
    <RequireAuth>
      {(user) => <ServerManageContent user={user} />}
    </RequireAuth>
  )
}

function ServerManageContent({ user }: { user: any }) {
  const { isCollapsed, isMobile } = useSidebar()
  const { selectedWorkspace } = useWorkspace()
  const { serverId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  // Check if user is a guest
  const isGuest = selectedWorkspace?.role === 'guest'

  const { data: serverData, isLoading } = useQuery({
    queryKey: ['server', serverId],
    queryFn: () => getServer(serverId),
  })

  const server = serverData?.server

  // Get user limits
  const maxMemoryMB = user.limits?.memory_mb || 2048
  const maxCPU = ((user.limits?.vcpu || 100) / 100).toFixed(1)

  const [memoryMB, setMemoryMB] = useState<number>(0)
  const [cpu, setCpu] = useState<number>(0)

  // Initialize form when server loads
  useState(() => {
    if (server) {
      setMemoryMB(Math.round(server.limits.memory / 1024 / 1024))
      setCpu(server.limits.cpu)
    }
  })

  const updateMutation = useMutation({
    mutationFn: () => updateServerLimits(serverId, memoryMB, cpu),
    onSuccess: () => {
      setSuccess(true)
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['server', serverId] })
      queryClient.invalidateQueries({ queryKey: ['servers', selectedWorkspace?.uuid] })
      setTimeout(() => setSuccess(false), 3000)
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update server limits')
      setSuccess(false)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    updateMutation.mutate()
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

  if (isLoading || !server) {
    return (
      <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        <Sidebar user={user} onLogout={onLogout} />
        <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent"></div>
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
            title={server.name}
            subtitle="Manage server resource limits"
            actions={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate({ to: '/servers' })}
                icon={<ArrowLeftIcon className="h-3.5 w-3.5" />}
              >
                BACK TO SERVERS
              </Button>
            }
          />

          {/* Server Info */}
          <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <h2
                className="text-2xl text-neutral-900 dark:text-neutral-100 tracking-wider"
                style={{ fontFamily: "'Seven Segment', sans-serif" }}
              >
                SERVER INFO
              </h2>
              <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50 p-4">
                <div className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-2" style={mono}>
                  Server ID
                </div>
                <div className="text-sm text-neutral-900 dark:text-neutral-100" style={mono}>
                  {server.uuid}
                </div>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50 p-4">
                <div className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-2" style={mono}>
                  Status
                </div>
                <div className="text-sm text-neutral-900 dark:text-neutral-100 uppercase" style={mono}>
                  {server.status}
                </div>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50 p-4">
                <div className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-2" style={mono}>
                  Current Memory
                </div>
                <div className="text-sm text-neutral-900 dark:text-neutral-100" style={mono}>
                  {Math.round(server.limits.memory / 1024 / 1024)} MB
                </div>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50 p-4">
                <div className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-2" style={mono}>
                  Current CPU
                </div>
                <div className="text-sm text-neutral-900 dark:text-neutral-100" style={mono}>
                  {server.limits.cpu} vCPU
                </div>
              </div>
            </div>
          </div>

          {/* Resource Limits Form */}
          <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <h2
                className="text-2xl text-neutral-900 dark:text-neutral-100 tracking-wider"
                style={{ fontFamily: "'Seven Segment', sans-serif" }}
              >
                RESOURCE LIMITS
              </h2>
              <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
            </div>

            {success && (
              <div className="mb-4 flex items-center gap-2.5 p-4 border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 text-sm" style={mono}>
                <CheckCircleIcon className="h-5 w-5 shrink-0" />
                Limits updated successfully!
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-center gap-2 p-3 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 text-xs" style={mono}>
                <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isGuest && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-4">
                  <p className="text-xs text-red-700 dark:text-red-300" style={mono}>
                    Guests cannot edit server limits. Please contact an administrator or owner to upgrade your role.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4">
                <p className="text-xs text-blue-700 dark:text-blue-300" style={mono}>
                  Your account limits: {maxMemoryMB} MB RAM, {maxCPU} vCPU
                </p>
              </div>

              <Input
                label="Memory (MB)"
                type="number"
                value={memoryMB}
                onChange={(e) => setMemoryMB(parseInt(e.target.value) || 0)}
                min={128}
                max={maxMemoryMB}
                //step={128}
                required
                disabled={isGuest}
                helpText={`Minimum: 128 MB, Maximum: ${maxMemoryMB} MB`}
              />

              <Input
                label="CPU Cores"
                type="number"
                value={cpu}
                onChange={(e) => setCpu(parseFloat(e.target.value) || 0)}
                min={0.1}
                max={parseFloat(maxCPU)}
                step={0.1}
                required
                disabled={isGuest}
                helpText={`Minimum: 0.1 cores, Maximum: ${maxCPU} cores`}
              />

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate({ to: '/servers' })}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending || isGuest} isLoading={updateMutation.isPending}>
                  Update Limits
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
