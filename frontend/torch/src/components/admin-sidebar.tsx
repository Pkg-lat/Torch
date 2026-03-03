import { Link, useRouterState } from '@tanstack/react-router'
import { Home, FileText, User, LogOut, Sun, Moon, Monitor, PanelLeft, UsersIcon, ArrowLeft, Package } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { SessionUser } from '../lib/auth-api'
import { useTheme } from '../hooks/useTheme'
import { useSidebar } from '../contexts/SidebarContext'
import { ServerIcon } from '@heroicons/react/24/outline'

type AdminSidebarProps = {
  user: SessionUser
  onLogout: () => void | Promise<void>
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}


export function AdminSidebar({ user, onLogout }: AdminSidebarProps) {
  const { isCollapsed, setIsCollapsed, isMobile } = useSidebar()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

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
      {isMobile && !isCollapsed && (
        <div className="fixed inset-0 z-30 bg-black/80 backdrop-blur-sm" onClick={() => setIsCollapsed(true)} />
      )}

      {isCollapsed && !isMobile && (
        <button
          onClick={() => setIsCollapsed(false)}
          className={cn(
            'fixed left-0 top-1/2 -translate-y-1/2 z-50 rounded-r-xl h-28 w-10',
            'bg-neutral-100 dark:bg-black border border-l-0 border-neutral-300 dark:border-neutral-800/50',
            'transition-[width,box-shadow,background-color] duration-200 ease-out hover:w-12 shadow-lg hover:shadow-xl group',
          )}
          aria-label="Open sidebar"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-500 whitespace-nowrap group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors"
              style={{ fontFamily: "'Space Mono', monospace", writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
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
          'bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800/50',
          isMobile ? (isCollapsed ? '-translate-x-full' : 'translate-x-0 w-64') : isCollapsed ? 'w-0' : 'w-64',
        )}
      >
        <div className={cn('flex h-full flex-col px-3 py-4 transition-opacity duration-300 ease-out', isMobile ? 'opacity-100' : isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100')}>
          <div className="mb-6 px-1 flex items-center justify-between gap-2">
            <Link to="/admin" className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-4xl tracking-wider text-neutral-900 dark:text-neutral-100" style={{ fontFamily: "'Seven Segment', sans-serif" }}>TORCH</span>
                <span className="text-xs ml-0.5 tracking-widest text-neutral-400 dark:text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>admin console</span>
              </div>
            </Link>
            <button
              title="Close sidebar"
              onClick={() => setIsCollapsed(true)}
              className="inline-flex items-center justify-center w-6 h-6 transition-colors focus:outline-none text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>

          <nav className="mt-1 relative space-y-1">
            <span className="text-[9px] font-medium tracking-[0.2em] pb-2 ml-2 block text-neutral-400 dark:text-neutral-600" style={{ fontFamily: "'Space Mono', monospace" }}></span>
            <Link to="/" className={linkClass('/')} style={{ fontFamily: "'Space Mono', monospace" }}>
              <ArrowLeft size={16} strokeWidth={2} />
              <span>Back to client</span>
            </Link>
          </nav>

          <nav className="mt-1 relative space-y-1">
            <span className="text-[9px] font-medium tracking-[0.2em] pb-2 ml-2 block text-neutral-400 dark:text-neutral-600" style={{ fontFamily: "'Space Mono', monospace" }}>ADMIN</span>
            <Link to="/admin" className={linkClass('/admin')} style={{ fontFamily: "'Space Mono', monospace" }}>
              <Home size={16} strokeWidth={2} />
              <span>Home</span>
            </Link>
            <Link to="/admin/users" className={linkClass('/admin/users')} style={{ fontFamily: "'Space Mono', monospace" }}>
              <UsersIcon size={16} strokeWidth={2} />
              <span>Users</span>
            </Link>
            <Link to="/admin/nodes" className={linkClass('/admin/nodes')} style={{ fontFamily: "'Space Mono', monospace" }}>
             <ServerIcon className="h-4 w-4" />
              <span>Nodes</span>
            </Link>
            <Link to="/admin/software" className={linkClass('/admin/software')} style={{ fontFamily: "'Space Mono', monospace" }}>
              <Package size={16} strokeWidth={2} />
              <span>Software</span>
            </Link>
            <Link to="/admin/logs" className={linkClass('/admin/logs')} style={{ fontFamily: "'Space Mono', monospace" }}>
              <FileText size={16} strokeWidth={2} />
              <span>Logs</span>
            </Link>

          </nav>

          <div className="mt-auto space-y-3">
            <ThemeToggle />
            <UserDropdown user={user} maskedEmail={maskedEmail} onLogout={onLogout} />
          </div>
        </div>
      </aside>
    </>
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

function UserDropdown({ user, maskedEmail, onLogout }: { user: SessionUser; maskedEmail: string; onLogout: () => void | Promise<void> }) {
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

  const avatarSrc = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(user.usrname || 'admin')}`

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center border px-2 py-2 text-left text-xs transition-colors duration-150 cursor-pointer',
          'bg-white dark:bg-neutral-900/50 border-neutral-300 dark:border-neutral-800/50',
          'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900/80',
          open && 'bg-neutral-50 dark:bg-neutral-900/80',
        )}
        style={{ fontFamily: "'Space Mono', monospace" }}
      >
        <div className="inline-flex items-center gap-2 min-w-0 w-full">
          <img src={avatarSrc} alt="User Avatar" className="w-5 h-5 border shrink-0 bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700" />
          <div className="flex flex-col min-w-0">
            <span className="truncate text-xs font-medium text-neutral-900 dark:text-neutral-200">{user.usrname || 'Admin'}</span>
            {maskedEmail && <span className="truncate text-[9px] tracking-widest uppercase text-neutral-400 dark:text-neutral-600">{maskedEmail}</span>}
          </div>
        </div>
      </button>

      {open && (
        <div ref={containerRef} className="absolute bottom-full left-0 right-0 mb-1 origin-bottom border shadow-xl z-50 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800/50">
          <div className="p-2 space-y-1">
            <Link
              to="/account"
              onClick={() => setOpen(false)}
              style={{ fontSize: '11px', fontFamily: "'Space Mono', monospace" }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-xs cursor-pointer transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/70"
            >
              <User size={14} />
              <span>Account settings</span>
            </Link>
            <button
              onClick={() => {
                setOpen(false)
                void onLogout()
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-xs cursor-pointer transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/70"
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
