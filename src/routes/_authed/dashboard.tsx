import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { logoutFn } from '../../server/functions/auth.ts'

export const Route = createFileRoute('/_authed/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = Route.useRouteContext()
  const logout = useServerFn(logoutFn)

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p>
        Signed in as {user.email} ({user.role})
      </p>
      <button
        onClick={() => logout()}
        className="w-fit rounded bg-black px-3 py-2 text-white"
      >
        Sign out
      </button>
    </main>
  )
}