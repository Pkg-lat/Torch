export interface SoftwareVariable {
  name: string
  description: string
  env_variable: string
  default_value: string
  user_viewable: boolean
  user_editable: boolean
  rules: string
  field_type: string
}

export interface SoftwareRuntime {
  'file-init': string
  'start-up': string
  stop: string
  _note?: string
}

export interface SoftwareNetworking {
  port_binds: Record<string, string>
}

export interface Software {
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

export interface ListSoftwareResponse {
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
    throw new Error(text || `HTTP ${response.status}`)
  }

  return response
}

export async function listSoftware(): Promise<ListSoftwareResponse> {
  const response = await fetchWithAuth('/api/software')
  return response.json()
}

export async function getSoftware(uuid: string): Promise<SoftwareResponse> {
  const response = await fetchWithAuth(`/api/software/${uuid}`)
  return response.json()
}
