import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  addStockFn,
  adjustStockFn,
  listInventoryFn,
} from '../../../server/functions/inventory.ts'
import { listLocationsFn } from '../../../server/functions/locations.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  locationId: z.string().uuid().optional().catch(undefined),
  search: z.string().trim().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/inventory/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    locationId: search.locationId,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    const [inventoryData, locations] = await Promise.all([
      listInventoryFn({
        data: {
          page: deps.page,
          locationId: deps.locationId,
          search: deps.search,
        },
      }),
      listLocationsFn({ data: { includeInactive: false } }),
    ])
    return { ...inventoryData, locations }
  },
  component: InventoryPage,
})

function InventoryPage() {
  const { items, total, page, pageSize, locations } = Route.useLoaderData()
  const { search, locationId } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()

  const addStock = useServerFn(addStockFn)
  const adjustStock = useServerFn(adjustStockFn)

  // Inflow Modal State
  const [showInflowModal, setShowInflowModal] = useState(false)
  const [inflowPending, setInflowPending] = useState(false)
  const [inflowError, setInflowError] = useState<string | null>(null)

  // Adjust Modal State
  const [adjustingItem, setAdjustingItem] = useState<
    (typeof items)[number] | null
  >(null)
  const [adjustPending, setAdjustPending] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Eligible intake locations (warehouse & stores, not damaged)
  const intakeLocations = locations.filter((l) => l.type !== 'damaged')

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

  function openInflowModal() {
    setInflowError(null)
    setShowInflowModal(true)
  }

  async function handleInflowSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInflowError(null)

    const form = new FormData(event.currentTarget)
    const variantId = String(form.get('variantId') ?? '').trim()
    const locId = String(form.get('locationId') ?? '').trim()
    const quantity = String(form.get('quantity') ?? '').trim()
    const reason = String(form.get('reason') ?? '').trim() || undefined

    if (!variantId || !locId || !quantity) {
      setInflowError('Please fill out all required fields')
      return
    }

    setInflowPending(true)
    try {
      await addStock({
        data: {
          variantId,
          locationId: locId,
          quantity,
          reason,
        },
      })
      await router.invalidate()
      setShowInflowModal(false)
    } catch (err) {
      setInflowError(
        err instanceof Error ? err.message : 'Failed to receive stock',
      )
    } finally {
      setInflowPending(false)
    }
  }

  async function handleAdjustSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!adjustingItem) return
    setAdjustError(null)

    const form = new FormData(event.currentTarget)
    const adjustmentType = String(form.get('adjustmentType') ?? 'increase') as
      | 'increase'
      | 'decrease'
    const quantity = String(form.get('quantity') ?? '').trim()
    const reason = String(form.get('reason') ?? '').trim()

    if (!quantity || !reason) {
      setAdjustError('Quantity and a valid reason are required')
      return
    }

    setAdjustPending(true)
    try {
      await adjustStock({
        data: {
          variantId: adjustingItem.variantId,
          locationId: adjustingItem.locationId,
          adjustmentType,
          quantity,
          reason,
        },
      })
      await router.invalidate()
      setAdjustingItem(null)
    } catch (err) {
      setAdjustError(
        err instanceof Error ? err.message : 'Failed to adjust stock',
      )
    } finally {
      setAdjustPending(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Balances</h1>
          <p className="text-sm text-gray-500">
            Current stock quantities across all facilities and retail stores
          </p>
        </div>
        <button
          type="button"
          onClick={openInflowModal}
          className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          + Receive Stock (Inflow)
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by product name or SKU"
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
            <option value="">All Locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.type === 'warehouse' ? 'Warehouse' : l.storeType ?? l.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-gray-500">
            No inventory balances found. Receive initial stock into a warehouse or store.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-4 py-3">Product / SKU</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">In-Stock Quantity</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Link
                      to="/products/$productId"
                      params={{ productId: item.product.id }}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {item.product.name}
                    </Link>
                    <div className="text-xs text-gray-400">
                      SKU: {item.variant.sku || 'Default'}
                      {item.variant.isDefault ? ' (Default)' : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">
                      {item.location.name}
                    </span>
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                      {item.location.type === 'warehouse'
                        ? 'Warehouse'
                        : item.location.storeType ?? item.location.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900">
                    {item.quantity}{' '}
                    <span className="text-xs font-normal text-gray-500">
                      {item.product.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    ${item.variant.discountedPrice}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(item.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustError(null)
                        setAdjustingItem(item)
                      }}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Adjust Stock
                    </button>
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
          {total} inventory records · page {page} of {totalPages}
        </span>
        <div className="flex gap-3">
          {page > 1 ? (
            <Link
              to="/inventory"
              search={(prev) => ({ ...prev, page: page - 1 })}
              className="text-black underline"
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              to="/inventory"
              search={(prev) => ({ ...prev, page: page + 1 })}
              className="text-black underline"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>

      {/* Inflow Modal */}
      {showInflowModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Receive Stock (Inflow)</h3>

            {inflowError ? (
              <p className="mb-3 rounded bg-red-50 p-2 text-xs text-red-600">
                {inflowError}
              </p>
            ) : null}

            <form onSubmit={handleInflowSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Variant ID *
                <input
                  name="variantId"
                  required
                  placeholder="Paste variant UUID"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Destination Facility / Store *
                <select
                  name="locationId"
                  required
                  className="rounded border px-3 py-2 text-sm"
                >
                  {intakeLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.type === 'warehouse' ? 'Main Warehouse' : l.storeType})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Quantity *
                <input
                  name="quantity"
                  required
                  step="0.001"
                  min="0.001"
                  type="number"
                  placeholder="e.g. 50 or 12.5"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Receipt Note / Reference
                <input
                  name="reason"
                  placeholder="e.g. Supplier PO #1002"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInflowModal(false)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inflowPending}
                  className="rounded bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {inflowPending ? 'Receiving...' : 'Record Inflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Adjust Stock Modal */}
      {adjustingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold">Adjust Stock</h3>
            <p className="mb-4 text-xs text-gray-500">
              {adjustingItem.product.name} at {adjustingItem.location.name} (Current:{' '}
              <span className="font-semibold text-gray-900">
                {adjustingItem.quantity} {adjustingItem.product.unit}
              </span>
              )
            </p>

            {adjustError ? (
              <p className="mb-3 rounded bg-red-50 p-2 text-xs text-red-600">
                {adjustError}
              </p>
            ) : null}

            <form onSubmit={handleAdjustSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Adjustment Type
                <select
                  name="adjustmentType"
                  defaultValue="increase"
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="increase">Increase Stock (+)</option>
                  <option value="decrease">Decrease Stock (-)</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Adjustment Quantity *
                <input
                  name="quantity"
                  required
                  step="0.001"
                  min="0.001"
                  type="number"
                  placeholder="e.g. 5"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Reason * (Mandatory for audit logs)
                <textarea
                  name="reason"
                  required
                  rows={2}
                  placeholder="e.g. Physical inventory count correction, supplier discrepancy..."
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustPending}
                  className="rounded bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {adjustPending ? 'Saving...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}
