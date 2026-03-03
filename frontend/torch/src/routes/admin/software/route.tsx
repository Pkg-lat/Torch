import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/software')({
  component: SoftwareRouteLayout,
})

function SoftwareRouteLayout() {
  return <Outlet />
}
