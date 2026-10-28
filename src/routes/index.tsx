import { createFileRoute, redirect } from '@tanstack/react-router'
import { getMe } from '../server/functions/auth.ts'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    try {
      const user = await getMe()
      if (user) {
        throw redirect({ to: '/inventory' })
      }
    } catch (e: any) {
      if (e?.to) throw e
      throw redirect({ to: '/login' })
    }
  },
  component: () => null,
})
