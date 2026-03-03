import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useSidebar } from '../contexts/SidebarContext'
import { getOrgMembers, inviteToOrg, listMyInvites, acceptInvite, updateMemberRole, removeMember, logout } from '../lib/auth-api'
import { Sidebar } from '../components/sidebar'
import { UserPlus, CheckCircle2, Mail, Shield, Trash2, ChevronDown } from 'lucide-react'
import { RequireAuth } from '../components/RequireAuth'
import { PageHeader, Button, Modal, Input, ListPanel, RefreshButton, mono } from '../components/ui'
import { motion } from 'framer-motion'

export const Route = createFileRoute('/org')({
  component: OrgPage,
})

function OrgPage() {
  return (
    <RequireAuth minRole="moderator" requireWorkspace>
      {(user) => <OrgContent user={user} />}
    </RequireAuth>
  )
}

function OrgContent({ user }: { user: any }) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const { selectedWorkspace, selectedWorkspaceId, refreshWorkspaces } = useWorkspace()
  const { isCollapsed, isMobile } = useSidebar()

  const canManageMembers = selectedWorkspace?.role === 'owner' || selectedWorkspace?.role === 'admin'

  const { data: invites = [], refetch: refreshInvites, isLoading: loadingInvites, isFetching: fetchingInvites } = useQuery({
    queryKey: ['myInvites'],
    queryFn: listMyInvites,
  })

  const { data: members = [], refetch: refreshMembers, isLoading: loadingMembers, isFetching: fetchingMembers } = useQuery({
    queryKey: ['orgMembers', selectedWorkspaceId],
    queryFn: () => selectedWorkspaceId ? getOrgMembers(selectedWorkspaceId) : Promise.resolve([]),
    enabled: !!selectedWorkspaceId,
  })

  const handleAcceptInvite = async (inviteUuid: string) => {
    try {
      setActionError(null)
      await acceptInvite(inviteUuid)
      setActionSuccess('Invite accepted successfully')
      await refreshInvites()
      await refreshWorkspaces() // Refresh workspace list after accepting invite
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept invite'
      setActionError(message)
    }
  }

  const handleUpdateRole = async (memberUuid: string, newRole: string) => {
    if (!selectedWorkspaceId || !canManageMembers) return
    try {
      setActionError(null)
      await updateMemberRole(selectedWorkspaceId, memberUuid, newRole)
      setActionSuccess('Member role updated')
      await refreshMembers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update member role'
      setActionError(message)
    }
  }

  const handleRemoveMember = async (memberUuid: string) => {
    if (!selectedWorkspaceId || !canManageMembers) return

    const memberToRemove = members.find(m => m.uuid === memberUuid)
    const isRemovingSelf = memberUuid === user?.uuid

    if (!confirm(`Are you sure you want to remove ${isRemovingSelf ? 'yourself' : memberToRemove?.username || 'this member'}?`)) return

    try {
      setActionError(null)
      await removeMember(selectedWorkspaceId, memberUuid)

      // Refresh workspace list to remove access
      await refreshWorkspaces()

      if (isRemovingSelf) {
        // If user removed themselves, redirect to home
        setActionSuccess('You have left the workspace')
        setTimeout(() => {
          window.location.href = '/'
        }, 1000)
      } else {
        setActionSuccess('Member removed')
        await refreshMembers()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member'
      setActionError(message)
    }
  }

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <Sidebar user={user} onLogout={onLogout} />
      <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
        <motion.div
          className="space-y-6"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1 }
            }
          }}
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            <PageHeader
              title="ORGANIZATION"
              subtitle={`Tenant ID: ${selectedWorkspace?.tenantId || selectedWorkspace?.uuid || 'N/A'}`}
              actions={
                <div className="flex gap-2 shrink-0">
                  <RefreshButton
                    onClick={() => { void refreshMembers(); void refreshInvites(); }}
                    loading={loadingMembers || loadingInvites || fetchingMembers || fetchingInvites}
                  />
                  {canManageMembers && selectedWorkspaceId && (
                    <Button variant="primary" onClick={() => setShowInviteModal(true)} icon={<UserPlus size={16} />}>
                      Invite Member
                    </Button>
                  )}
                </div>
              }
            />
          </motion.div>

          {actionError ? (
            <div className="border border-red-700/50 bg-red-900/20 text-red-200 px-3 py-2 text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>
              {actionError}
            </div>
          ) : null}

          {actionSuccess ? (
            <div className="border border-emerald-700/50 bg-emerald-900/20 text-emerald-200 px-3 py-2 text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>
              {actionSuccess}
            </div>
          ) : null}

          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            <ListPanel
              header={`Members (${members.length})`}
              loading={loadingMembers && members.length === 0}
              empty={members.length === 0 && !loadingMembers}
              emptyContent={<span className="text-xs text-neutral-500" style={mono}>No members in this workspace.</span>}
            >
              {members.map((member) => (
                <div key={member.uuid} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate text-neutral-900 dark:text-neutral-100" style={mono}>
                      {member.username || member.email}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-1" style={mono}>
                      {member.email}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <RoleBadge role={member.role} />
                    {canManageMembers && member.role !== 'owner' && member.uuid !== user.uuid && (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <select
                            value={member.role}
                            onChange={(e) => void handleUpdateRole(member.uuid, e.target.value)}
                            className="pl-3 pr-8 py-1.5 text-xs border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:outline-none focus:border-red-500 rounded-sm appearance-none"
                            style={mono}
                          >
                            <option value="admin">Admin</option>
                            <option value="moderator">Moderator</option>
                            <option value="guest">Guest</option>
                          </select>
                          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500" />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRemoveMember(member.uuid)}
                          className="px-2 text-red-500 hover:text-red-600 dark:hover:text-red-400 border border-neutral-200 dark:border-neutral-800 hover:border-red-500 dark:hover:border-red-500"
                          title="Remove member"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </ListPanel>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            <ListPanel
              header={`Pending Invites from other ORGANIZATIONS (${invites.length})`}
              loading={loadingInvites && invites.length === 0}
              empty={invites.length === 0 && !loadingInvites}
              emptyContent={<span className="text-xs text-neutral-500" style={mono}>No pending invites.</span>}
            >
              {invites.map((invite) => (
                <div key={invite.uuid} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate" style={mono}>
                      {invite.orgName || 'Unknown Organization'}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-2 mt-1.5" style={mono}>
                      <Mail size={12} />
                      <span>Role: {invite.role}</span>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="!bg-emerald-600 hover:!bg-emerald-700"
                    onClick={() => void handleAcceptInvite(invite.uuid)}
                    icon={<CheckCircle2 size={14} />}
                  >
                    Accept
                  </Button>
                </div>
              ))}
            </ListPanel>
          </motion.div>
        </motion.div>
      </main>

      {showInviteModal && selectedWorkspaceId && (
        <InviteModal orgUuid={selectedWorkspaceId} onClose={() => setShowInviteModal(false)} onInvited={refreshInvites} />
      )}
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const config = {
    owner: { icon: Shield, color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900' },
    admin: { icon: Shield, color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900' },
    moderator: { icon: Shield, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900' },
    guest: { icon: Mail, color: 'text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700' },
  }

  const { icon: Icon, color } = config[role as keyof typeof config] || config.guest

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 border text-xs ${color}`} style={{ fontFamily: "'Space Mono', monospace" }}>
      <Icon size={12} />
      <span className="uppercase">{role}</span>
    </div>
  )
}

function InviteModal({ orgUuid, onClose, onInvited }: { orgUuid: string; onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'moderator' | 'guest'>('guest')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    try {
      await inviteToOrg(orgUuid, email.trim(), role)
      alert('Invite sent!')
      onInvited()
      onClose()
    } catch (err) {
      console.error('Failed to invite:', err)
      alert('Failed to send invite')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Invite Member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="user@example.com"
        />

        <div>
          <label className="block text-[10px] uppercase tracking-widest mb-2 text-neutral-500 dark:text-neutral-400" style={mono}>
            Role
          </label>
          <div className="relative">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'moderator' | 'guest')}
              className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:border-red-500 text-neutral-900 dark:text-neutral-100 appearance-none rounded-sm transition-colors"
              style={mono}
            >
              <option value="guest">Guest - View only</option>
              <option value="moderator">Moderator - Can manage resources</option>
              <option value="admin">Admin - Full access except ownership</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500" />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !email.trim()} isLoading={loading}>
            Send Invite
          </Button>
        </div>
      </form>
    </Modal>
  )
}