// Admin API functions

export type AdminAuditLog = {
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

export type AdminStats = {
  totalUsers: number
  totalServers: number
  totalNodes: number
  totalLogs: number
}

type AuditLogsResponse = {
  logs: AdminAuditLog[]
  total: number
  limit: number
  skip: number
}

async function adminApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('/') ? path : `/${path}`

  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function getAdminAuditLogs(limit: number = 50, skip: number = 0): Promise<AuditLogsResponse> {
  return adminApiRequest<AuditLogsResponse>(`/api/admin/audit-logs?limit=${limit}&skip=${skip}`)
}

export async function getAdminStats(): Promise<AdminStats> {
  return adminApiRequest<AdminStats>('/api/admin/stats')
}

// Helper functions
export function formatTimestamp(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return `${diffSecs}s ago`
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return formatTimestamp(date)
}

export function getStatusColor(status: string): string {
  return status === 'success'
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400'
}

export function getStatusBadgeClass(status: string): string {
  return status === 'success'
    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900'
    : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900'
}

// User Management Types
export type AdminUser = {
  uuid: string
  email: string
  usrname: string
  role: string
  created_at: string
  last_updated: string
  limits?: {
    vcpu?: number
    memory_mb?: number
    storage_mb?: number
  }
  billing?: {
    credits: number
    used: number
  }
  sessions?: Array<{
    session_id: string
    provider: string
    last_seen_at: string
  }>
}

// User limits type
export type UserLimits = {
  vcpu: number
  memory_mb: number
  storage_mb: number
}

type UsersResponse = {
  users: AdminUser[]
  total: number
  limit: number
  skip: number
}

// User Management Functions
export async function getAdminUsers(limit: number = 50, skip: number = 0): Promise<UsersResponse> {
  return adminApiRequest<UsersResponse>(`/api/admin/users?limit=${limit}&skip=${skip}`)
}

export async function updateUserRole(userUuid: string, role: string): Promise<void> {
  await adminApiRequest('/api/admin/users/role', {
    method: 'POST',
    body: JSON.stringify({ userUuid, role }),
  })
}

export async function updateUserEmail(userUuid: string, email: string): Promise<void> {
  await adminApiRequest('/api/admin/users/email', {
    method: 'POST',
    body: JSON.stringify({ userUuid, email }),
  })
}

export async function resetUserPassword(userUuid: string, newPassword: string): Promise<void> {
  await adminApiRequest('/api/admin/users/password', {
    method: 'POST',
    body: JSON.stringify({ userUuid, newPassword }),
  })
}

export async function clearUserSessions(userUuid: string): Promise<void> {
  await adminApiRequest('/api/admin/users/sessions', {
    method: 'POST',
    body: JSON.stringify({ userUuid }),
  })
}

export async function banUser(userUuid: string): Promise<void> {
  await adminApiRequest('/api/admin/users/ban', {
    method: 'POST',
    body: JSON.stringify({ userUuid }),
  })
}

export async function unbanUser(userUuid: string): Promise<void> {
  await adminApiRequest('/api/admin/users/unban', {
    method: 'POST',
    body: JSON.stringify({ userUuid }),
  })
}

export async function updateUserLimits(userUuid: string, limits: { vcpu: number; memory_mb: number; storage_mb: number }): Promise<void> {
  await adminApiRequest('/api/admin/users/limits', {
    method: 'POST',
    body: JSON.stringify({ userUuid, limits }),
  })
}

export async function updateUserCredits(
  userUuid: string,
  operation: 'add' | 'remove' | 'set',
  amount: number,
  note: string,
): Promise<void> {
  await adminApiRequest('/api/admin/users/credits', {
    method: 'POST',
    body: JSON.stringify({ userUuid, operation, amount, note }),
  })
}


// Node Management Types
export type PortAllocation = {
  port: number
  protocol: string
  inUse: boolean
  serverId?: string
}

export type AdminNode = {
  uuid: string
  name: string
  fqdn: string
  ip: string
  host: {
    host: string
    port: number
    sftpPort: number
  }
  image: string
  scheme: string
  allocations: PortAllocation[]
  createdAt: string
  updatedAt: string
  maxServers: number
  currentServers: number
  status: string
  lastHealthCheck?: string
}

type NodesResponse = {
  nodes: AdminNode[]
}

type NodeResponse = {
  node: AdminNode
}

export type SystemStats = {
  hostname: string
  os: string
  kernel_version: string
  cpu_count: number
  cpu_usage_percent: number
  memory_total_bytes: number
  memory_used_bytes: number
  memory_available_bytes: number
  memory_usage_percent: number
  disk_total_bytes: number
  disk_used_bytes: number
  disk_available_bytes: number
  disk_usage_percent: number
}

export type DockerInfo = {
  available: boolean
  version: string
}

export type HealthData = {
  status: string
  version: string
  uptime_seconds: number
  system?: SystemStats
  docker?: DockerInfo
}

export type HealthCheckResponse = {
  status: string
  healthy: boolean
  error?: string
  health?: HealthData
  containerCount?: number
}

// Node Management Functions
export async function getAdminNodes(): Promise<NodesResponse> {
  return adminApiRequest<NodesResponse>('/api/admin/nodes')
}

export async function getAdminNode(nodeUuid: string): Promise<NodeResponse> {
  return adminApiRequest<NodeResponse>(`/api/admin/nodes/${nodeUuid}`)
}

export async function createAdminNode(data: {
  name: string
  fqdn: string
  ip: string
  host: string
  port: number
  sftpPort: number
  image: string
  secretToken: string
  scheme: string
  maxServers: number
}): Promise<NodeResponse> {
  return adminApiRequest<NodeResponse>('/api/admin/nodes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteAdminNode(nodeUuid: string): Promise<void> {
  await adminApiRequest(`/api/admin/nodes/${nodeUuid}`, {
    method: 'DELETE',
  })
}

export async function healthCheckNode(nodeUuid: string): Promise<HealthCheckResponse> {
  return adminApiRequest<HealthCheckResponse>(`/api/admin/nodes/${nodeUuid}/health`, {
    method: 'POST',
  })
}


export async function updateAdminNode(nodeUuid: string, data: Partial<{
  name: string
  fqdn: string
  ip: string
  host: string
  port: number
  sftpPort: number
  image: string
  secretToken: string
  scheme: string
  maxServers: number
}>): Promise<NodeResponse> {
  return adminApiRequest<NodeResponse>(`/api/admin/nodes/${nodeUuid}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// Port Allocation Management
export async function addNodeAllocations(
  nodeUuid: string,
  ports: number[],
  protocol: 'tcp' | 'udp' = 'tcp'
): Promise<NodeResponse> {
  return adminApiRequest<NodeResponse>(`/api/admin/nodes/${nodeUuid}/allocations`, {
    method: 'POST',
    body: JSON.stringify({ ports, protocol }),
  })
}

export async function removeNodeAllocations(
  nodeUuid: string,
  ports: number[],
  protocol: 'tcp' | 'udp' = 'tcp'
): Promise<NodeResponse> {
  return adminApiRequest<NodeResponse>(`/api/admin/nodes/${nodeUuid}/allocations`, {
    method: 'DELETE',
    body: JSON.stringify({ ports, protocol }),
  })
}

// Software Management Types
export type SoftwareVariable = {
  name: string
  description: string
  env_variable: string
  default_value: string
  user_viewable: boolean
  user_editable: boolean
  rules: string
  field_type: string
}

export type SoftwareRuntime = {
  'file-init': string
  'start-up': string
  stop: string
  _note?: string
}

export type SoftwareNetworking = {
  port_binds: Record<string, string>
}

export type Software = {
  uuid: string
  name: string
  icon_url: string
  docker_images: Record<string, string>
  startup_cmd: string
  install_content: string
  update_content: string
  runtime: SoftwareRuntime
  networking: SoftwareNetworking
  variables: SoftwareVariable[]
  createdAt: string
  updatedAt: string
  exported_at?: string
  _note?: string
}

type SoftwareListResponse = {
  software: Software[]
}

type SoftwareResponse = {
  software: Software
}

// Software Management Functions
export async function getAdminSoftware(): Promise<SoftwareListResponse> {
  return adminApiRequest<SoftwareListResponse>('/api/admin/software')
}

export async function getAdminSoftwareById(uuid: string): Promise<SoftwareResponse> {
  return adminApiRequest<SoftwareResponse>(`/api/admin/software/${uuid}`)
}

export async function createAdminSoftware(data: Omit<Software, 'uuid' | 'createdAt' | 'updatedAt'>): Promise<SoftwareResponse> {
  return adminApiRequest<SoftwareResponse>('/api/admin/software', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateAdminSoftware(uuid: string, data: Partial<Software>): Promise<SoftwareResponse> {
  return adminApiRequest<SoftwareResponse>(`/api/admin/software/${uuid}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteAdminSoftware(uuid: string): Promise<void> {
  await adminApiRequest(`/api/admin/software/${uuid}`, {
    method: 'DELETE',
  })
}

// Parse variables from text content (finds {{VARIABLE_NAME}} patterns)
export function parseVariablesFromText(text: string): string[] {
  const regex = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g
  const matches = text.matchAll(regex)
  const variables = new Set<string>()
  for (const match of matches) {
    variables.add(match[1])
  }
  return Array.from(variables)
}
