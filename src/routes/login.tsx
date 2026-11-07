import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '../components/Button.tsx'
import { getMe, loginFn } from '../server/functions/auth.ts'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    try {
      const user = await getMe()
      if (user) {
        throw redirect({ to: '/dashboard' })
      }
    } catch (e: any) {
      if (e?.to) throw e
      // Not signed in
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const login = useServerFn(loginFn)
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    try {
      const result = await login({
        data: {
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
        },
      })
      if (result?.error) {
        setError(result.error)
      } else {
        await router.invalidate()
        await navigate({ to: '/dashboard' })
      }
    } catch (err: any) {
      if (err?.to) {
        await router.invalidate()
        await navigate({ to: err.to })
        return
      }
      setError(err?.message || 'Login failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2.5 mb-2">
          <img
            src="/logo.png"
            alt="OXTON Logo"
            className="w-8 h-8 object-contain select-none"
          />
          <span className="font-extrabold text-xl text-brand-charcoal tracking-tight">OXTON</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-charcoal">Sign in</h1>
        <p className="text-xs text-neutral-500">
          Enter your credentials to access the OXTON inventory system.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="user@company.com"
            className="border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none"
          />
        </label>

        {error && (
          <div className="border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
            {error}
          </div>
        )}

        <Button
          type="submit"
          isLoading={pending}
          className="w-full mt-2"
        >
          Sign in
        </Button>
      </form>
    </main>
  )
}
