import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { logout } from '../lib/auth-api'
import { Sidebar } from '../components/sidebar'
import { Shield, Mail, Key, User, Calendar, CheckCircle2, AlertCircle } from 'lucide-react'
import { useSidebar } from '../contexts/SidebarContext'
import { RequireAuth } from '../components/RequireAuth'
import { motion } from 'framer-motion'
import { Modal, Input, Button, mono } from '../components/ui'

export const Route = createFileRoute('/account')({
  component: AccountPage,
})

function AccountPage() {
  return (
    <RequireAuth>
      {(user, provider) => <AccountContent user={user} provider={provider} />}
    </RequireAuth>
  )
}

function AccountContent({ user, provider }: { user: any; provider?: string }) {
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const { isCollapsed, isMobile } = useSidebar()

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  const refreshUser = async () => {
    // User data will be refreshed by RequireAuth on next render
    window.location.reload()
  }

 // console.log(user)

  const isEmailAuth = provider === 'email'
  const providerDisplay = provider
    ? provider.charAt(0).toUpperCase() + provider.slice(1)
    : 'Email' // Default to Email if provider is not set

  return (
    <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <Sidebar user={user} onLogout={onLogout} />
      <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1 }
            }
          }}
          className="space-y-6"
        >
          <motion.header variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            <h1 className="text-5xl mb-2" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
              ACCOUNT SETTINGS
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
              Manage your account information and security settings
            </p>
          </motion.header>

          {/* Profile Information */}
          <motion.section variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="border bg-neutral-50 dark:bg-neutral-900/70 border-neutral-200 dark:border-neutral-800">
            <div className="border-b px-4 py-3 border-neutral-200 dark:border-neutral-800">
              <h2 className="text-sm uppercase tracking-widest text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                Profile Information
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <User size={18} className="text-neutral-500 dark:text-neutral-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                    Username
                  </div>
                  <div className="text-sm mt-1 flex items-center justify-between" style={{ fontFamily: "'Space Mono', monospace" }}>
                    <span>{user.username || 'Not set'}</span>
                    <button
                      onClick={() => setShowUsernameModal(true)}
                      className="text-xs px-3 py-1 border transition-colors bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail size={18} className="text-neutral-500 dark:text-neutral-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                    Email Address
                  </div>
                  <div className="text-sm mt-1" style={{ fontFamily: "'Space Mono', monospace" }}>
                    {user.email}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield size={18} className="text-neutral-500 dark:text-neutral-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                    Account Role
                  </div>
                  <div className="text-sm mt-1" style={{ fontFamily: "'Space Mono', monospace" }}>
                    {user.role || 'free'}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar size={18} className="text-neutral-500 dark:text-neutral-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                    User ID
                  </div>
                  <div className="text-sm mt-1 font-mono text-neutral-600 dark:text-neutral-400">
                    {user.uuid}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Authentication Provider */}
          <motion.section variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="border bg-neutral-50 dark:bg-neutral-900/70 border-neutral-200 dark:border-neutral-800">
            <div className="border-b px-4 py-3 border-neutral-200 dark:border-neutral-800">
              <h2 className="text-sm uppercase tracking-widest text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                Authentication
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Key size={18} className="text-neutral-500 dark:text-neutral-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                      Authentication Provider
                    </div>
                    <div className="text-sm mt-1 flex items-center gap-2" style={{ fontFamily: "'Space Mono', monospace" }}>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 border text-xs ${isEmailAuth
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400'
                        : 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-400'
                        }`}>
                        {isEmailAuth ? <Mail size={12} /> : <Shield size={12} />}
                        {providerDisplay}
                      </span>
                    </div>
                  </div>
                </div>
                {isEmailAuth && (
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="px-4 py-2 text-sm border transition-colors bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    Change Password
                  </button>
                )}
              </div>

              {/* OAuth details removed - TODO: Add back when session data is available */}
            </div>
          </motion.section>

          {/* Billing Information */}
          {user.billing && (
            <motion.section variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="border bg-neutral-50 dark:bg-neutral-900/70 border-neutral-200 dark:border-neutral-800">
              <div className="border-b px-4 py-3 border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm uppercase tracking-widest text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                  Billing
                </h2>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                    Credits Available
                  </div>
                  <div className="text-2xl mt-1" style={{ fontFamily: "'LCD14Condensed', monospace" }}>
                    {user.billing.credits}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "'Space Mono', monospace" }}>
                    Credits Used
                  </div>
                  <div className="text-2xl mt-1" style={{ fontFamily: "'LCD14Condensed', monospace" }}>
                    {user.billing.used}
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </motion.div>
      </main>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      {showUsernameModal && <ChangeUsernameModal currentUsername={user.usrname} onClose={() => setShowUsernameModal(false)} onSuccess={refreshUser} />}
    </div>
  )
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/authenticate/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Failed to change password')
      }

      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change password'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Change Password">
      {success ? (
        <div className="flex items-center gap-2 p-3 border border-emerald-700/50 bg-emerald-900/20 text-emerald-200 text-sm" style={mono}>
          <CheckCircle2 size={16} />
          Password changed successfully!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 border border-red-700/50 bg-red-900/20 text-red-200 text-xs" style={mono}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />

          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />

          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />

          <div className="flex gap-2 justify-end mt-6">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} isLoading={loading}>
              Change Password
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}


function ChangeUsernameModal({ currentUsername, onClose, onSuccess }: { currentUsername: string; onClose: () => void; onSuccess: () => void }) {
  const [username, setUsername] = useState(currentUsername || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }

    if (trimmedUsername.length > 32) {
      setError('Username must be less than 32 characters')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/authenticate/update-profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Failed to update username')
      }

      setSuccess(true)
      await onSuccess()
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update username'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Change Username">
      {success ? (
        <div className="flex items-center gap-2 p-3 border border-emerald-700/50 bg-emerald-900/20 text-emerald-200 text-sm" style={mono}>
          <CheckCircle2 size={16} />
          Username updated successfully!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 border border-red-700/50 bg-red-900/20 text-red-200 text-xs" style={mono}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <Input
            label="New Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={32}
            placeholder="Enter new username"
            helpText="3-32 characters"
          />

          <div className="flex gap-2 justify-end mt-6">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || username.trim() === currentUsername} isLoading={loading}>
              Update Username
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
