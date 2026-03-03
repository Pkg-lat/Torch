import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/software/$softwareId-components')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/software/$softwareId-components"!</div>
}
