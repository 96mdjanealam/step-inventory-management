import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import {
  createTransferFn,
  listTransfersFn,
} from '../../../server/functions/transfers.ts'

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
  const router = useRouter()

  const createTransfer = useServerFn(createTransferFn)

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const eligibleLocations = locations.filter((l) => l.type !== 'damaged')

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = String(
      new FormData(event.currentTarget).get('search') ?? '',
    ).trim()
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: value || undefined,
      }),
    })
  }

  function handleLocationFilter(selectedLocId: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        locationId: selectedLocId || undefined,
      }),
    })
  }

  async function handleTransferSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError(null)

    const form = new FormData(event.currentTarget)
    const variantId = String(form.get('variantId') ?? '').trim()
    const sourceLocationId = String(form.get('sourceLocationId') ?? '').trim()
    const destinationLocationId = String(
      form.get('destinationLocationId') ?? '',
    ).trim()
    const quantity = String(form.get('quantity') ?? '').trim()
    const notes = String(form.get('notes') ?? '').trim() || undefined

    if (!variantId || !sourceLocationId || !destinationLocationId || !quantity) {
      setError('Please fill out all required fields')
      return
    }

    if (sourceLocationId === destinationLocationId) {
      setError('Source and destination locations must be different')
      return
    }

    setPending(true)
    try {
      await createTransfer({
        data: {
          variantId,
          sourceLocationId,
          destinationLocationId,
          quantity,
          notes,
        },
      })
      await router.invalidate()
      setShowModal(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to complete stock transfer',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Transfers</h1>
          <p className="text-sm text-gray-500">
            Dispatch and track inventory movements between warehouses and stores
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null)
            setShowModal(true)
          }}
          className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          + New Transfer
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by product, SKU, or location name"
            className="flex-1 rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-sm text-white hover:bg-gray-800"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-4">
          <select
            value={locationId ?? ''}
            onChange={(e) => handleLocationFilter(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
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
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-gray-500">
            No stock transfers recorded. Use "+ New Transfer" to dispatch inventory.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product / SKU</th>
                <th className="px-4 py-3">Movement Route</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Dispatched By</th>
                <th className="px-4 py-3">Reference / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {new Date(t.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      to="/products/$productId"
                      params={{ productId: t.product.id }}
                      className="text-gray-900 hover:underline"
                    >
                      {t.product.name}
                    </Link>
                    <div className="text-xs text-gray-400">
                      SKU: {t.variant.sku || 'Default'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">
                        {t.sourceLocation?.name ?? '—'}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="font-semibold text-blue-700">
                        {t.destinationLocation?.name ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900">
                    {t.quantity}{' '}
                    <span className="text-xs font-normal text-gray-500">
                      {t.product.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {t.user?.username ?? t.user?.role ?? 'System'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {t.reason || '—'}
                  </td>
                </tr>
              ))}
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
              className="text-black underline"
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              to="/transfers"
              search={(prev) => ({ ...prev, page: page + 1 })}
              className="text-black underline"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>

      {/* New Transfer Modal */}
      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Initiate Stock Transfer</h3>

            {error ? (
              <p className="mb-3 rounded bg-red-50 p-2 text-xs text-red-600">
                {error}
              </p>
            ) : null}

            <form onSubmit={handleTransferSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Variant ID *
                <input
                  name="variantId"
                  required
                  placeholder="Paste variant UUID"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Source Location *
                  <select
                    name="sourceLocationId"
                    required
                    className="rounded border px-3 py-2 text-sm"
                  >
                    {eligibleLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium">
                  Destination Location *
                  <select
                    name="destinationLocationId"
                    required
                    defaultValue={eligibleLocations[1]?.id}
                    className="rounded border px-3 py-2 text-sm"
                  >
                    {eligibleLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Transfer Quantity *
                <input
                  name="quantity"
                  required
                  step="0.001"
                  min="0.001"
                  type="number"
                  placeholder="e.g. 25"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Dispatch Notes / Reference
                <input
                  name="notes"
                  placeholder="e.g. Weekly store restock / Van dispatch #4"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {pending ? 'Dispatching...' : 'Complete Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}

