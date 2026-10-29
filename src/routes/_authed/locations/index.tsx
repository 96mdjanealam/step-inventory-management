import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/locations/')({
  beforeLoad: () => {
    throw redirect({ to: '/inventory' })
  },
  component: () => null,
})
