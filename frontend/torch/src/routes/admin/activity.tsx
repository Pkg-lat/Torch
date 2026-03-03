import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/activity')({
  beforeLoad: () => {
    // Redirect to logs page
    throw redirect({ to: '/admin/logs' })
  },
})
