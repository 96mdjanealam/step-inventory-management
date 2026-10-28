import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import { listSalesFn } from '../../../server/functions/sales.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  locationId: z.string().uuid().optional().catch(undefined),
  status: z.enum(['completed', 'cancelled']).optional().catch(undefined),
  search: z.string().trim().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/sales/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    locationId: search.locationId,
    status: search.status,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    const [salesData, locations] = await Promise.all([
      listSalesFn({
        data: {
          page: deps.page,
          locationId: deps.locationId,
          status: deps.status,
          search: deps.search,
        },
      }),
      listLocationsFn({ data: { includeInactive: false } }),
    ])
    return { ...salesData, locations }
  },
  component: SalesPage,
})

function SalesPage() {
  const { sales, total, page, pageSize, locations } = Route.useLoaderData()
  const { search, locationId, status } = Route.useSearch()
  const navigate = Route.useNavigate()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const storeLocations = locations.filter((l) => l.type === 'store')

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const query = String(new FormData(form).get('search') ?? '').trim()
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: query || undefined,
      }),
    })
  }

  function handleLocationFilter(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        locationId: val || undefined,
      }),
    })
  }

  function handleStatusFilter(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as 'completed' | 'cancelled' | ''
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        status: val || undefined,
      }),
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Sales & Orders
          </h1>
          <p className="text-sm text-neutral-500">
            Point-of-sale customer orders, receipts, and order cancellations.
          </p>
        </div>
        <Link
          to="/sales/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition shadow-sm"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          + New Sale
        </Link>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            name="search"
            defaultValue={search || ''}
            placeholder="Search order #, customer name or phone..."
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium transition"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() =>
                navigate({
                  search: (prev) => ({ ...prev, search: undefined, page: 1 }),
                })
              }
              className="px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-900"
            >
              Clear
            </button>
          )}
        </form>

        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={locationId || ''}
            onChange={handleLocationFilter}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none bg-white text-neutral-700"
          >
            <option value="">All Store Locations</option>
            {storeLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.storeType === 'ownstore' ? 'Own Store' : 'Franchise'})
              </option>
            ))}
          </select>

          <select
            value={status || ''}
            onChange={handleStatusFilter}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none bg-white text-neutral-700"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Sales List Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50 text-neutral-900 font-semibold border-b border-neutral-200">
              <tr>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Store Location</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    No sales orders found matching your filters.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-neutral-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-medium text-neutral-900">
                      <Link
                        to="/sales/$saleId"
                        params={{ saleId: sale.id }}
                        className="hover:underline text-indigo-600"
                      >
                        {sale.orderNumber}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-500 whitespace-nowrap">
                      {new Date(sale.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-neutral-900">
                      {sale.locationName}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-700">
                      {sale.customerName ? (
                        <div>
                          <div className="font-medium text-neutral-900">
                            {sale.customerName}
                          </div>
                          {sale.customerPhone && (
                            <div className="text-xs text-neutral-400">
                              {sale.customerPhone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">Walk-in</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-neutral-900">
                      ${Number(sale.totalAmount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {sale.status === 'completed' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                          Cancelled
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to="/sales/$saleId"
                        params={{ saleId: sale.id }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 transition"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 bg-neutral-50 text-sm">
            <span className="text-neutral-500">
              Showing page <span className="font-medium">{page}</span> of{' '}
              <span className="font-medium">{totalPages}</span> ({total} orders)
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      page: Math.max(1, page - 1),
                    }),
                  })
                }
                className="px-3 py-1 rounded border border-neutral-300 bg-white text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium hover:bg-neutral-100"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() =>
                  navigate({
                    search: (prev) => ({ ...prev, page: page + 1 }),
                  })
                }
                className="px-3 py-1 rounded border border-neutral-300 bg-white text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium hover:bg-neutral-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
