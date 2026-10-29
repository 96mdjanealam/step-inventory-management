import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { getMe, logoutFn } from '../server/functions/auth.ts'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    try {
      const user = await getMe()
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthedLayout,
  notFoundComponent: AuthedNotFound,
})

function AuthedNotFound() {
  return (
    <div className="p-12 max-w-md mx-auto text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center mx-auto text-lg font-bold font-mono">
        404
      </div>
      <h2 className="text-xl font-bold text-neutral-900">Record Not Found</h2>
      <p className="text-sm text-neutral-500">
        The requested inventory record, order, or page could not be found.
      </p>
      <div className="pt-2">
        <Link
          to="/inventory"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition shadow-sm"
        >
          Return to Stock Balances
        </Link>
      </div>
    </div>
  )
}

function AuthedLayout() {
  const { user } = Route.useRouteContext()
  const logout = useServerFn(logoutFn)

  async function handleLogout() {
    await logout()
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col text-neutral-900 antialiased">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo & Main Navigation */}
            <div className="flex items-center gap-8">
              <Link to="/inventory" className="flex items-center gap-2.5 font-bold text-lg text-neutral-900 tracking-tight">
                <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-black text-sm">
                  INV
                </div>
                <span>InventoryOS</span>
              </Link>

              <nav className="hidden md:flex items-center gap-1">
                <Link
                  to="/inventory"
                  activeProps={{ className: 'bg-neutral-100 text-neutral-900 font-semibold' }}
                  inactiveProps={{ className: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50' }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition"
                >
                  Stock & Locations
                </Link>
                <Link
                  to="/products"
                  activeProps={{ className: 'bg-neutral-100 text-neutral-900 font-semibold' }}
                  inactiveProps={{ className: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50' }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition"
                >
                  Products
                </Link>
                <Link
                  to="/transfers"
                  activeProps={{ className: 'bg-neutral-100 text-neutral-900 font-semibold' }}
                  inactiveProps={{ className: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50' }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition"
                >
                  Transfers
                </Link>
                <Link
                  to="/sales"
                  activeProps={{ className: 'bg-neutral-100 text-neutral-900 font-semibold' }}
                  inactiveProps={{ className: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50' }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition"
                >
                  Sales / POS
                </Link>
                <Link
                  to="/returns"
                  activeProps={{ className: 'bg-neutral-100 text-neutral-900 font-semibold' }}
                  inactiveProps={{ className: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50' }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition"
                >
                  Returns
                </Link>
                <Link
                  to="/damage"
                  activeProps={{ className: 'bg-neutral-100 text-neutral-900 font-semibold' }}
                  inactiveProps={{ className: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50' }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition"
                >
                  Damaged Stock
                </Link>
                <Link
                  to="/audit"
                  activeProps={{ className: 'bg-neutral-100 text-neutral-900 font-semibold' }}
                  inactiveProps={{ className: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50' }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition"
                >
                  Audit & Ledger
                </Link>
                {user.role === 'admin' && (
                  <Link
                    to="/users"
                    activeProps={{ className: 'bg-neutral-100 text-neutral-900 font-semibold' }}
                    inactiveProps={{ className: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50' }}
                    className="px-3 py-1.5 rounded-md text-sm font-medium transition"
                  >
                    Users
                  </Link>
                )}
              </nav>
            </div>

            {/* Right User Bar */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-neutral-900">
                  {user.username || user.email || 'User'}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                  {user.role}
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-rose-700 bg-neutral-100 hover:bg-rose-50 px-3 py-1.5 rounded-md transition"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 py-6">
        <Outlet />
      </main>
    </div>
  )
}
