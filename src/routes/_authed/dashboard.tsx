import { Link, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  DollarSign,
  PackageCheck,
  ShoppingCart,
} from 'lucide-react'
import { z } from 'zod'
import { DashboardFilterBar } from '../../components/dashboard/DashboardFilterBar.tsx'
import { InventoryDistributionChart } from '../../components/dashboard/InventoryDistributionChart.tsx'
import { RevenueTrendChart } from '../../components/dashboard/RevenueTrendChart.tsx'
import { StatCard } from '../../components/dashboard/StatCard.tsx'
import { TopProductsChart } from '../../components/dashboard/TopProductsChart.tsx'
import { isSilentAutoRefreshing, useTableAutoRefresh } from '../../lib/hooks/useTableAutoRefresh.ts'
import { getDashboardDataFn } from '../../server/functions/dashboard.ts'

const searchSchema = z.object({
  startDate: z.string().optional().catch(undefined),
  endDate: z.string().optional().catch(undefined),
  locationId: z.string().uuid().optional().catch(undefined),
  productId: z.string().uuid().optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/dashboard')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    startDate: search.startDate,
    endDate: search.endDate,
    locationId: search.locationId,
    productId: search.productId,
  }),
  loader: async ({ deps }) => {
    return await getDashboardDataFn({ data: deps })
  },
  component: DashboardPage,
})

function DashboardPage() {
  useTableAutoRefresh()
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { metrics, revenueTrend, topProducts, locationInventory } =
    Route.useLoaderData()

  // Track in-page filtering transitions (silenced during 20s auto-refresh and route navigation)
  const isStatsLoading = useRouterState({
    select: (s) =>
      s.status === 'pending' &&
      (!s.resolvedLocation || s.location.pathname === s.resolvedLocation.pathname) &&
      !isSilentAutoRefreshing,
  })

  const handleFilterChange = (filters: {
    startDate?: string
    endDate?: string
    locationId?: string
    productId?: string
  }) => {
    navigate({
      search: (prev) => ({
        ...prev,
        startDate: filters.startDate,
        endDate: filters.endDate,
        locationId: filters.locationId,
        productId: filters.productId,
      }),
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="border border-neutral-200 bg-white p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-brand-charcoal">
              Operations Dashboard
            </h1>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 select-none ${
                user.role === 'admin'
                  ? 'bg-brand-charcoal text-white'
                  : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
              }`}
            >
              {user.role} Portal
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            Welcome back, <strong className="text-brand-charcoal">{user.username || user.email}</strong>. Live sales analytics and inventory intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/sales/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand-primary hover:bg-brand-dark transition shadow-2xs"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            New Sale
          </Link>
          <Link
            to="/transfers/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 transition shadow-2xs"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            New Transfer
          </Link>
        </div>
      </div>

      {/* Filter Bar (Date Range, Store/Warehouse, Product) */}
      <DashboardFilterBar
        startDate={search.startDate}
        endDate={search.endDate}
        locationId={search.locationId}
        productId={search.productId}
        onChange={handleFilterChange}
      />

      {/* Sleek In-Page Loading Bar */}
      <div className="h-0.5 w-full bg-brand-coral/30 overflow-hidden -mt-2">
        {isStatsLoading && (
          <div className="h-full bg-brand-primary w-full animate-indeterminate" />
        )}
      </div>

      {/* Metric Cards Grid & Charts */}
      <div
        className={`space-y-6 transition-opacity duration-150 ${
          isStatsLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={`$${metrics.totalRevenue.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            subtitle={`${metrics.totalOrders.toLocaleString()} orders completed`}
            icon={DollarSign}
            badge={{ text: 'Completed', variant: 'success' }}
          />

          <StatCard
            title="Units Sold"
            value={metrics.unitsSold.toLocaleString('en-US', {
              maximumFractionDigits: 1,
            })}
            subtitle="Total product units dispatched"
            icon={PackageCheck}
            badge={{ text: 'Volume', variant: 'neutral' }}
          />

          <StatCard
            title="Inventory Valuation"
            value={`$${metrics.currentStockValue.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            subtitle={`${metrics.currentStockUnits.toLocaleString()} units on hand`}
            icon={Boxes}
            badge={{ text: 'Live Stock', variant: 'neutral' }}
          />

          <StatCard
            title="Damaged & Returned"
            value={`${metrics.damagedUnits + metrics.returnedUnits} units`}
            subtitle={`${metrics.damagedUnits} damaged · ${metrics.returnedUnits} returns`}
            icon={AlertTriangle}
            badge={{
              text: metrics.damagedUnits > 0 ? 'Review Needed' : 'Nominal',
              variant: metrics.damagedUnits > 0 ? 'warning' : 'neutral',
            }}
          />
        </div>

        {/* Main Revenue Trend Chart */}
        <RevenueTrendChart data={revenueTrend} />

        {/* 2-Column Grid for Breakdown Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopProductsChart data={topProducts} />
          <InventoryDistributionChart data={locationInventory} />
        </div>
      </div>
    </div>
  )
}
