import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { getSession } from '../../lib/auth-api'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    async function checkSession() {
      try {
        const session = await getSession()
        if (!active) return

        if (session.authenticated) {
          await navigate({ to: '/' })
        } else {
          await navigate({ to: '/auth' })
        }
      } catch {
        if (!active) return
        await navigate({ to: '/auth' })
      }
    }

    void checkSession()
    return () => {
      active = false
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 flex items-center justify-center">
      <div className="text-sm tracking-widest uppercase">Completing sign in…</div>
    </div>
  )
}
