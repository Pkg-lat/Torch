import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/nodes')({
  component: NodesRouteLayout,
})

function NodesRouteLayout() {
  return <Outlet />
}
