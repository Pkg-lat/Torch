import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RequireAdmin } from '../../../components/RequireAdmin'
import { AdminSidebar } from '../../../components/admin-sidebar'
import { useSidebar } from '../../../contexts/SidebarContext'
import { logout } from '../../../lib/auth-api'
import {
  getAdminNode,
  updateAdminNode,
  deleteAdminNode,
  healthCheckNode,
  addNodeAllocations,
  removeNodeAllocations,
  formatTimestamp,
  type AdminNode,
} from '../../../lib/admin-api'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/admin/nodes/$nodeId')({
  component: AdminNodeDetailPage,
})

function AdminNodeDetailPage() {
  return (
    <RequireAdmin>
      {(user) => <AdminNodeDetailContent user={user} />}
    </RequireAdmin>
  )
}

// Bracket frame component
function BracketFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute -top-1 -left-1 text-neutral-500 dark:text-neutral-600 text-lg font-bold select-none">[</span>
      <span className="absolute -top-1 -right-1 text-neutral-500 dark:text-neutral-600 text-lg font-bold select-none">]</span>
      <span className="absolute -bottom-1 -left-1 text-neutral-500 dark:text-neutral-600 text-lg font-bold select-none">[</span>
      <span className="absolute -bottom-1 -right-1 text-neutral-500 dark:text-neutral-600 text-lg font-bold select-none">]</span>
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  )
}

// LCD stat box
function StatBox({ label, value, unit, color = 'red' }: { label: string; value: string | number; unit?: string; color?: 'red' | 'yellow' | 'green' | 'blue' }) {
  const colorMap = {
    red: 'text-red-600 dark:text-red-500',
    yellow: 'text-yellow-600 dark:text-yellow-500',
    green: 'text-emerald-600 dark:text-emerald-500',
    blue: 'text-blue-600 dark:text-blue-500',
  }

  return (
    <BracketFrame className="bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50">
      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-500 mb-1" style={{ fontFamily: "'Space Mono', monospace" }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl ${colorMap[color]}`} style={{ fontFamily: "'LCD14Condensed', monospace" }}>
          {value}
        </span>
        {unit && (
          <span className="text-xs text-neutral-600 dark:text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
            {unit}
          </span>
        )}
      </div>
    </BracketFrame>
  )
}

// Resource bar
function ResourceBar({ label, percent }: { label: string; percent: number }) {
  const barSegments = 20
  const filledSegments = Math.round((percent / 100) * barSegments)
  
  // Determine color based on percentage
  let percentColor = 'text-emerald-600 dark:text-emerald-400'
  if (percent > 90) percentColor = 'text-red-600 dark:text-red-400'
  else if (percent > 75) percentColor = 'text-orange-600 dark:text-orange-400'
  else if (percent > 50) percentColor = 'text-yellow-600 dark:text-yellow-400'
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
          {label}
        </span>
      </div>
      <div className="flex gap-[2px]">
        {Array.from({ length: barSegments }).map((_, i) => {
          const isFilled = i < filledSegments
          const segmentPercent = ((i + 1) / barSegments) * 100
          let color = 'bg-neutral-300 dark:bg-neutral-800'
          if (isFilled) {
            if (segmentPercent <= 50) color = 'bg-emerald-500'
            else if (segmentPercent <= 75) color = 'bg-yellow-500'
            else if (segmentPercent <= 90) color = 'bg-orange-500'
            else color = 'bg-red-500'
          }
          return (
            <div
              key={i}
              className={`h-4 flex-1 ${color} ${isFilled ? 'opacity-100' : 'opacity-30'}`}
            />
          )
        })}
      </div>
      <div className="text-right">
        <span className={`text-lg ${percentColor}`} style={{ fontFamily: "'Seven Segment', sans-serif" }}>
          {percent.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

function AdminNodeDetailContent({ user }: { user: any }) {
  const { nodeId } = Route.useParams()
  const navigate = useNavigate()
  const { isCollapsed, isMobile } = useSidebar()
  const [node, setNode] = useState<AdminNode | null>(null)
  const [healthData, setHealthData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [healthChecking, setHealthChecking] = useState(false)
  const [editForm, setEditForm] = useState<Partial<AdminNode>>({})
  const [showAddPorts, setShowAddPorts] = useState(false)
  const [portRange, setPortRange] = useState({ start: '', end: '', protocol: 'tcp' as 'tcp' | 'udp' })
  const [selectedPorts, setSelectedPorts] = useState<number[]>([])
  const [addingPorts, setAddingPorts] = useState(false)
  const [removingPorts, setRemovingPorts] = useState(false)

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  useEffect(() => {
    fetchNode()
  }, [nodeId])

  const fetchNode = async () => {
    setLoading(true)
    try {
      const data = await getAdminNode(nodeId)
      setNode(data.node)
      setEditForm(data.node)
    } catch (err) {
      console.error('Failed to fetch node:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleHealthCheck = async () => {
    setHealthChecking(true)
    try {
      const result = await healthCheckNode(nodeId)
      setHealthData(result)
      await fetchNode()
    } catch (err) {
      console.error('Health check failed:', err)
    } finally {
      setHealthChecking(false)
    }
  }

  const handleSave = async () => {
    if (!node) return

    try {
      const updates: any = {}
      if (editForm.name !== node.name) updates.name = editForm.name
      if (editForm.fqdn !== node.fqdn) updates.fqdn = editForm.fqdn
      if (editForm.ip !== node.ip) updates.ip = editForm.ip
      if (editForm.host?.host !== node.host.host) updates.host = editForm.host?.host
      if (editForm.host?.port !== node.host.port) updates.port = editForm.host?.port
      if (editForm.host?.sftpPort !== node.host.sftpPort) updates.sftpPort = editForm.host?.sftpPort
      if (editForm.image !== node.image) updates.image = editForm.image
      if (editForm.scheme !== node.scheme) updates.scheme = editForm.scheme
      if (editForm.maxServers !== node.maxServers) updates.maxServers = editForm.maxServers

      if (Object.keys(updates).length > 0) {
        await updateAdminNode(nodeId, updates)
        await fetchNode()
      }
      setEditing(false)
    } catch (err) {
      console.error('Failed to update node:', err)
      alert('Failed to update node')
    }
  }

  const handleDelete = async () => {
    if (!node || !confirm(`Are you sure you want to delete node "${node.name}"?`)) {
      return
    }

    try {
      await deleteAdminNode(nodeId)
      navigate({ to: '/admin/nodes' })
    } catch (err) {
      console.error('Failed to delete node:', err)
      alert('Failed to delete node')
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const handleAddPorts = async () => {
    const start = parseInt(portRange.start)
    const end = parseInt(portRange.end)

    if (isNaN(start) || isNaN(end) || start > end || start < 1 || end > 65535) {
      alert('Invalid port range. Ports must be between 1-65535 and start must be less than end.')
      return
    }

    const ports = []
    for (let i = start; i <= end; i++) {
      ports.push(i)
    }

    setAddingPorts(true)
    try {
      await addNodeAllocations(nodeId, ports, portRange.protocol)
      await fetchNode()
      setShowAddPorts(false)
      setPortRange({ start: '', end: '', protocol: 'tcp' })
    } catch (err) {
      console.error('Failed to add ports:', err)
      alert('Failed to add ports')
    } finally {
      setAddingPorts(false)
    }
  }

  const handleRemovePorts = async () => {
    if (selectedPorts.length === 0) {
      alert('No ports selected')
      return
    }

    if (!confirm(`Remove ${selectedPorts.length} port(s)?`)) {
      return
    }

    setRemovingPorts(true)
    try {
      // Group by protocol
      const tcpPorts = selectedPorts.filter(p => {
        const alloc = node?.allocations.find(a => a.port === p)
        return alloc?.protocol === 'tcp'
      })
      const udpPorts = selectedPorts.filter(p => {
        const alloc = node?.allocations.find(a => a.port === p)
        return alloc?.protocol === 'udp'
      })

      if (tcpPorts.length > 0) {
        await removeNodeAllocations(nodeId, tcpPorts, 'tcp')
      }
      if (udpPorts.length > 0) {
        await removeNodeAllocations(nodeId, udpPorts, 'udp')
      }

      await fetchNode()
      setSelectedPorts([])
    } catch (err) {
      console.error('Failed to remove ports:', err)
      alert('Failed to remove ports')
    } finally {
      setRemovingPorts(false)
    }
  }

  const togglePortSelection = (port: number) => {
    setSelectedPorts(prev =>
      prev.includes(port) ? prev.filter(p => p !== port) : [...prev, port]
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        <AdminSidebar user={user} onLogout={onLogout} />
        <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
          <div className="flex items-center justify-center h-64">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
          </div>
        </main>
      </div>
    )
  }

  if (!node) {
    return (
      <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        <AdminSidebar user={user} onLogout={onLogout} />
        <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
          <div className="text-center">
            <p className="text-neutral-500">Node not found</p>
          </div>
        </main>
      </div>
    )
  }

  const health = healthData?.health
  const system = health?.system

  return (
    <div className="min-h-screen min-w-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <AdminSidebar user={user} onLogout={onLogout} />
      <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {node.image ? (
                <img 
                  src={node.image} 
                  alt={node.name}
                  className="w-16 h-16 object-cover border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800"
                />
              ) : (
                <div className="w-16 h-16 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800">
                  <svg className="w-8 h-8 text-neutral-400 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                </div>
              )}
              <div>
                <h1 className="text-4xl md:text-5xl text-neutral-900 dark:text-neutral-100 tracking-wider mb-2" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
                  {node.name.toUpperCase()}
                </h1>
                <div className="flex items-center gap-3 text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>
                  <span className={`uppercase tracking-wider ${node.status === 'online' ? 'text-emerald-600 dark:text-emerald-400' : node.status === 'offline' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    [{node.status}]
                  </span>
                  <span className="text-neutral-500">•</span>
                  <span className="text-neutral-500">{node.fqdn}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleHealthCheck}
                disabled={healthChecking}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs transition-colors disabled:opacity-50 border border-blue-600"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                <svg className={`w-4 h-4 ${healthChecking ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                HEALTH CHECK
              </button>
              {!editing ? (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs transition-colors border border-neutral-300 dark:border-neutral-700"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    EDIT
                  </button>
                  <button
                    onClick={handleDelete}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs transition-colors border border-red-600"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    DELETE
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs transition-colors border border-emerald-600"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    SAVE
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false)
                      setEditForm(node)
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs transition-colors border border-neutral-300 dark:border-neutral-700"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    CANCEL
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Quick Stats 
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox label="Containers" value={healthData?.containerCount || node.currentServers} unit={`/ ${node.maxServers}`} color="blue" />
            <StatBox label="Status" value={node.status.toUpperCase()} color={node.status === 'online' ? 'green' : 'red'} />
            <StatBox label="Uptime" value={health?.uptime_seconds ? `${Math.floor(health.uptime_seconds / 3600)}h` : '--'} color="yellow" />
            <StatBox label="Version" value={health?.version || '--'} color="blue" />
          </div>*/}

          {/* System Stats */}
          {system && (
            <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl text-neutral-900 dark:text-neutral-100 tracking-wider" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
                  SYSTEM RESOURCES
                </h2>
                <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <ResourceBar label="CPU Usage" percent={system.cpu_usage_percent || 0} />
                  <ResourceBar label="Memory Usage" percent={system.memory_usage_percent || 0} />
                  <ResourceBar label="Disk Usage" percent={system.disk_usage_percent || 0} />
                </div>

                <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50 p-5">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-500 mb-3" style={{ fontFamily: "'Space Mono', monospace" }}>
                    System Information
                  </div>
                  <div className="space-y-3 text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-500">Hostname:</span>
                      <span className="text-neutral-900 dark:text-neutral-200">{system.hostname}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-500">OS:</span>
                      <span className="text-neutral-900 dark:text-neutral-200">{system.os}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-500">Kernel:</span>
                      <span className="text-neutral-900 dark:text-neutral-200">{system.kernel_version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-500">CPU Cores:</span>
                      <span className="text-neutral-900 dark:text-neutral-200">{system.cpu_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-500">Memory:</span>
                      <span className="text-neutral-900 dark:text-neutral-200">{formatBytes(system.memory_total_bytes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-500">Disk:</span>
                      <span className="text-neutral-900 dark:text-neutral-200">{formatBytes(system.disk_total_bytes)}</span>
                    </div>
                    {health?.docker && (
                      <div className="flex justify-between">
                        <span className="text-neutral-600 dark:text-neutral-500">Docker:</span>
                        <span className="text-neutral-900 dark:text-neutral-200">v{health.docker.version}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Configuration */}
          <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl text-neutral-900 dark:text-neutral-100 tracking-wider" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
                CONFIGURATION
              </h2>
              <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ConfigField label="Node Name" value={editing ? editForm.name : node.name} editing={editing} onChange={(value) => setEditForm({ ...editForm, name: value })} />
              <ConfigField label="FQDN" value={editing ? editForm.fqdn : node.fqdn} editing={editing} onChange={(value) => setEditForm({ ...editForm, fqdn: value })} />
              <ConfigField label="IP Address" value={editing ? editForm.ip : node.ip} editing={editing} onChange={(value) => setEditForm({ ...editForm, ip: value })} />
              <ConfigField label="Image URL" value={editing ? editForm.image : node.image} editing={editing} onChange={(value) => setEditForm({ ...editForm, image: value })} />
              <ConfigField label="Host" value={editing ? editForm.host?.host : node.host.host} editing={editing} onChange={(value) => setEditForm({ ...editForm, host: { ...editForm.host!, host: value } })} />
              <ConfigField label="API Port" value={editing ? editForm.host?.port?.toString() : node.host.port.toString()} editing={editing} type="number" onChange={(value) => setEditForm({ ...editForm, host: { ...editForm.host!, port: parseInt(value) || 8070 } })} />
              <ConfigField label="SFTP Port" value={editing ? editForm.host?.sftpPort?.toString() : node.host.sftpPort.toString()} editing={editing} type="number" onChange={(value) => setEditForm({ ...editForm, host: { ...editForm.host!, sftpPort: parseInt(value) || 2022 } })} />
              <ConfigField label="Scheme" value={editing ? editForm.scheme : node.scheme} editing={editing} type="select" options={['http', 'https']} onChange={(value) => setEditForm({ ...editForm, scheme: value })} />
              <ConfigField label="Max Servers" value={editing ? editForm.maxServers?.toString() : node.maxServers.toString()} editing={editing} type="number" onChange={(value) => setEditForm({ ...editForm, maxServers: parseInt(value) || 100 })} />
              <ConfigField label="UUID" value={node.uuid} editing={false} />
              <ConfigField label="Created" value={formatTimestamp(node.createdAt)} editing={false} />
              <ConfigField label="Last Updated" value={formatTimestamp(node.updatedAt)} editing={false} />
            </div>
          </div>

          {/* Port Allocations */}
          <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl text-neutral-900 dark:text-neutral-100 tracking-wider" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
                PORT ALLOCATIONS
              </h2>
              <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
              <div className="flex gap-2">
                {selectedPorts.length > 0 && (
                  <button
                    onClick={handleRemovePorts}
                    disabled={removingPorts}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs transition-colors disabled:opacity-50 border border-red-600"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    REMOVE ({selectedPorts.length})
                  </button>
                )}
                <button
                  onClick={() => setShowAddPorts(!showAddPorts)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs transition-colors border border-emerald-600"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  + ADD PORTS
                </button>
              </div>
            </div>

            {showAddPorts && (
              <div className="mb-6 p-4 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                      Start Port
                    </label>
                    <input
                      type="number"
                      value={portRange.start}
                      onChange={(e) => setPortRange({ ...portRange, start: e.target.value })}
                      placeholder="25565"
                      className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                      End Port
                    </label>
                    <input
                      type="number"
                      value={portRange.end}
                      onChange={(e) => setPortRange({ ...portRange, end: e.target.value })}
                      placeholder="25665"
                      className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                      Protocol
                    </label>
                    <select
                      value={portRange.protocol}
                      onChange={(e) => setPortRange({ ...portRange, protocol: e.target.value as 'tcp' | 'udp' })}
                      className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleAddPorts}
                      disabled={addingPorts}
                      className="w-full px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs transition-colors disabled:opacity-50 border border-emerald-600"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {addingPorts ? 'ADDING...' : 'ADD'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-500 mb-3" style={{ fontFamily: "'Space Mono', monospace" }}>
                <span>Total: {node.allocations?.length || 0} ports</span>
                <span>In Use: {node.allocations?.filter(a => a.inUse).length || 0}</span>
                <span>Available: {node.allocations?.filter(a => !a.inUse).length || 0}</span>
              </div>

              <div className="max-h-96 overflow-y-auto border border-neutral-300 dark:border-neutral-800/50">
                <table className="w-full text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>
                  <thead className="bg-neutral-200 dark:bg-neutral-900 sticky top-0">
                    <tr>
                      <th className="text-left p-2 border-b border-neutral-300 dark:border-neutral-800">
                        <input
                          type="checkbox"
                          checked={selectedPorts.length === node.allocations?.filter(a => !a.inUse).length && node.allocations?.filter(a => !a.inUse).length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPorts(node.allocations?.filter(a => !a.inUse).map(a => a.port) || [])
                            } else {
                              setSelectedPorts([])
                            }
                          }}
                          className="rounded border-neutral-400"
                        />
                      </th>
                      <th className="text-left p-2 border-b border-neutral-300 dark:border-neutral-800 uppercase tracking-wider">Port</th>
                      <th className="text-left p-2 border-b border-neutral-300 dark:border-neutral-800 uppercase tracking-wider">Protocol</th>
                      <th className="text-left p-2 border-b border-neutral-300 dark:border-neutral-800 uppercase tracking-wider">Status</th>
                      <th className="text-left p-2 border-b border-neutral-300 dark:border-neutral-800 uppercase tracking-wider">Server ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {node.allocations?.sort((a, b) => a.port - b.port).map((alloc) => (
                      <tr key={`${alloc.port}-${alloc.protocol}`} className="border-b border-neutral-200 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedPorts.includes(alloc.port)}
                            onChange={() => togglePortSelection(alloc.port)}
                            disabled={alloc.inUse}
                            className="rounded border-neutral-400 disabled:opacity-30"
                          />
                        </td>
                        <td className="p-2">{alloc.port}</td>
                        <td className="p-2 uppercase">{alloc.protocol}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 text-[10px] uppercase ${alloc.inUse ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'}`}>
                            {alloc.inUse ? 'IN USE' : 'FREE'}
                          </span>
                        </td>
                        <td className="p-2 text-neutral-500">{alloc.serverId || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function ConfigField({ 
  label, 
  value, 
  editing, 
  type = 'text',
  options,
  onChange 
}: { 
  label: string
  value?: string
  editing: boolean
  type?: 'text' | 'number' | 'select'
  options?: string[]
  onChange?: (value: string) => void
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
        {label}
      </label>
      {editing && onChange ? (
        type === 'select' ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {options?.map((opt) => (
              <option key={opt} value={opt}>{opt.toUpperCase()}</option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500"
            style={{ fontFamily: "'Space Mono', monospace" }}
          />
        )
      ) : (
        <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50 text-sm" style={{ fontFamily: "'Space Mono', monospace" }}>
          {value || '-'}
        </div>
      )}
    </div>
  )
}
