import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import { listReturnsFn } from '../../../server/functions/returns.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  locationId: z.string().uuid().optional().catch(undefined),
  search: z.string().trim().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/returns/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    locationId: search.locationId,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    const [returnsData, locations] = await Promise.all([
      listReturnsFn({
        data: {
          page: deps.page,
          locationId: deps.locationId,
          search: deps.search,
        },
      }),
      listLocationsFn({ data: { includeInactive: false } }),
    ])
    return { ...returnsData, locations }
  },
  component: ReturnsPage,
})

function ReturnsPage() {
  const { returns, total, page, pageSize, locations } = Route.useLoaderData()
  const { search, locationId } = Route.useSearch()
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Customer Returns & Refunds
          </h1>
          <p className="text-sm text-neutral-500">
            Audit history of returned customer merchandise and stock restorations.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            name="search"
            defaultValue={search || ''}
            placeholder="Search return #, original order #, or reason..."
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
        </div>
      </div>

      {/* Returns List Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50 text-neutral-900 font-semibold border-b border-neutral-200">
              <tr>
                <th className="py-3 px-4">Return #</th>
                <th className="py-3 px-4">Original Order</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Store Location</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4 text-right">Refund Amount</th>
                <th className="py-3 px-4">Authorized By</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    No customer returns found matching your filters.
                  </td>
                </tr>
              ) : (
                returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-neutral-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-medium text-amber-700">
                      {ret.returnNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <Link
                        to="/sales/$saleId"
                        params={{ saleId: ret.saleId }}
                        className="text-indigo-600 hover:underline"
                      >
                        {ret.saleOrderNumber}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-500 whitespace-nowrap">
                      {new Date(ret.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-neutral-900">
                      {ret.locationName}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-700 max-w-xs truncate" title={ret.reason}>
                      {ret.reason}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-rose-600">
                      -${Number(ret.totalRefundAmount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-700">
                      {ret.processedByUsername || 'Staff'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to="/sales/$saleId"
                        params={{ saleId: ret.saleId }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 transition"
                      >
                        View Sale Order
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
              <span className="font-medium">{totalPages}</span> ({total} returns)
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

