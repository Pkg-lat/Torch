import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { beginOAuth, getProviders, getSession, loginWithEmail, registerWithEmail } from '../../lib/auth-api'

export const Route = createFileRoute('/auth/')({
  component: AuthPage,
})

function AuthPage() {
  const navigate = useNavigate()
  const [providers, setProviders] = useState<Array<{ name: string; displayName: string; type: string }>>([])
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function checkAuth() {
      try {
        const session = await getSession()
        if (!active) return
        if (session.authenticated) {
          await navigate({ to: '/' })
          return
        }
      } catch {
        // Not authenticated, continue
      }

      try {
        const providerList = await getProviders()
        if (active) {
          setProviders(providerList)
        }
      } catch (err) {
        console.error('Failed to load providers:', err)
      }
    }

    void checkAuth()
    return () => {
      active = false
    }
  }, [navigate])

  const handleOAuth = (provider: string) => {
    beginOAuth(provider)
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password)
      } else {
        await registerWithEmail(email, username, password)
      }
      await navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const oauthProviders = providers.filter((p) => p.type === 'oauth')
  const hasEmail = providers.some((p) => p.type === 'email')

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md border border-neutral-800 bg-neutral-900/80 p-8">
        <div className="text-4xl tracking-wider mb-1" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
          TORCH
        </div>
        <div className="text-xs text-neutral-500 tracking-[0.2em] uppercase mb-8" style={{ fontFamily: "'Space Mono', monospace" }}>
          by pkg.lat
        </div>

        {oauthProviders.length > 0 && (
          <div className="space-y-3 mb-6">
            {oauthProviders.map((provider) => (
              <button
                key={provider.name}
                onClick={() => handleOAuth(provider.name)}
                className="w-full px-4 py-3 bg-neutral-800 hover:bg-neutral-700 transition-colors text-sm border border-neutral-700"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                Continue with {provider.displayName}
              </button>
            ))}
          </div>
        )}

        {hasEmail && oauthProviders.length > 0 && (
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-800"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-neutral-900 px-2 text-neutral-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                OR
              </span>
            </div>
          </div>
        )}

        {hasEmail && (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-widest mb-2" style={{ fontFamily: "'Space Mono', monospace" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-red-600"
                style={{ fontFamily: "'Space Mono', monospace" }}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs text-neutral-500 uppercase tracking-widest mb-2" style={{ fontFamily: "'Space Mono', monospace" }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-red-600"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-widest mb-2" style={{ fontFamily: "'Space Mono', monospace" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-red-600"
                style={{ fontFamily: "'Space Mono', monospace" }}
              />
            </div>

            {error && (
              <div className="text-xs text-red-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="w-full text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
