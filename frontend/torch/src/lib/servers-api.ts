const API_BASE = import.meta.env.VITE_API_URL || '/'

export interface ServerPort {
  containerPort: number
  hostPort: number
  protocol: string
}

export interface ServerLimits {
  memory: number
  cpu: number
}

export interface ServerStats {
  cpuUsage: number
  memoryUsage: number
  memoryLimit: number
  networkRx: number
  networkTx: number
  blockRead: number
  blockWrite: number
}

export interface Server {
  uuid: string
  name: string
  workspaceId: string
  createdBy: string
  nodeUuid: string
  softwareUuid: string
  volumeUuid?: string
  lightdInternalId: string
  lightdVolumeId?: string
  image: string
  startupCommand: string
  startPattern: string
  installScript?: string
  ports: ServerPort[]
  limits: ServerLimits
  variables?: Record<string, string>
  status: string
  errorMessage?: string
  lightdData?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface Software {
  uuid: string
  name: string
  icon_url: string
  docker_images: Record<string, string>
  startup_cmd: string
  install_content: string
  update_content: string
  runtime: {
    'file-init': string
    'start-up': string
    stop: string
  }
  networking: {
    port_binds: Record<string, string>
  }
  variables: Array<{
    name: string
    description: string
    env_variable: string
    default_value: string
    user_viewable: boolean
    user_editable: boolean
    rules: string
    field_type: string
  }>
  createdAt: string
  updatedAt: string
}

export interface CreateServerRequest {
  name: string
  softwareUuid: string
  nodeUuid: string
  volumeUuid: string
  imageKey?: string
  variables?: Record<string, string>
}

export interface ListServersResponse {
  servers: Server[]
  meta: {
    total: number
    page: number
    limit: number
  }
}

export interface ServerResponse {
  server: Server
}

export interface CreateServerResponse {
  server: Server
}

export interface SoftwareListResponse {
  software: Software[]
}

export interface SoftwareResponse {
  software: Software
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    const error = new Error(text || `HTTP ${response.status}`)
    ;(error as any).status = response.status
    throw error
  }

  return response
}

export async function listSoftware(): Promise<SoftwareListResponse> {
  const response = await fetchWithAuth(`${API_BASE}api/software`)
  return response.json()
}

export async function getSoftware(uuid: string): Promise<SoftwareResponse> {
  const response = await fetchWithAuth(`${API_BASE}api/software/${uuid}`)
  return response.json()
}

export async function createServer(
  workspaceId: string,
  data: CreateServerRequest
): Promise<CreateServerResponse> {
  const response = await fetchWithAuth(`${API_BASE}api/servers/create?workspaceId=${workspaceId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return response.json()
}

export async function listServers(
  workspaceId: string,
  page = 1,
  pageSize = 20,
  queryMode?: 'database' | 'lightd'
): Promise<ListServersResponse> {
  const params = new URLSearchParams({
    workspaceId,
    page: page.toString(),
    pageSize: pageSize.toString(),
  })
  
  if (queryMode) {
    params.append('query', queryMode)
  }
  
  const response = await fetchWithAuth(`${API_BASE}api/servers?${params}`)
  return response.json()
}

export async function getServer(uuid: string): Promise<ServerResponse> {
  const response = await fetchWithAuth(`${API_BASE}api/servers/${uuid}`)
  return response.json()
}

export async function deleteServer(uuid: string): Promise<{ success: boolean }> {
  const response = await fetchWithAuth(`${API_BASE}api/servers/${uuid}`, {
    method: 'DELETE',
  })
  return response.json()
}

export async function updateServerLimits(
  uuid: string,
  memoryMb: number,
  cpu: number
): Promise<ServerResponse> {
  const response = await fetchWithAuth(`${API_BASE}api/servers/${uuid}/limits`, {
    method: 'PATCH',
    body: JSON.stringify({ memoryMb, cpu }),
  })
  return response.json()
}
