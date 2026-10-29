import { useMemo } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import { listTransfersFn } from '../../../server/functions/transfers.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  locationId: z.string().uuid().optional().catch(undefined),
  search: z.string().trim().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/transfers/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    locationId: search.locationId,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    const [transfersData, locations] = await Promise.all([
      listTransfersFn({
        data: {
          page: deps.page,
          locationId: deps.locationId,
          search: deps.search,
        },
      }),
      listLocationsFn({ data: { includeInactive: false } }),
    ])
    return { ...transfersData, locations }
  },
  component: TransfersPage,
})

function TransfersPage() {
  const { items, total, page, pageSize, locations } = Route.useLoaderData()
  const { search, locationId } = Route.useSearch()
  const navigate = Route.useNavigate()

  // Eligible locations for transfers (exclude Damaged Stock)
  const eligibleLocations = useMemo(
    () => locations.filter((l) => l.type !== 'damaged' && l.isActive),
    [locations],
  )

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const q = String(form.get('search') ?? '').trim()
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: q || undefined,
      }),
    })
  }

  function handleLocationFilter(newLocId: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        locationId: newLocId || undefined,
      }),
    })
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Stock Transfers
          </h1>
          <p className="text-sm text-gray-500">
            Dispatch and track inventory movements between warehouses and retail stores
          </p>
        </div>
        <Link
          to="/transfers/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Transfer
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by product, SKU, or location name..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-4">
          <select
            value={locationId ?? ''}
            onChange={(e) => handleLocationFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          >
            <option value="">All Facilities & Stores</option>
            {eligibleLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.type === 'warehouse' ? 'Warehouse' : l.storeType})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transfers Table */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center bg-white">
          <p className="text-sm text-gray-500">
            No stock transfers recorded. Use "New Transfer" to dispatch inventory.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product / Variant</th>
                <th className="px-4 py-3">Movement Route</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Dispatched By</th>
                <th className="px-4 py-3">Reference / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((t) => {
                const img = t.variant.image || t.product.images?.[0]
                const attrs =
                  t.variant.attributes && typeof t.variant.attributes === 'object'
                    ? Object.entries(t.variant.attributes)
                    : []

                return (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Product & Variant with Image */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
                          {img ? (
                            <img
                              src={img}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).src =
                                  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                              }}
                            />
                          ) : (
                            <svg
                              className="h-5 w-5 text-gray-300"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </div>

                        <div>
                          <Link
                            to="/products/$productId"
                            params={{ productId: t.product.id }}
                            className="font-semibold text-gray-900 hover:underline"
                          >
                            {t.product.name}
                          </Link>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <span>SKU: {t.variant.sku || 'Default'}</span>
                            {attrs.length > 0 && (
                              <span>
                                · {attrs.map(([k, v]) => `${k}: ${v}`).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Inline Movement Route */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span className="rounded bg-gray-100 px-2.5 py-1 text-gray-800">
                          {t.sourceLocation?.name ?? '—'}
                        </span>
                        <span className="text-gray-400 font-bold shrink-0">→</span>
                        <span className="rounded bg-blue-50 px-2.5 py-1 text-blue-700">
                          {t.destinationLocation?.name ?? '—'}
                        </span>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                      {t.quantity}{' '}
                      <span className="text-xs font-normal text-gray-500">
                        {t.product.unit}
                      </span>
                    </td>

                    {/* Dispatched By */}
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {t.user?.username ?? t.user?.role ?? 'System'}
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title={t.reason || ''}>
                      {t.reason || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {total} transfer records · page {page} of {totalPages}
        </span>
        <div className="flex gap-3">
          {page > 1 ? (
            <Link
              to="/transfers"
              search={(prev) => ({ ...prev, page: page - 1 })}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              to="/transfers"
              search={(prev) => ({ ...prev, page: page + 1 })}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  )
}
