import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { KeyRound } from 'lucide-react'
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function handleAutoFill() {
    setEmail('96mdjanealam@gmail.com')
    setPassword('beaconmc14')
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    try {
      const result = await login({
        data: {
          email,
          password,
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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2.5 mb-2">
          <img
            src="/logo.png"
            alt="OXTON Logo"
            className="w-8 h-8 object-contain select-none"
          />
          <span className="font-extrabold text-xl text-brand-charcoal tracking-tight">
            OXTON
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-charcoal">
          Sign in
        </h1>
        <p className="text-xs text-neutral-600 leading-relaxed">
          Access the OXTON multi-location inventory and point-of-sale portal.
          <br />
          Manage store stock, POS checkout registers, and facility transfers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
          Email address
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

        <Button type="submit" isLoading={pending} className="w-full mt-2">
          Sign in
        </Button>
      </form>

      {/* Demo Credentials Auto-Fill Card */}
      <div className="border border-neutral-200 bg-neutral-50 p-3 flex items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-brand-charcoal text-[11px]">
            <KeyRound className="w-3.5 h-3.5 text-brand-primary" />
            Quick Demo Login
          </div>
          <p className="text-[11px] text-neutral-500 leading-snug mt-0.5">
            Auto-fill pre-configured administrator credentials for testing.
            <br />
            Enables instant access to inventory, POS, and transfer workflows.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAutoFill}
          className="inline-flex items-center gap-1 bg-brand-primary text-white px-2.5 py-1.5 text-xs font-semibold hover:bg-brand-dark transition cursor-pointer shadow-2xs flex-shrink-0"
        >
          Auto Fill
        </button>
      </div>
    </main>
  )
}
