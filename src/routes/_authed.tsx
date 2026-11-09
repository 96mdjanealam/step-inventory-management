import { useState } from 'react'
import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RotateCcw,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react'
import { getMe, logoutFn } from '../server/functions/auth.ts'

let cachedUser: { user: any; timestamp: number } | null = null

export function clearAuthCache() {
  cachedUser = null
}

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    // If on client and session was verified within 60s, reuse cached user to eliminate redundant network roundtrips
    if (
      typeof window !== 'undefined' &&
      cachedUser &&
      Date.now() - cachedUser.timestamp < 60_000
    ) {
      return { user: cachedUser.user }
    }

    try {
      const user = await getMe()
      if (typeof window !== 'undefined') {
        cachedUser = { user, timestamp: Date.now() }
      }
      return { user }
    } catch {
      cachedUser = null
      throw redirect({ to: '/login' })
    }
  },
  component: AuthedLayout,
  notFoundComponent: AuthedNotFound,
})

function AuthedNotFound() {
  return (
    <div className="p-12 max-w-md mx-auto text-center space-y-4">
      <div className="w-12 h-12 bg-neutral-200 text-neutral-600 flex items-center justify-center mx-auto text-lg font-bold font-mono">
        404
      </div>
      <h2 className="text-xl font-bold text-neutral-900">Record Not Found</h2>
      <p className="text-sm text-neutral-500">
        The requested inventory record, order, or page could not be found.
      </p>
      <div className="pt-2">
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-dark transition shadow-xs"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  )
}

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    to: '/inventory',
    label: 'Stock & Locations',
    icon: Boxes,
  },
  {
    to: '/products',
    label: 'Products & Catalog',
    icon: Package,
  },
  {
    to: '/transfers',
    label: 'Transfers',
    icon: ArrowLeftRight,
  },
  {
    to: '/sales',
    label: 'Sales / POS',
    icon: ShoppingCart,
  },
  {
    to: '/returns',
    label: 'Customer Returns',
    icon: RotateCcw,
  },
  {
    to: '/damage',
    label: 'Damaged Stock',
    icon: AlertTriangle,
  },
  {
    to: '/audit',
    label: 'Audit & Ledger',
    icon: ClipboardList,
  },
  {
    to: '/users',
    label: 'Accounts',
    icon: Users,
    adminOnly: true,
  },
  {
    to: '/guide',
    label: 'Operations Guide',
    icon: BookOpen,
  },
]

function AuthedLayout() {
  const { user } = Route.useRouteContext()
  const logout = useServerFn(logoutFn)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function handleLogout() {
    clearAuthCache()
    await logout()
  }

  const allowedNavItems = navItems.filter((item) => {
    if (item.adminOnly) {
      return user.role === 'admin'
    }
    return true
  })

  const renderNavLinks = (onItemClick?: () => void) => (
    <nav className="flex flex-col gap-1 px-3 py-4 flex-1 overflow-y-auto">
      <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/40 select-none">
        Main Navigation
      </div>
      {allowedNavItems.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact, includeSearch: false }}
            activeProps={{
              className: 'bg-brand-primary text-white font-medium shadow-2xs',
            }}
            inactiveProps={{
              className: 'text-neutral-300 hover:text-white hover:bg-white/10',
            }}
            onClick={onItemClick}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium transition cursor-pointer select-none group"
          >
            <Icon className="w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110" />
            <span className="truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col text-neutral-900 antialiased">
      {/* =========================================================================
          DESKTOP SIDEBAR ASIDE
          ========================================================================= */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-brand-charcoal border-r border-neutral-700/60 z-30 text-white">
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10 flex-shrink-0 bg-brand-charcoal">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 font-extrabold text-base text-white tracking-tight"
          >
            <img
              src="/logo.png"
              alt="OXTON Logo"
              className="w-7 h-7 object-contain select-none"
            />
            <span className="tracking-tight">OXTON</span>
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-coral bg-white/10 border border-white/15 px-1.5 py-0.5 select-none">
            ERP
          </span>
        </div>

        {/* Navigation Links */}
        {renderNavLinks()}

        {/* User Card & Logout Footer */}
        <div className="p-4 border-t border-white/10 bg-black/25 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">
                {user.username || user.email}
              </div>
              <div className="text-[11px] text-neutral-400 truncate">
                {user.email}
              </div>
            </div>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                user.role === 'admin'
                  ? 'bg-brand-primary text-white'
                  : 'bg-white/15 text-neutral-200 border border-white/20'
              }`}
            >
              {user.role}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-xs font-medium text-neutral-300 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 px-3 py-2 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* =========================================================================
          MOBILE TOP NAVBAR
          ========================================================================= */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-neutral-200 flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <Link
            to="/dashboard"
            className="flex items-center gap-2 font-extrabold text-sm text-brand-charcoal tracking-tight"
          >
            <img
              src="/logo.png"
              alt="OXTON Logo"
              className="w-6 h-6 object-contain select-none"
            />
            <span className="tracking-tight">OXTON</span>
          </Link>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="p-1.5 text-neutral-500 hover:text-brand-primary transition"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* =========================================================================
          MOBILE DRAWER ASIDE
          ========================================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer container */}
          <aside className="relative flex w-72 flex-col bg-brand-charcoal text-white shadow-2xl z-50 animate-in slide-in-from-left duration-200 border-r border-white/10">
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 flex-shrink-0 bg-brand-charcoal">
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 font-extrabold text-sm text-white"
              >
                <img
                  src="/logo.png"
                  alt="OXTON Logo"
                  className="w-6 h-6 object-contain select-none"
                />
                <span className="tracking-tight">OXTON</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderNavLinks(() => setMobileMenuOpen(false))}

            <div className="p-4 border-t border-white/10 bg-black/25 flex-shrink-0 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {user.username || user.email}
                  </div>
                  <div className="text-[10px] text-brand-coral uppercase tracking-wider font-bold">
                    {user.role}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 text-xs font-medium text-neutral-300 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 px-3 py-2 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* =========================================================================
          MAIN PAGE CONTENT
          ========================================================================= */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 min-h-screen">
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
