const API_BASE = import.meta.env.VITE_API_URL || '/'

export interface Volume {
  uuid: string
  name: string
  workspaceId: string
  createdBy: string
  nodeUuid: string
  lightdVolId: string
  sizeMb: number
  usedMb: number
  status: 'active' | 'deleting' | 'error'
  createdAt: string
  updatedAt: string
  lastSyncedAt: string
}

export interface CreateVolumeRequest {
  name: string
  sizeMb: number
  nodeUuid: string
  workspaceId: string
}

export interface ListVolumesResponse {
  volumes: Volume[]
  meta: {
    total: number
    page: number
    limit: number
  }
}

export interface VolumeResponse {
  volume: Volume
}

export interface CreateVolumeResponse {
  volume: Volume
}

export interface PublicNode {
  uuid: string
  name: string
  fqdn: string
  status: string
}

export interface NodesResponse {
  nodes: PublicNode[]
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
    // Add status to error for better handling
    ;(error as any).status = response.status
    throw error
  }

  return response
}

export async function createVolume(data: CreateVolumeRequest): Promise<CreateVolumeResponse> {
  const response = await fetchWithAuth(`/api/volumes/create`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return response.json()
}

export async function listVolumes(
  workspaceId: string,
  page = 1,
  limit = 20
): Promise<ListVolumesResponse> {
  const params = new URLSearchParams({
    workspaceId,
    page: page.toString(),
    limit: limit.toString(),
  })
  const response = await fetchWithAuth(`/api/volumes?${params}`)
  return response.json()
}

export async function getVolume(volumeUuid: string): Promise<VolumeResponse> {
  const response = await fetchWithAuth(`/api/volumes/${volumeUuid}`)
  return response.json()
}

export async function deleteVolume(volumeUuid: string): Promise<{ message: string }> {
  const response = await fetchWithAuth(`/api/volumes/${volumeUuid}`, {
    method: 'DELETE',
  })
  return response.json()
}

export async function listAvailableNodes(): Promise<NodesResponse> {
  const response = await fetchWithAuth(`/api/volumes/nodes`)
  return response.json()
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export function formatMB(mb: number): string {
  if (mb < 1024) return `${mb} MB`
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}
