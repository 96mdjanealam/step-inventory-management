import { Link, createFileRoute } from '@tanstack/react-router'
import { Plus, Image as ImageIcon } from 'lucide-react'
import { z } from 'zod'
import { LocationSelect } from '../../../components/LocationSelect.tsx'
import { TablePagination } from '../../../components/TablePagination.tsx'
import { VariantDisplay } from '../../../lib/display-formatters.tsx'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import { listTransfersFn } from '../../../server/functions/transfers.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z.number().int().min(1).max(100).default(10).catch(10),
  locationId: z.string().uuid().optional().catch(undefined),
  search: z.string().trim().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/transfers/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
    locationId: search.locationId,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    const [transfersData, locations] = await Promise.all([
      listTransfersFn({
        data: {
          page: deps.page,
          pageSize: deps.pageSize,
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
  const { items, total, page, pageSize } = Route.useLoaderData()
  const { search, locationId } = Route.useSearch()
  const navigate = Route.useNavigate()

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
          <Plus className="h-4 w-4" />
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
          <LocationSelect
            value={locationId ?? ''}
            onChange={(val) => handleLocationFilter(val)}
            placeholder="All Facilities & Stores"
            clearable
            className="w-56"
          />
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
                            <ImageIcon className="h-5 w-5 text-gray-300" />
                          )}
                        </div>

                        <div>
                          <Link
                            to="/products/$productId"
                            params={{ productId: t.product.id }}
                            className="font-semibold text-gray-900 hover:underline block"
                          >
                            {t.product.name}
                          </Link>
                          <VariantDisplay
                            variant={{
                              attributes: t.variant.attributes as Record<string, string>,
                              sku: t.variant.sku,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Vertical Movement Route: From / To without arrows */}
                    <td className="px-4 py-3 text-xs leading-relaxed">
                      <div className="flex flex-col gap-0.5">
                        <div className="truncate max-w-[200px]" title={t.sourceLocation?.name}>
                          <span className="font-medium text-gray-400 mr-1">From:</span>
                          <span className="font-medium text-gray-800">
                            {t.sourceLocation?.name ?? '—'}
                          </span>
                        </div>
                        <div className="truncate max-w-[200px]" title={t.destinationLocation?.name}>
                          <span className="font-semibold text-blue-500 mr-1">To:</span>
                          <span className="font-semibold text-blue-700">
                            {t.destinationLocation?.name ?? '—'}
                          </span>
                        </div>
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

                    {/* Notes: wraps to 2nd line if needed */}
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs break-words leading-relaxed" title={t.reason || ''}>
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
      <div className="mt-4">
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(newPage) =>
            navigate({
              search: (prev) => ({ ...prev, page: newPage }),
            })
          }
          onPageSizeChange={(newPageSize) =>
            navigate({
              search: (prev) => ({ ...prev, pageSize: newPageSize, page: 1 }),
            })
          }
        />
      </div>
    </main>
  )
}
