import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getMe } from '../server/functions/auth.ts'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    try {
      const user = await getMe()
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: () => <Outlet />,
})