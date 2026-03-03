import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { RequireAdmin } from '../../components/RequireAdmin'
import { AdminSidebar } from '../../components/admin-sidebar'
import {
  PageHeader,
  RefreshButton,
  SearchBar,
  FilterPills,
  ListPanel,
  Pagination,
  NoMatchState,
  EmptyState,
  Modal,
} from '../../components/ui'
import { useSidebar } from '../../contexts/SidebarContext'
import { logout } from '../../lib/auth-api'
import {
  getAdminUsers,
  updateUserRole,
  updateUserEmail,
  resetUserPassword,
  clearUserSessions,
  banUser,
  unbanUser,
  updateUserLimits,
  updateUserCredits,
  formatTimestamp,
  type AdminUser,
} from '../../lib/admin-api'
import { useMemo, useState, useRef, useEffect } from 'react'
import {
  UsersIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
  KeyIcon,
  ArrowRightStartOnRectangleIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  AdjustmentsHorizontalIcon,
  CurrencyDollarIcon,
  ClockIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import {
  ShieldCheckIcon as ShieldCheckSolidIcon,
} from '@heroicons/react/24/solid'

export const Route = createFileRoute('/admin/users')({
  component: AdminUsersPage,
})

function AdminUsersPage() {
  return (
    <RequireAdmin>
      {(user) => <AdminUsersContent user={user} />}
    </RequireAdmin>
  )
}

type RoleFilter = 'all' | 'admin' | 'premium' | 'free' | 'banned'

function AdminUsersContent({ user }: { user: any }) {
  const { isCollapsed, isMobile } = useSidebar()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [showModal, setShowModal] = useState<'role' | 'email' | 'password' | 'sessions' | 'ban' | 'limits' | 'credits' | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  const { data, isLoading: loading, isFetching, refetch: fetchUsers } = useQuery({
    queryKey: ['admin-users', page, pageSize],
    queryFn: async () => {
      const skip = (page - 1) * pageSize
      return getAdminUsers(pageSize, skip)
    }
  })

  const users = data?.users || []
  const total = data?.total || 0

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setPage(1)
  }

  const openModal = (modalType: typeof showModal, userToEdit: AdminUser) => {
    setSelectedUser(userToEdit)
    setShowModal(modalType)
  }

  const closeModal = () => {
    setShowModal(null)
    setSelectedUser(null)
  }

  // Client-side search + filter on the fetched page
  const filteredUsers = useMemo(() => {
    let result = users
    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (u) =>
          u.usrname.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.uuid.toLowerCase().includes(q),
      )
    }
    return result
  }, [users, roleFilter, search])


  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900'
      case 'premium':
        return 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900'
      case 'banned':
        return 'bg-neutral-800 dark:bg-neutral-900 text-neutral-100 dark:text-neutral-300 border-neutral-900 dark:border-neutral-800'
      default:
        return 'bg-neutral-50 dark:bg-neutral-900/30 text-neutral-700 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <ShieldCheckSolidIcon className="h-3.5 w-3.5 text-red-500" />
      case 'premium':
        return <ShieldCheckIcon className="h-3.5 w-3.5 text-purple-500" />
      case 'banned':
        return <NoSymbolIcon className="h-3.5 w-3.5 text-neutral-500" />
      default:
        return <UserIcon className="h-3.5 w-3.5 text-neutral-400" />
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <AdminSidebar user={user} onLogout={onLogout} />
      <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
        <div className="space-y-6">

          {/* Header */}
          <PageHeader
            title="USERS"
            subtitle="Manage all user accounts and permissions"
            icon={<UsersIcon className="h-8 w-8 text-red-500" />}
            actions={<RefreshButton onClick={fetchUsers} loading={loading || isFetching} />}
          />

          {/* Search + Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by username, email, or UUID..."
            />
            <FilterPills
              options={['all', 'admin', 'premium', 'free', 'banned'] as RoleFilter[]}
              value={roleFilter}
              onChange={setRoleFilter}
            />
          </div>

          {/* Users list */}
          <ListPanel
            header={
              filteredUsers.length === users.length
                ? `All Users (${total})`
                : `Showing ${filteredUsers.length} of ${users.length} loaded`
            }
            loading={loading}
            loadingText="Loading users..."
            empty={filteredUsers.length === 0 && !loading}
            emptyContent={
              users.length === 0 ? (
                <EmptyState
                  icon={<UserIcon className="h-10 w-10 text-neutral-300 dark:text-neutral-700 mx-auto" />}
                  title="No users found"
                />
              ) : (
                <NoMatchState onClear={() => { setSearch(''); setRoleFilter('all') }} />
              )
            }
            footer={
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={[25, 50, 100, 200]}
              />
            }
          >
            {filteredUsers.map((u) => (
              <div key={u.uuid} className="px-4 py-4 hover:bg-white dark:hover:bg-neutral-900 transition-colors">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="shrink-0 w-10 h-10 flex items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900">
                    <UserIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-600" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate" style={{ fontFamily: "'Space Mono', monospace" }}>
                        {u.usrname}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider border ${getRoleBadgeClass(u.role)}`} style={{ fontFamily: "'Space Mono', monospace" }}>
                        {getRoleIcon(u.role)}
                        {u.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                      <EnvelopeIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="hidden lg:flex flex-col items-end gap-0.5 shrink-0 text-[10px] text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                    <div className="flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      <span>Joined {formatTimestamp(u.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ArrowRightStartOnRectangleIcon className="h-3 w-3" />
                      <span>{u.sessions?.length || 0} sessions</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <button
                      onClick={() => openModal('role', u)}
                      className="p-2 text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900"
                      title="Change Role"
                    >
                      <ShieldCheckIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openModal('email', u)}
                      className="p-2 text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-900"
                      title="Update Email"
                    >
                      <EnvelopeIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openModal('password', u)}
                      className="p-2 text-neutral-500 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950/30 transition-colors border border-transparent hover:border-yellow-200 dark:hover:border-yellow-900"
                      title="Reset Password"
                    >
                      <KeyIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openModal('sessions', u)}
                      className="p-2 text-neutral-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors border border-transparent hover:border-orange-200 dark:hover:border-orange-900"
                      title="Clear Sessions"
                    >
                      <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openModal('ban', u)}
                      className={`p-2 transition-colors border border-transparent ${u.role === 'banned'
                        ? 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-200 dark:hover:border-emerald-900'
                        : 'text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-200 dark:hover:border-red-900'
                        }`}
                      title={u.role === 'banned' ? 'Unban User' : 'Ban User'}
                    >
                      {u.role === 'banned' ? <CheckCircleIcon className="h-4 w-4" /> : <NoSymbolIcon className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => openModal('limits', u)}
                      className="p-2 text-neutral-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors border border-transparent hover:border-purple-200 dark:hover:border-purple-900"
                      title="Edit Limits"
                    >
                      <AdjustmentsHorizontalIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openModal('credits', u)}
                      className="p-2 text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-900"
                      title="Edit Credits"
                    >
                      <CurrencyDollarIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </ListPanel>
        </div>
      </main>

      {showModal && selectedUser && (
        <UserActionModal
          type={showModal}
          user={selectedUser}
          onClose={closeModal}
          onSuccess={() => {
            closeModal()
            fetchUsers()
          }}
        />
      )}
    </div>
  )
}

/* ─── User Action Modal ─── */

type UserActionModalProps = {
  type: 'role' | 'email' | 'password' | 'sessions' | 'ban' | 'limits' | 'credits'
  user: AdminUser
  onClose: () => void
  onSuccess: () => void
}

function UserActionModal({ type, user, onClose, onSuccess }: UserActionModalProps) {
  const [loading, setLoading] = useState(false)
  const [value, setValue] = useState('')
  const [creditsOp, setCreditsOp] = useState<'add' | 'remove' | 'set'>('add')
  const [creditsAmount, setCreditsAmount] = useState('')
  const [creditsNote, setCreditsNote] = useState('')
  const limitsValueRef = useRef({
    vcpu: user.limits?.vcpu?.toString() || '100',
    memory: user.limits?.memory_mb?.toString() || '2048',
    storage: user.limits?.storage_mb?.toString() || '20040',
  })

  // Update refs when user changes
  useEffect(() => {
    limitsValueRef.current = {
      vcpu: user.limits?.vcpu?.toString() || '100',
      memory: user.limits?.memory_mb?.toString() || '2048',
      storage: user.limits?.storage_mb?.toString() || '20040',
    }
  }, [user])

  const isSubmitDisabled =
    loading ||
    (type === 'email' && !value.trim()) ||
    (type === 'password' && !value.trim()) ||
    (type === 'limits' && (!limitsValueRef.current.vcpu.trim() || !limitsValueRef.current.memory.trim() || !limitsValueRef.current.storage.trim())) ||
    (type === 'credits' && (!creditsAmount.trim() || !creditsNote.trim()))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      switch (type) {
        case 'role':
          await updateUserRole(user.uuid, value)
          break
        case 'email':
          await updateUserEmail(user.uuid, value)
          break
        case 'password':
          await resetUserPassword(user.uuid, value)
          break
        case 'sessions':
          await clearUserSessions(user.uuid)
          break
        case 'ban':
          if (user.role === 'banned') {
            await unbanUser(user.uuid)
          } else {
            await banUser(user.uuid)
          }
          break
        case 'limits':
          await updateUserLimits(user.uuid, {
            vcpu: parseInt(limitsValueRef.current.vcpu, 10) || 100,
            memory_mb: parseInt(limitsValueRef.current.memory, 10) || 2048,
            storage_mb: parseInt(limitsValueRef.current.storage, 10) || 20040,
          })
          break
        case 'credits':
          await updateUserCredits(user.uuid, creditsOp, parseInt(creditsAmount, 10) || 0, creditsNote)
          break
      }
      onSuccess()
    } catch (err) {
      console.error('Action failed:', err)
      alert('Action failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const getModalContent = () => {
    switch (type) {
      case 'role':
        return {
          title: 'Change User Role',
          description: `Update role for ${user.usrname}`,
          input: (
            <select
              value={value || user.role}
              onChange={(e) => setValue(e.target.value)}
              required
              className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              <option value="free">Free</option>
              <option value="premium">Premium</option>
              <option value="admin">Admin</option>
              <option value="banned">Banned</option>
            </select>
          ),
        }
      case 'email':
        return {
          title: 'Update Email',
          description: `Change email for ${user.usrname}`,
          input: (
            <input
              type="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              placeholder={user.email}
              className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500"
              style={{ fontFamily: "'Space Mono', monospace" }}
            />
          ),
        }
      case 'password':
        return {
          title: 'Reset Password',
          description: `Set new password for ${user.usrname}`,
          input: (
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              placeholder="New password"
              className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500"
              style={{ fontFamily: "'Space Mono', monospace" }}
            />
          ),
        }
      case 'sessions':
        return {
          title: 'Clear All Sessions',
          description: `This will log out ${user.usrname} from all devices. They currently have ${user.sessions?.length || 0} active sessions.`,
          input: null,
        }
      case 'ban':
        return {
          title: user.role === 'banned' ? 'Unban User' : 'Ban User',
          description:
            user.role === 'banned'
              ? `Restore ${user.usrname}'s access to the platform.`
              : `This will ban ${user.usrname} and clear all their sessions.`,
          input: null,
        }
      case 'limits':
        return {
          title: 'Edit Resource Limits',
          description: `Update resource limits for ${user.usrname}`,
          input: (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1" style={{ fontFamily: "'Space Mono', monospace" }}>
                  CPU (vcpu)
                </label>
                <input
                  type="number"
                  value={limitsValueRef.current.vcpu}
                  onChange={(e) => (limitsValueRef.current.vcpu = e.target.value)}
                  required
                  min="1"
                  className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1" style={{ fontFamily: "'Space Mono', monospace" }}>
                  Memory (MB)
                </label>
                <input
                  type="number"
                  value={limitsValueRef.current.memory}
                  onChange={(e) => (limitsValueRef.current.memory = e.target.value)}
                  required
                  min="1"
                  className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1" style={{ fontFamily: "'Space Mono', monospace" }}>
                  Storage (MB)
                </label>
                <input
                  type="number"
                  value={limitsValueRef.current.storage}
                  onChange={(e) => (limitsValueRef.current.storage = e.target.value)}
                  required
                  min="1"
                  className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                />
              </div>
            </div>
          ),
        }
      case 'credits':
        return {
          title: 'Adjust Credits',
          description: (
            <span>
              Current balance for <strong>{user.usrname}</strong>:{' '}
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {(user.billing?.credits || 0).toLocaleString()} RU
              </span>
            </span>
          ),
          input: (
            <div className="space-y-4">
              {/* Operation */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5" style={{ fontFamily: "'Space Mono', monospace" }}>
                  Operation
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(['add', 'remove', 'set'] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setCreditsOp(op)}
                      className={`py-2 text-xs uppercase tracking-wider border transition-colors ${creditsOp === op
                        ? op === 'add'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : op === 'remove'
                            ? 'bg-red-500 border-red-500 text-white'
                            : 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                        }`}
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {op === 'add' ? '+ Add' : op === 'remove' ? '− Remove' : '= Set'}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                  {creditsOp === 'add' && 'Add credits to current balance'}
                  {creditsOp === 'remove' && 'Remove credits from current balance'}
                  {creditsOp === 'set' && 'Set balance to exact amount'}
                </p>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1" style={{ fontFamily: "'Space Mono', monospace" }}>
                  Amount (RU)
                </label>
                <input
                  type="number"
                  value={creditsAmount}
                  onChange={(e) => setCreditsAmount(e.target.value)}
                  required
                  min="0"
                  placeholder={creditsOp === 'set' ? `Current: ${user.billing?.credits || 0}` : 'e.g. 500'}
                  className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                />
                {creditsAmount && (
                  <p className="mt-1 text-[10px] text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                    New balance:{' '}
                    {creditsOp === 'add' && `${((user.billing?.credits || 0) + (parseInt(creditsAmount) || 0)).toLocaleString()} RU`}
                    {creditsOp === 'remove' && `${Math.max(0, (user.billing?.credits || 0) - (parseInt(creditsAmount) || 0)).toLocaleString()} RU`}
                    {creditsOp === 'set' && `${(parseInt(creditsAmount) || 0).toLocaleString()} RU`}
                  </p>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1" style={{ fontFamily: "'Space Mono', monospace" }}>
                  Note <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={creditsNote}
                  onChange={(e) => setCreditsNote(e.target.value)}
                  required
                  placeholder="e.g. Promotional bonus, Manual refund..."
                  className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                />
                <p className="mt-1 text-[10px] text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                  This note appears in the user's wallet transaction history.
                </p>
              </div>
            </div>
          ),
        }
    }
  }

  const content = getModalContent()

  return (
    <Modal isOpen={true} onClose={onClose} title={content.title} maxWidth="max-w-md">
      <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4" style={{ fontFamily: "'Space Mono', monospace" }}>
        {content.description}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {content.input && <div>{content.input}</div>}

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border transition-colors bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="px-4 py-2 text-sm transition-colors disabled:opacity-50 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {loading ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
