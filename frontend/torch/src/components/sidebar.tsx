import { Link, useRouterState } from '@tanstack/react-router'
import {
  Home,
  Server,
  Wallet,
  User,
  LogOut,
  PlusSquare,
  Database,
  Settings,
  Sun,
  Moon,
  Monitor,
  Building2,
  ChevronDown,
  Plus,
  UserPlus,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { SessionUser, Org, OrgInvite } from '../lib/auth-api'
import { useTheme } from '../hooks/useTheme'
import { createOrg, inviteToOrg, listMyInvites, acceptInvite } from '../lib/auth-api'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useSidebar } from '../contexts/SidebarContext'
import { ServerIcon } from '@heroicons/react/24/outline'
import { Modal, Button, Input, mono } from './ui'

type SidebarProps = {
  user: SessionUser
  onLogout: () => void | Promise<void>
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function PanelIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z" />
    </svg>
  )
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const { isCollapsed, setIsCollapsed, isMobile } = useSidebar()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [invites, setInvites] = useState<OrgInvite[]>([])
  const { workspaces, selectedWorkspaceId, setSelectedWorkspaceId, refreshWorkspaces } = useWorkspace()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const refreshInvites = async () => {
    try {
      const inviteList = await listMyInvites()
      setInvites(inviteList)
    } catch (err) {
      console.error('Failed to fetch invites:', err)
    }
  }

  useEffect(() => {
    void refreshInvites()
  }, [])

  const linkClass = (path: string) => {
    const isActive = pathname === path
    return cn(
      'group inline-flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors cursor-pointer border-l-2 focus-visible:outline-none',
      isActive
        ? 'font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-neutral-900/50 border-red-500'
        : 'font-medium text-neutral-600 dark:text-neutral-500 border-transparent hover:text-neutral-900 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900/30 hover:border-neutral-300 dark:hover:border-neutral-700',
    )
  }

  const maskedEmail = (() => {
    const email = user.email || ''
    const [name, domain] = email.split('@')
    if (!name || !domain) return email
    const visible = name.slice(0, 2)
    return `${visible}${'*'.repeat(Math.max(3, name.length - 2))}@${domain}`.toUpperCase()
  })()

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && !isCollapsed && (
        <div className="fixed inset-0 z-30 bg-black/80 backdrop-blur-sm" onClick={() => setIsCollapsed(true)} />
      )}

      {/* Nudge button when collapsed - centered vertically with vertical text */}
      {isCollapsed && !isMobile && (
        <button
          onClick={() => setIsCollapsed(false)}
          className={cn(
            'fixed left-0 top-1/2 -translate-y-1/2 z-50',
            'rounded-r-xl',
            'h-28 w-10',
            'bg-neutral-100 dark:bg-black',
            'border border-l-0 border-neutral-300 dark:border-neutral-800/50',
            '[background-image:repeating-linear-gradient(135deg,rgba(0,0,0,0.04)_0px,rgba(0,0,0,0.04)_1px,transparent_1px,transparent_4px),repeating-linear-gradient(45deg,rgba(0,0,0,0.04)_0px,rgba(0,0,0,0.04)_1px,transparent_1px,transparent_4px)]',
            'dark:[background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_4px),repeating-linear-gradient(45deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_4px)]',
            'transition-[width,box-shadow,background-color] duration-200 ease-out',
            'hover:w-12 shadow-lg hover:shadow-xl',
            'focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-offset-neutral-950',
            'group',
          )}
          aria-label="Open sidebar"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 dark:text-neutral-500 whitespace-nowrap group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors"
              style={{
                fontFamily: "'Space Mono', monospace",
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
              }}
            >
              OPEN SIDEBAR
            </span>
          </div>
          <span className="sr-only">Open sidebar</span>
        </button>
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-out border-r',
          'bg-white dark:bg-neutral-950',
          'border-neutral-200 dark:border-neutral-800/50',
          isMobile ? (isCollapsed ? '-translate-x-full' : 'translate-x-0 w-64') : isCollapsed ? 'w-0' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-full flex-col px-3 py-4 transition-opacity duration-300 ease-out',
            isMobile ? 'opacity-100' : isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100',
          )}
        >
          <div className="mb-6 px-1 flex items-center justify-between gap-2">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-4xl tracking-wider text-neutral-900 dark:text-neutral-100" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
                  TORCH
                </span>
                <span className="text-xs ml-0.5 tracking-widest text-neutral-400 dark:text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                  by pkg.lat
                </span>
              </div>
            </Link>
            <button
              title="Close sidebar"
              onClick={() => setIsCollapsed(true)}
              className="inline-flex items-center justify-center w-6 h-6 transition-colors focus:outline-none text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              <PanelIcon className="h-4 w-4" />
            </button>
          </div>

          <nav className="mt-1 relative space-y-1">
            <span
              className="text-[9px] font-medium tracking-[0.2em] pb-2 ml-2 block text-neutral-400 dark:text-neutral-600"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              HOSTING
            </span>
            <Link to="/" className={linkClass('/')} style={{ fontFamily: "'Space Mono', monospace" }}>
              <Home size={16} strokeWidth={2} />
              <span>Dashboard</span>
            </Link>
            <Link to="/servers/create" className={linkClass('/servers/create')} style={{ fontFamily: "'Space Mono', monospace" }}>
              <PlusSquare size={16} strokeWidth={2} />
              <span>Deploy</span>
            </Link>
            <Link to="/servers" className={linkClass('/servers')} style={{ fontFamily: "'Space Mono', monospace" }}>
              <ServerIcon className="h-4 w-4" />
              <span>Servers</span>
            </Link>
            <Link to="/volumes" className={linkClass('/volumes')} style={{ fontFamily: "'Space Mono', monospace" }}>
              <Database size={16} strokeWidth={2} />
              <span>Volumes</span>
            </Link>

            <Link to="/org" className={linkClass('/org')} style={{ fontFamily: "'Space Mono', monospace" }}>
              <Building2 size={16} strokeWidth={2} />
              <span>Organization</span>
            </Link>

            <div className="pt-4">
              <span
                className="text-[9px] font-medium tracking-[0.2em] pb-2 ml-2 block text-neutral-400 dark:text-neutral-600"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                ECONOMY
              </span>
            </div>
            <Link to="/wallet" className={linkClass('/wallet')} style={{ fontFamily: "'Space Mono', monospace" }}>
              <Wallet size={16} strokeWidth={2} />
              <span>Wallet</span>
            </Link>
          </nav>
          <div className="pt-4">
              <span
                className="text-[9px] font-medium tracking-[0.2em] pb-2 ml-2 block text-neutral-400 dark:text-neutral-600"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                ADMIN
              </span>
            </div>
          {user.role === 'admin' && (
              <Link to="/admin" className={linkClass('/admin')} style={{ fontFamily: "'Space Mono', monospace" }}>
                <Settings size={16} strokeWidth={2} />
                <span>Admin</span>
              </Link>
            )}

          <div className="mt-auto space-y-3">
            {invites.length > 0 && (
              <InviteNotification
                invites={invites}
                onAccept={async () => {
                  await refreshInvites()
                  await refreshWorkspaces()
                }}
              />
            )}
            <WorkspaceSelector
              orgs={workspaces}
              selectedOrgId={selectedWorkspaceId}
              onSelectOrg={setSelectedWorkspaceId}
              onCreateNew={() => setShowCreateModal(true)}
              onInviteMembers={() => setShowInviteModal(true)}
            />
            <ThemeToggle />
            <UserDropdown user={user} maskedEmail={maskedEmail} onLogout={onLogout} />
          </div>
        </div>
      </aside>

      {showCreateModal && <CreateOrgModal onClose={() => setShowCreateModal(false)} onCreated={refreshWorkspaces} />}
      {showInviteModal && selectedWorkspaceId && (
        <InviteMemberModal orgUuid={selectedWorkspaceId} onClose={() => setShowInviteModal(false)} />
      )}
    </>
  )
}

function WorkspaceSelector({
  orgs,
  selectedOrgId,
  onSelectOrg,
  onCreateNew,
  onInviteMembers,
}: {
  orgs: Org[]
  selectedOrgId: string | null
  onSelectOrg: (id: string) => void
  onCreateNew: () => void
  onInviteMembers: () => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return
      const target = e.target as HTMLElement | null
      if (buttonRef.current?.contains(target)) return
      if (containerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const selectedOrg = orgs.find((o) => o.uuid === selectedOrgId)

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between border px-2 py-2 text-left text-xs transition-colors duration-150 cursor-pointer',
          'bg-white dark:bg-neutral-900/50',
          'border-neutral-300 dark:border-neutral-800/50',
          'text-neutral-700 dark:text-neutral-300',
          'hover:bg-neutral-50 dark:hover:bg-neutral-900/80',
          open && 'bg-neutral-50 dark:bg-neutral-900/80',
        )}
        style={{ fontFamily: "'Space Mono', monospace" }}
        aria-expanded={open}
      >
        <div className="inline-flex items-center gap-2 min-w-0">
          <Building2 size={14} className="shrink-0" />
          <span className="truncate text-xs font-medium">{selectedOrg?.name || 'Select Workspace'}</span>
        </div>
        <ChevronDown size={12} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          ref={containerRef}
          className="absolute bottom-full left-0 right-0 mb-1 origin-bottom border shadow-xl z-50 max-h-64 overflow-auto bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800/50"
        >
          <div className="p-1">
            {orgs.map((org) => (
              <button
                key={org.uuid}
                onClick={() => {
                  onSelectOrg(org.uuid)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-2 py-1.5 text-xs cursor-pointer transition-colors text-left',
                  org.uuid === selectedOrgId
                    ? 'bg-red-50 dark:bg-neutral-800/70 text-red-600 dark:text-red-400'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/70',
                )}
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                <Building2 size={12} />
                <span className="truncate">{org.name}</span>
              </button>
            ))}
            <div className="border-t my-1 border-neutral-200 dark:border-neutral-800/50" />
            <button
              onClick={() => {
                onCreateNew()
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-xs cursor-pointer transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/70"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              <Plus size={12} />
              <span>Create Workspace</span>
            </button>
            {selectedOrgId && (
              <button
                onClick={() => {
                  onInviteMembers()
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-xs cursor-pointer transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/70"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                <UserPlus size={12} />
                <span>Invite Members</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const options: Array<{ value: typeof theme; icon: ReactNode }> = [
    { value: 'light', icon: <Sun className="h-3 w-3" /> },
    { value: 'dark', icon: <Moon className="h-3 w-3" /> },
    { value: 'system', icon: <Monitor className="h-3 w-3" /> },
  ]

  return (
    <div className="inline-flex items-center rounded-sm ml-1 border p-0.5 bg-white dark:bg-neutral-900/50 border-neutral-300 dark:border-neutral-800/50">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          className={cn(
            'flex items-center justify-center h-6 w-6 rounded-sm cursor-pointer transition-colors',
            theme === opt.value
              ? 'bg-neutral-900 dark:bg-neutral-800 text-red-500 dark:text-red-400 border border-neutral-800 dark:border-neutral-700'
              : 'text-neutral-400 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400',
          )}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  )
}

function UserDropdown({
  user,
  maskedEmail,
  onLogout,
}: {
  user: SessionUser
  maskedEmail: string
  onLogout: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return
      const target = e.target as HTMLElement | null
      if (buttonRef.current?.contains(target)) return
      if (containerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const avatarSrc = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(user.usrname || 'guest')}`

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center border px-2 py-2 text-left text-xs transition-colors duration-150 cursor-pointer',
          'bg-white dark:bg-neutral-900/50',
          'border-neutral-300 dark:border-neutral-800/50',
          'text-neutral-700 dark:text-neutral-300',
          'hover:bg-neutral-50 dark:hover:bg-neutral-900/80',
          open && 'bg-neutral-50 dark:bg-neutral-900/80',
        )}
        style={{ fontFamily: "'Space Mono', monospace" }}
        aria-expanded={open}
      >
        <div className="inline-flex items-center gap-2 min-w-0 w-full">
          <img src={avatarSrc} alt="User Avatar" className="w-5 h-5 border shrink-0 bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700" />
          <div className="flex flex-col min-w-0">
            <span className="truncate text-xs font-medium text-neutral-900 dark:text-neutral-200">{user.usrname || 'Account'}</span>
            {maskedEmail && <span className="truncate text-[9px] tracking-widest uppercase text-neutral-400 dark:text-neutral-600">{maskedEmail}</span>}
          </div>
        </div>
      </button>

      {open && (
        <div
          ref={containerRef}
          className="absolute bottom-full left-0 right-0 mb-1 origin-bottom border shadow-xl z-50 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800/50"
        >
          <div className="p-2 space-y-1">
            <div className="px-2 py-1 pb-3 border-b mb-2 border-neutral-200 dark:border-neutral-800/50">
              <img src={avatarSrc} alt="Avatar" className="w-5 h-5 border flex-shrink-0 bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700" />
              <div
                className="text-xs mt-2 font-medium truncate text-neutral-900 dark:text-neutral-200"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                {user.usrname || 'Account'}
              </div>
              {maskedEmail && (
                <div
                  className="text-[10px] tracking-widest uppercase truncate text-neutral-400 dark:text-neutral-600"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {maskedEmail}
                </div>
              )}
            </div>

            <Link
              to="/account"
              onClick={() => setOpen(false)}
              style={{ fontSize: '11px', fontFamily: "'Space Mono', monospace" }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-xs cursor-pointer transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              <User size={14} />
              <span>Account settings</span>
            </Link>

            <button
              onClick={() => {
                setOpen(false)
                void onLogout()
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-xs cursor-pointer transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 hover:text-neutral-900 dark:hover:text-neutral-100"
              style={{ fontSize: '11px', fontFamily: "'Space Mono', monospace" }}
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      await createOrg(name.trim())
      await onCreated()
      onClose()
    } catch (err) {
      console.error('Failed to create org:', err)
      alert('Failed to create workspace')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Create Workspace">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Workspace Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="My Workspace"
        />

        <div className="flex gap-2 justify-end mt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !name.trim()} isLoading={loading}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function InviteMemberModal({ orgUuid, onClose }: { orgUuid: string; onClose: () => void }) {
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
              className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:border-red-500 text-neutral-900 dark:text-neutral-100 appearance-none"
              style={mono}
            >
              <option value="guest">Guest - View only</option>
              <option value="moderator">Moderator - Can manage resources</option>
              <option value="admin">Admin - Full access</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500" />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
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

function InviteNotification({ invites, onAccept }: { invites: OrgInvite[]; onAccept: () => void }) {
  const [accepting, setAccepting] = useState<string | null>(null)

  const handleAccept = async (inviteUuid: string) => {
    setAccepting(inviteUuid)
    try {
      await acceptInvite(inviteUuid)
      await onAccept()
    } catch (err) {
      console.error('Failed to accept invite:', err)
      alert('Failed to accept invite')
    } finally {
      setAccepting(null)
    }
  }

  return (
    <div className="border p-2 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50">
      <div className="text-[10px] uppercase tracking-widest mb-2 text-blue-700 dark:text-blue-400" style={{ fontFamily: "'Space Mono', monospace" }}>
        Pending Invites ({invites.length})
      </div>
      <div className="space-y-1">
        {invites.slice(0, 2).map((invite) => (
          <div key={invite.uuid} className="flex items-center justify-between gap-2">
            <span className="text-[10px] truncate text-blue-900 dark:text-blue-300" style={{ fontFamily: "'Space Mono', monospace" }}>
              {invite.orgName}
            </span>
            <button
              onClick={() => handleAccept(invite.uuid)}
              disabled={accepting === invite.uuid}
              className="text-[10px] px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              {accepting === invite.uuid ? '...' : 'Accept'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
