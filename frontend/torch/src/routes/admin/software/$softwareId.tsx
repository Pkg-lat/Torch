import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RequireAdmin } from '../../../components/RequireAdmin'
import { AdminSidebar } from '../../../components/admin-sidebar'
import { useSidebar } from '../../../contexts/SidebarContext'
import { logout } from '../../../lib/auth-api'
import {
  getAdminSoftwareById,
  updateAdminSoftware,
  deleteAdminSoftware,
  type Software as AdminSoftware,
} from '../../../lib/admin-api'
import { useEffect, useState } from 'react'
import {
  ArrowLeftIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { AdminPageHeader } from '../../../components/admin/AdminUI'
import LoadingAnimation from '../../../components/loader'

export const Route = createFileRoute('/admin/software/$softwareId')({
  component: AdminSoftwareDetailPage,
})

function AdminSoftwareDetailPage() {
  return (
    <RequireAdmin>
      {(user) => <AdminSoftwareDetailContent user={user} />}
    </RequireAdmin>
  )
}

function AdminSoftwareDetailContent({ user }: { user: any }) {
  const { softwareId } = Route.useParams()
  const navigate = useNavigate()
  const { isCollapsed, isMobile } = useSidebar()
  const [software, setSoftware] = useState<AdminSoftware | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [mode, setMode] = useState<'view' | 'json'>('view')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawJson, setRawJson] = useState('')

  const mono = { fontFamily: "'Space Mono', monospace" } as const

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  useEffect(() => {
    fetchSoftware()
  }, [softwareId])

  const fetchSoftware = async () => {
    setLoading(true)
    try {
      const data = await getAdminSoftwareById(softwareId)
      setSoftware(data.software)
      setRawJson(JSON.stringify({ software: data.software }, null, 2))
    } catch (err) {
      console.error('Failed to fetch software:', err)
    } finally {
      setLoading(false)
    }
  }

  const normalizePayload = (input: any) => {
    const source = input?.software && typeof input.software === 'object' ? input.software : input
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new Error('JSON must be an object')
    }

    const payload = { ...source }
    delete payload.uuid
    delete payload.createdAt
    delete payload.updatedAt

    if (!payload.docker_images || typeof payload.docker_images !== 'object' || Array.isArray(payload.docker_images)) {
      payload.docker_images = {}
    }

    if (!payload.runtime || typeof payload.runtime !== 'object' || Array.isArray(payload.runtime)) {
      payload.runtime = { 'file-init': '', 'start-up': '', stop: '' }
    }

    if (!payload.networking || typeof payload.networking !== 'object' || Array.isArray(payload.networking)) {
      payload.networking = { port_binds: {} }
    }

    if (!payload.networking.port_binds || typeof payload.networking.port_binds !== 'object' || Array.isArray(payload.networking.port_binds)) {
      payload.networking.port_binds = {}
    }

    if (!Array.isArray(payload.variables)) {
      payload.variables = []
    }

    payload.name = (payload.name || '').toString().trim()
    if (!payload.name) {
      throw new Error('name is required')
    }

    return payload
  }

  const handleSave = async () => {
    if (!software) return

    setSubmitting(true)
    setError(null)
    try {
      const parsed = JSON.parse(rawJson)
      const payload = normalizePayload(parsed)
      await updateAdminSoftware(softwareId, payload)
      await fetchSoftware()
      setEditing(false)
      setMode('view')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update software')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!software || !confirm(`Are you sure you want to delete "${software.name}"?`)) {
      return
    }

    try {
      await deleteAdminSoftware(softwareId)
      navigate({ to: '/admin/software' })
    } catch (err) {
      console.error('Failed to delete software:', err)
      alert('Failed to delete software')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        <AdminSidebar user={user} onLogout={onLogout} />
        <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
          <div className="flex items-center justify-center h-64">
            <div className="w-16 h-16">
              <LoadingAnimation />
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!software) {
    return (
      <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        <AdminSidebar user={user} onLogout={onLogout} />
        <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
          <div className="text-center py-16">
            <p className="text-neutral-500" style={mono}>Software not found</p>
            <button
              onClick={() => navigate({ to: '/admin/software' })}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs transition-colors"
              style={mono}
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              BACK TO SOFTWARE
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <AdminSidebar user={user} onLogout={onLogout} />
      <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
        <div className="space-y-6">
          <AdminPageHeader
            title={software.name.toUpperCase()}
            subtitle={`Software configuration • UUID: ${software.uuid}`}
            icon={
              software.icon_url ? (
                <img src={software.icon_url} alt={software.name} className="w-8 h-8 object-contain" />
              ) : (
                <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-800" />
              )
            }
            actions={
              <>
                <button
                  onClick={() => navigate({ to: '/admin/software' })}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs transition-colors"
                  style={mono}
                >
                  <ArrowLeftIcon className="h-3.5 w-3.5" />
                  BACK
                </button>
                {!editing ? (
                  <>
                    <button
                      onClick={() => {
                        setEditing(true)
                        setMode('json')
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs transition-colors"
                      style={mono}
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                      EDIT
                    </button>
                    <button
                      onClick={handleDelete}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs transition-colors"
                      style={mono}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      DELETE
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs transition-colors disabled:opacity-50"
                      style={mono}
                    >
                      {submitting ? (
                        <>
                          <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                          SAVING...
                        </>
                      ) : (
                        <>
                          <CheckIcon className="h-3.5 w-3.5" />
                          SAVE
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false)
                        setMode('view')
                        setError(null)
                        setRawJson(JSON.stringify({ software }, null, 2))
                      }}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs transition-colors disabled:opacity-50"
                      style={mono}
                    >
                      <XMarkIcon className="h-3.5 w-3.5" />
                      CANCEL
                    </button>
                  </>
                )}
              </>
            }
          />

          {error && (
            <div className="flex items-center gap-3 p-4 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300">
              <ExclamationCircleIcon className="h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-0.5" style={mono}>Update Failed</p>
                <p className="text-xs" style={mono}>{error}</p>
              </div>
            </div>
          )}

          {mode === 'json' ? (
            <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-6">
              <label className="block text-[10px] uppercase tracking-[0.2em] mb-3 text-neutral-600 dark:text-neutral-500" style={mono}>
                Software JSON Configuration
              </label>
              <textarea
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                rows={28}
                disabled={!editing}
                className="w-full px-4 py-3 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono disabled:opacity-60"
                style={mono}
                placeholder="Edit your software JSON configuration here..."
              />
              <p className="text-[10px] text-neutral-500 mt-2" style={mono}>
                {editing ? 'Edit the complete software configuration in JSON format. The system will validate and normalize the structure on save.' : 'Click EDIT to modify this configuration.'}
              </p>
            </div>
          ) : (
            <ViewMode software={software} mono={mono} />
          )}
        </div>
      </main>
    </div>
  )
}

// View Mode Component
function ViewMode({ software, mono }: { software: AdminSoftware; mono: React.CSSProperties }) {
  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-6">
        <h3 className="text-sm uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-4" style={mono}>
          Basic Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ViewField label="Name" value={software.name} mono={mono} />
          <ViewField label="Icon URL" value={software.icon_url} mono={mono} />
          <ViewField label="Startup Command" value={software.startup_cmd} mono={mono} className="md:col-span-2" />
          <ViewField label="Exported At" value={software.exported_at} mono={mono} />
          <ViewField label="Note" value={software._note} mono={mono} />
        </div>
      </div>

      {/* Scripts */}
      <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-6">
        <h3 className="text-sm uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-4" style={mono}>
          Installation Scripts
        </h3>
        <div className="space-y-4">
          <ViewTextarea label="Install Script" value={software.install_content} mono={mono} />
          <ViewTextarea label="Update Script" value={software.update_content} mono={mono} />
        </div>
      </div>

      {/* Runtime */}
      <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-6">
        <h3 className="text-sm uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-4" style={mono}>
          Runtime Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ViewField label="File Init" value={software.runtime?.['file-init']} mono={mono} />
          <ViewField label="Start-up Pattern" value={software.runtime?.['start-up']} mono={mono} />
          <ViewField label="Stop Command" value={software.runtime?.stop} mono={mono} />
        </div>
        {software.runtime?._note && (
          <div className="mt-4">
            <ViewField label="Runtime Note" value={software.runtime._note} mono={mono} />
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-6">
        <h3 className="text-sm uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-4" style={mono}>
          Metadata
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ViewField label="UUID" value={software.uuid} mono={mono} />
          <ViewField label="Created" value={new Date(software.createdAt).toLocaleString()} mono={mono} />
        </div>
      </div>
    </div>
  )
}

function ViewField({ label, value, mono, className = '' }: { label: string; value?: string; mono: React.CSSProperties; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={mono}>
        {label}
      </label>
      <div className="px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm" style={mono}>
        {value || '-'}
      </div>
    </div>
  )
}

function ViewTextarea({ label, value, mono }: { label: string; value?: string; mono: React.CSSProperties }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={mono}>
        {label}
      </label>
      <pre className="px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs overflow-x-auto whitespace-pre-wrap" style={mono}>
        {value || '-'}
      </pre>
    </div>
  )
}
