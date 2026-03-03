import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { ArrowLeftIcon, PlusIcon, TrashIcon, XMarkIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { RequireAdmin } from '../../../components/RequireAdmin'
import { AdminSidebar } from '../../../components/admin-sidebar'
import { useSidebar } from '../../../contexts/SidebarContext'
import { logout } from '../../../lib/auth-api'
import { createAdminSoftware } from '../../../lib/admin-api'
import { AdminPageHeader } from '../../../components/admin/AdminUI'

export const Route = createFileRoute('/admin/software/new')({
  component: AdminSoftwareNewPage,
})

type KeyValueItem = {
  key: string
  value: string
}

type VariableItem = {
  name: string
  description: string
  env_variable: string
  default_value: string
  user_viewable: boolean
  user_editable: boolean
  rules: string
  field_type: string
}

function AdminSoftwareNewPage() {
  return (
    <RequireAdmin>
      {(user) => <AdminSoftwareNewContent user={user} />}
    </RequireAdmin>
  )
}

function AdminSoftwareNewContent({ user }: { user: any }) {
  const navigate = useNavigate()
  const { isCollapsed, isMobile } = useSidebar()
  const [mode, setMode] = useState<'gui' | 'json'>('json')
  const [name, setName] = useState('')
  const [iconUrl, setIconUrl] = useState('')
  const [startupCmd, setStartupCmd] = useState('')
  const [installContent, setInstallContent] = useState('')
  const [updateContent, setUpdateContent] = useState('echo Not implemented')
  const [runtimeFileInit, setRuntimeFileInit] = useState('')
  const [runtimeStartup, setRuntimeStartup] = useState('')
  const [runtimeStop, setRuntimeStop] = useState('')
  const [runtimeNote, setRuntimeNote] = useState('')
  const [exportedAt, setExportedAt] = useState('')
  const [softwareNote, setSoftwareNote] = useState('')
  const [dockerImages, setDockerImages] = useState<KeyValueItem[]>([])
  const [portBinds, setPortBinds] = useState<KeyValueItem[]>([{ key: '25565', value: 'auto' }])
  const [variables, setVariables] = useState<VariableItem[]>([])
  const [rawJson, setRawJson] = useState(`{
  "_note": "don't mess with ts twin, it's very messy.",
  "exported_at": "2024-12-11T19:05:06+00:00",
  "name": "Minecraft Purpur",
  "icon_url": "https://purpurmc.org/images/purpur.svg",
  "docker_images": {
    "Java 21": "ghcr.io/skyport-team/images/java:21",
    "Java 17": "ghcr.io/skyport-team/images/java:17"
  },
  "startup_cmd": "java -Xms128M -Xmx{{SERVER_MEMORY_MB}}M -Dterminal.jline=false -Dterminal.ansi=true -jar {{FILE_TO_RUN}} nogui {{ADDITIONAL_ARGS}}",
  "install_content": "echo installing Purpur Minecraft server",
  "update_content": "echo Not implemented",
  "runtime": {
    "file-init": "non for now",
    "start-up": "Minecraft server started.",
    "stop": "^^C",
    "_note": "start-up detects if a container has started or not via logs."
  },
  "networking": {
    "port_binds": {
      "25565": "auto"
    }
  },
  "variables": [
    {
      "name": "Minecraft server jar",
      "description": "The jar file for the Minecraft server",
      "env_variable": "FILE_TO_RUN",
      "default_value": "server.jar",
      "user_viewable": true,
      "user_editable": true,
      "rules": "required|string",
      "field_type": "text"
    }
  ]
}`)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mono = { fontFamily: "'Space Mono', monospace" } as const

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  const createFromPayload = async (payload: any) => {
    const response = await createAdminSoftware(payload)
    navigate({ to: '/admin/software/$softwareId', params: { softwareId: response.software.uuid } })
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

    payload.icon_url = (payload.icon_url || '').toString().trim()
    payload.startup_cmd = (payload.startup_cmd || '').toString().trim()
    payload.install_content = (payload.install_content || '').toString()
    payload.update_content = (payload.update_content || '').toString()
    payload.exported_at = (payload.exported_at || '').toString().trim()
    payload._note = (payload._note || '').toString()

    if (payload.runtime && typeof payload.runtime === 'object') {
      payload.runtime['file-init'] = (payload.runtime['file-init'] || '').toString()
      payload.runtime['start-up'] = (payload.runtime['start-up'] || '').toString()
      payload.runtime.stop = (payload.runtime.stop || '').toString()
      payload.runtime._note = (payload.runtime._note || '').toString()
    }

    return payload
  }

  const buildMap = (items: KeyValueItem[]) => {
    return items.reduce<Record<string, string>>((acc, item) => {
      const key = item.key.trim()
      const value = item.value.trim()
      if (!key || !value) return acc
      acc[key] = value
      return acc
    }, {})
  }

  const addDockerImage = () => {
    setDockerImages((prev) => [...prev, { key: '', value: '' }])
  }

  const updateDockerImage = (index: number, field: keyof KeyValueItem, value: string) => {
    setDockerImages((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const removeDockerImage = (index: number) => {
    setDockerImages((prev) => prev.filter((_, i) => i !== index))
  }

  const addPortBind = () => {
    setPortBinds((prev) => [...prev, { key: '', value: '' }])
  }

  const updatePortBind = (index: number, field: keyof KeyValueItem, value: string) => {
    setPortBinds((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const removePortBind = (index: number) => {
    setPortBinds((prev) => prev.filter((_, i) => i !== index))
  }

  const addVariable = () => {
    setVariables((prev) => [
      ...prev,
      {
        name: '',
        description: '',
        env_variable: '',
        default_value: '',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string',
        field_type: 'text',
      },
    ])
  }

  const updateVariable = (index: number, field: keyof VariableItem, value: string | boolean) => {
    setVariables((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const removeVariable = (index: number) => {
    setVariables((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()

    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'json') {
        const parsed = JSON.parse(rawJson)
        const payload = normalizePayload(parsed)
        await createFromPayload(payload)
        return
      }

      if (!name.trim()) {
        throw new Error('Name is required')
      }

      await createFromPayload({
        name: name.trim(),
        icon_url: iconUrl.trim(),
        startup_cmd: startupCmd.trim(),
        install_content: installContent,
        update_content: updateContent,
        exported_at: exportedAt.trim(),
        _note: softwareNote,
        docker_images: buildMap(dockerImages),
        runtime: {
          'file-init': runtimeFileInit,
          'start-up': runtimeStartup,
          stop: runtimeStop,
          _note: runtimeNote,
        },
        networking: {
          port_binds: buildMap(portBinds),
        },
        variables: variables
          .filter((v) => v.name.trim() && v.env_variable.trim())
          .map((v) => ({
            name: v.name.trim(),
            description: v.description,
            env_variable: v.env_variable.trim(),
            default_value: v.default_value,
            user_viewable: v.user_viewable,
            user_editable: v.user_editable,
            rules: v.rules,
            field_type: v.field_type,
          })),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create software')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <AdminSidebar user={user} onLogout={onLogout} />
      <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
        <div className="space-y-6">
          <AdminPageHeader
            title="NEW SOFTWARE"
            subtitle="Create a new software definition"
            actions={
              <button
                onClick={() => navigate({ to: '/admin/software' })}
                className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs transition-colors"
                style={mono}
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" />
                BACK
              </button>
            }
          />

          {/* Mode Toggle */}
          <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 mr-2" style={mono}>
              INPUT MODE:
            </span>
            <button
              type="button"
              onClick={() => setMode('json')}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-wider border transition-colors ${
                mode === 'json'
                  ? 'bg-red-500 text-white border-red-600'
                  : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600'
              }`}
              style={mono}
            >
              RAW JSON
            </button>
            <button
              type="button"
              onClick={() => setMode('gui')}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-wider border transition-colors ${
                mode === 'gui'
                  ? 'bg-red-500 text-white border-red-600'
                  : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600'
              }`}
              style={mono}
            >
              FORM BUILDER
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-6">
            {mode === 'json' ? (
              <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-6">
                <label className="block text-[10px] uppercase tracking-[0.2em] mb-3 text-neutral-600 dark:text-neutral-500" style={mono}>
                  Software JSON Configuration
                </label>
                <textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  rows={28}
                  className="w-full px-4 py-3 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono"
                  style={mono}
                  placeholder="Paste your software JSON configuration here..."
                />
                <p className="text-[10px] text-neutral-500 mt-2" style={mono}>
                  Paste a complete software configuration in JSON format. The system will validate and normalize the structure.
                </p>
              </div>
            ) : (
              <>
                {/* Basic Information Section */}
                <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-6 space-y-4">
                  <h3 className="text-sm uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-4" style={mono}>
                    Basic Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={mono}>
                        Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Minecraft Purpur"
                        className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        style={mono}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={mono}>
                        Icon URL
                      </label>
                      <input
                        type="text"
                        value={iconUrl}
                        onChange={(e) => setIconUrl(e.target.value)}
                        placeholder="https://example.com/icon.svg"
                        className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        style={mono}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={mono}>
                      Startup Command *
                    </label>
                    <input
                      type="text"
                      value={startupCmd}
                      onChange={(e) => setStartupCmd(e.target.value)}
                      placeholder="java -Xms128M -Xmx{{SERVER_MEMORY_MB}}M -jar {{FILE_TO_RUN}}"
                      className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      style={mono}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={mono}>
                        Exported At
                      </label>
                      <input
                        type="text"
                        value={exportedAt}
                        onChange={(e) => setExportedAt(e.target.value)}
                        placeholder="2024-12-11T19:05:06+00:00"
                        className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        style={mono}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={mono}>
                        Note
                      </label>
                      <input
                        type="text"
                        value={softwareNote}
                        onChange={(e) => setSoftwareNote(e.target.value)}
                        placeholder="Internal notes..."
                        className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        style={mono}
                      />
                    </div>
                  </div>
                </div>

                {/* Scripts Section */}
                <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-6 space-y-4">
                  <h3 className="text-sm uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-4" style={mono}>
                    Installation Scripts
                  </h3>

                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={mono}>
                      Install Script
                    </label>
                    <textarea
                      value={installContent}
                      onChange={(e) => setInstallContent(e.target.value)}
                      rows={6}
                      placeholder="#!/bin/bash&#10;echo 'Installing...'"
                      className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono"
                      style={mono}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={mono}>
                      Update Script
                    </label>
                    <textarea
                      value={updateContent}
                      onChange={(e) => setUpdateContent(e.target.value)}
                      rows={4}
                      placeholder="#!/bin/bash&#10;echo 'Updating...'"
                      className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono"
                      style={mono}
                    />
                  </div>
                </div>

                {/* Runtime Configuration */}
                <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-6 space-y-4">
                  <h3 className="text-sm uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-4" style={mono}>
                    Runtime Configuration
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={mono}>
                        File Init
                      </label>
                      <input
                        type="text"
                        value={runtimeFileInit}
                        onChange={(e) => setRuntimeFileInit(e.target.value)}
                        placeholder="file-init pattern"
                        className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        style={mono}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={mono}>
                        Start-up Pattern
                      </label>
                      <input
                        type="text"
                        value={runtimeStartup}
                        onChange={(e) => setRuntimeStartup(e.target.value)}
                        placeholder="Server started"
                        className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        style={mono}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={mono}>
                        Stop Command
                      </label>
                      <input
                        type="text"
                        value={runtimeStop}
                        onChange={(e) => setRuntimeStop(e.target.value)}
                        placeholder="^^C or stop"
                        className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        style={mono}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] mb-2 text-neutral-600 dark:text-neutral-500" style={mono}>
                      Runtime Note
                    </label>
                    <input
                      type="text"
                      value={runtimeNote}
                      onChange={(e) => setRuntimeNote(e.target.value)}
                      placeholder="Additional runtime notes..."
                      className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      style={mono}
                    />
                  </div>
                </div>

                <div className="space-y-2 border border-neutral-300 dark:border-neutral-700 p-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-500" style={mono}>
                      Docker Images
                    </label>
                    <button
                      type="button"
                      onClick={addDockerImage}
                      className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700"
                      style={mono}
                    >
                      ADD IMAGE
                    </button>
                  </div>
                  {dockerImages.length === 0 ? (
                    <p className="text-xs text-neutral-500" style={mono}>No images added yet.</p>
                  ) : (
                    dockerImages.map((item, idx) => (
                      <div key={`img-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={item.key}
                          onChange={(e) => updateDockerImage(idx, 'key', e.target.value)}
                          placeholder="Display name (e.g. Java 21)"
                          className="md:col-span-4 px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500"
                          style={mono}
                        />
                        <input
                          type="text"
                          value={item.value}
                          onChange={(e) => updateDockerImage(idx, 'value', e.target.value)}
                          placeholder="Image URI"
                          className="md:col-span-7 px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500"
                          style={mono}
                        />
                        <button
                          type="button"
                          onClick={() => removeDockerImage(idx)}
                          className="md:col-span-1 px-2 py-2 text-xs border border-red-500 text-red-500"
                          style={mono}
                        >
                          X
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 border border-neutral-300 dark:border-neutral-700 p-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-500" style={mono}>
                      Networking Port Binds
                    </label>
                    <button
                      type="button"
                      onClick={addPortBind}
                      className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700"
                      style={mono}
                    >
                      ADD PORT
                    </button>
                  </div>
                  {portBinds.map((item, idx) => (
                    <div key={`port-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                      <input
                        type="text"
                        value={item.key}
                        onChange={(e) => updatePortBind(idx, 'key', e.target.value)}
                        placeholder="Container port (e.g. 25565)"
                        className="md:col-span-4 px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500"
                        style={mono}
                      />
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => updatePortBind(idx, 'value', e.target.value)}
                        placeholder="Host bind (e.g. auto)"
                        className="md:col-span-7 px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500"
                        style={mono}
                      />
                      <button
                        type="button"
                        onClick={() => removePortBind(idx)}
                        className="md:col-span-1 px-2 py-2 text-xs border border-red-500 text-red-500"
                        style={mono}
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>

                {/* Docker Images Section */}
                <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-6 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm uppercase tracking-wider text-neutral-700 dark:text-neutral-300" style={mono}>
                      Docker Images
                    </h3>
                    <button
                      type="button"
                      onClick={addDockerImage}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 transition-colors"
                      style={mono}
                    >
                      <PlusIcon className="h-3 w-3" />
                      ADD IMAGE
                    </button>
                  </div>
                  
                  {dockerImages.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-neutral-300 dark:border-neutral-700">
                      <p className="text-xs text-neutral-500" style={mono}>No docker images configured yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dockerImages.map((item, idx) => (
                        <div key={`img-${idx}`} className="flex gap-2 items-start">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={item.key}
                              onChange={(e) => updateDockerImage(idx, 'key', e.target.value)}
                              placeholder="Display name (e.g. Java 21)"
                              className="px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                              style={mono}
                            />
                            <input
                              type="text"
                              value={item.value}
                              onChange={(e) => updateDockerImage(idx, 'value', e.target.value)}
                              placeholder="ghcr.io/org/image:tag"
                              className="px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                              style={mono}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDockerImage(idx)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-900 transition-colors"
                            title="Remove image"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Port Binds Section */}
                <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-6 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm uppercase tracking-wider text-neutral-700 dark:text-neutral-300" style={mono}>
                      Network Port Binds
                    </h3>
                    <button
                      type="button"
                      onClick={addPortBind}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 transition-colors"
                      style={mono}
                    >
                      <PlusIcon className="h-3 w-3" />
                      ADD PORT
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {portBinds.map((item, idx) => (
                      <div key={`port-${idx}`} className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={item.key}
                            onChange={(e) => updatePortBind(idx, 'key', e.target.value)}
                            placeholder="Container port (e.g. 25565)"
                            className="px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            style={mono}
                          />
                          <input
                            type="text"
                            value={item.value}
                            onChange={(e) => updatePortBind(idx, 'value', e.target.value)}
                            placeholder="Host bind (e.g. auto)"
                            className="px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            style={mono}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePortBind(idx)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-900 transition-colors"
                          title="Remove port"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Variables Section */}
                <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-6 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm uppercase tracking-wider text-neutral-700 dark:text-neutral-300" style={mono}>
                      Environment Variables
                    </h3>
                    <button
                      type="button"
                      onClick={addVariable}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 transition-colors"
                      style={mono}
                    >
                      <PlusIcon className="h-3 w-3" />
                      ADD VARIABLE
                    </button>
                  </div>

                  {variables.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-neutral-300 dark:border-neutral-700">
                      <p className="text-xs text-neutral-500" style={mono}>No environment variables configured yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {variables.map((variable, idx) => (
                        <div key={`var-${idx}`} className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-4 space-y-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase tracking-wider text-neutral-500" style={mono}>
                              Variable #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeVariable(idx)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-900 transition-colors"
                              style={mono}
                            >
                              <TrashIcon className="h-3 w-3" />
                              REMOVE
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] uppercase tracking-wider mb-1.5 text-neutral-500" style={mono}>
                                Name
                              </label>
                              <input
                                type="text"
                                value={variable.name}
                                onChange={(e) => updateVariable(idx, 'name', e.target.value)}
                                placeholder="Server JAR File"
                                className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                style={mono}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] uppercase tracking-wider mb-1.5 text-neutral-500" style={mono}>
                                ENV Variable
                              </label>
                              <input
                                type="text"
                                value={variable.env_variable}
                                onChange={(e) => updateVariable(idx, 'env_variable', e.target.value)}
                                placeholder="FILE_TO_RUN"
                                className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                style={mono}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[9px] uppercase tracking-wider mb-1.5 text-neutral-500" style={mono}>
                              Description
                            </label>
                            <input
                              type="text"
                              value={variable.description}
                              onChange={(e) => updateVariable(idx, 'description', e.target.value)}
                              placeholder="The jar file for the Minecraft server"
                              className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                              style={mono}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] uppercase tracking-wider mb-1.5 text-neutral-500" style={mono}>
                                Default Value
                              </label>
                              <input
                                type="text"
                                value={variable.default_value}
                                onChange={(e) => updateVariable(idx, 'default_value', e.target.value)}
                                placeholder="server.jar"
                                className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                style={mono}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] uppercase tracking-wider mb-1.5 text-neutral-500" style={mono}>
                                Field Type
                              </label>
                              <input
                                type="text"
                                value={variable.field_type}
                                onChange={(e) => updateVariable(idx, 'field_type', e.target.value)}
                                placeholder="text"
                                className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                style={mono}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[9px] uppercase tracking-wider mb-1.5 text-neutral-500" style={mono}>
                              Validation Rules
                            </label>
                            <input
                              type="text"
                              value={variable.rules}
                              onChange={(e) => updateVariable(idx, 'rules', e.target.value)}
                              placeholder="required|string"
                              className="w-full px-3 py-2 border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                              style={mono}
                            />
                          </div>

                          <div className="flex items-center gap-6 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                            <label className="inline-flex items-center gap-2 text-xs cursor-pointer" style={mono}>
                              <input
                                type="checkbox"
                                checked={variable.user_viewable}
                                onChange={(e) => updateVariable(idx, 'user_viewable', e.target.checked)}
                                className="w-4 h-4 border-neutral-300 dark:border-neutral-700"
                              />
                              <span className="text-neutral-700 dark:text-neutral-300">User Viewable</span>
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs cursor-pointer" style={mono}>
                              <input
                                type="checkbox"
                                checked={variable.user_editable}
                                onChange={(e) => updateVariable(idx, 'user_editable', e.target.checked)}
                                className="w-4 h-4 border-neutral-300 dark:border-neutral-700"
                              />
                              <span className="text-neutral-700 dark:text-neutral-300">User Editable</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {error && (
              <div className="flex items-center gap-3 p-4 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300">
                <XMarkIcon className="h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-0.5" style={mono}>Creation Failed</p>
                  <p className="text-xs" style={mono}>{error}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <p className="text-[10px] text-neutral-500" style={mono}>
                * Required fields must be filled
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate({ to: '/admin/software' })}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs transition-colors border border-neutral-300 dark:border-neutral-700 disabled:opacity-50"
                  style={mono}
                >
                  <ArrowLeftIcon className="h-3.5 w-3.5" />
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs transition-colors border border-red-600"
                  style={mono}
                >
                  {submitting ? (
                    <>
                      <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      CREATING...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-3.5 w-3.5" />
                      CREATE SOFTWARE
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
