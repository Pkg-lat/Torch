export type SessionUser = {
  uuid: string
  email: string
  usrname: string
  role?: 'premium' | 'admin' | 'free' | string
  billing?: {
    credits: number
    used: number
  }
  limits?: {
    vcpu: number
    memory_mb: number
    storage_mb: number
  }
}

type AuthSessionResponse = {
  authenticated: boolean
  user?: SessionUser
  provider?: string
  session?: any
}

type AuthProvider = {
  name: string
  type: 'oauth' | 'email'
  displayName: string
}

export type Org = {
  uuid: string
  name: string
  role?: 'owner' | 'admin' | 'moderator' | 'guest'
  tenantId?: string
}

export type OrgMember = {
  uuid: string
  email: string
  username: string
  role: 'owner' | 'admin' | 'moderator' | 'guest'
  joinedAt: string
}

export type OrgInvite = {
  uuid: string
  orgUuid: string
  orgName?: string
  email: string
  role: 'admin' | 'moderator' | 'guest'
  status: string
  createdAt: string
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '' // empty string for relative paths

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  // Ensure path starts with /
  const url = path.startsWith('/') ? `${SERVER_URL}${path}` : `${SERVER_URL}/${path}`
  
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

export async function getSession(): Promise<AuthSessionResponse> {
  return apiRequest<AuthSessionResponse>('/authenticate/session', { method: 'GET' })
}

export async function getProviders(): Promise<AuthProvider[]> {
  const data = await apiRequest<{ providers: AuthProvider[] }>('/authenticate/providers', {
    method: 'GET',
  })
  return data.providers || []
}

export async function loginWithEmail(email: string, password: string): Promise<void> {
  await apiRequest('/authenticate/email/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function registerWithEmail(email: string, username: string, password: string): Promise<void> {
  await apiRequest('/authenticate/email/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password }),
  })
}

export async function logout(): Promise<void> {
  await apiRequest('/authenticate/logout', { method: 'POST' })
}

export function beginOAuth(provider: string): void {
  window.location.href = `${SERVER_URL}/authenticate/${provider}`
}

export async function listOrgs(): Promise<Org[]> {
  const data = await apiRequest<{ orgs: Org[] }>('/orgs', { method: 'GET' })
  return (data.orgs || []).map((org) => ({
    ...org,
    tenantId: org.tenantId || org.uuid,
  }))
}

export async function createOrg(name: string): Promise<Org> {
  const data = await apiRequest<{ org: Org }>('/orgs', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  return data.org
}

export async function getOrgDetails(orgUuid: string): Promise<Org> {
  const data = await apiRequest<{ org: Org }>(`/orgs/${orgUuid}`, { method: 'GET' })
  return data.org
}

export async function getOrgMembers(orgUuid: string): Promise<OrgMember[]> {
  const data = await apiRequest<{ members: OrgMember[] }>(`/orgs/${orgUuid}/members`, { method: 'GET' })
  return data.members || []
}

export async function updateMemberRole(orgUuid: string, memberUuid: string, role: string): Promise<void> {
  await apiRequest(`/orgs/${orgUuid}/members/${memberUuid}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export async function removeMember(orgUuid: string, memberUuid: string): Promise<void> {
  await apiRequest(`/orgs/${orgUuid}/members/${memberUuid}`, { method: 'DELETE' })
}

export async function inviteToOrg(orgUuid: string, email: string, role: 'admin' | 'moderator' | 'guest'): Promise<OrgInvite> {
  const data = await apiRequest<{ invite: OrgInvite }>(`/orgs/${orgUuid}/invite`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  })
  return data.invite
}

export async function listMyInvites(): Promise<OrgInvite[]> {
  const data = await apiRequest<{ invites: OrgInvite[] }>('/org-invites', { method: 'GET' })
  return (data.invites || []).map((invite) => ({
    ...invite,
    orgName: invite.orgName || 'Unknown Organization',
  }))
}

export async function acceptInvite(inviteUuid: string): Promise<void> {
  await apiRequest(`/org-invites/${inviteUuid}/accept`, { method: 'POST' })
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiRequest('/authenticate/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export async function updateProfile(username: string): Promise<void> {
  await apiRequest('/authenticate/update-profile', {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
}

export type { Org, OrgInvite, OrgMember }

// Tenant-based API helper
export function createTenantApiRequest(tenantId: string) {
  return async function tenantApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    const url = `/api/client/${tenantId}${cleanPath}`

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
}
