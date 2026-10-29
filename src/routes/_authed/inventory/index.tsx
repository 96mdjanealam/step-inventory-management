import { useMemo, useState } from 'react'
import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  addStockFn,
  adjustStockFn,
  listInventoryFn,
} from '../../../server/functions/inventory.ts'
import {
  createStoreFn,
  listLocationsFn,
  listLocationsWithStockFn,
  toggleLocationActiveFn,
  updateLocationFn,
} from '../../../server/functions/locations.ts'
import { listActiveProductsWithVariantsFn } from '../../../server/functions/products.ts'
import { createTransferFn } from '../../../server/functions/transfers.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  locationId: z.string().uuid().optional().catch(undefined),
  search: z.string().trim().min(1).optional().catch(undefined),
  storeType: z.enum(['ownstore', 'franchise']).optional().catch(undefined),
  includeZeroQuantity: z.boolean().default(false).catch(false),
})

export const Route = createFileRoute('/_authed/inventory/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    locationId: search.locationId,
    search: search.search,
    storeType: search.storeType,
    includeZeroQuantity: search.includeZeroQuantity,
  }),
  loader: async ({ deps }) => {
    // If a location is selected, check if it's damaged stock -> redirect to /damage
    if (deps.locationId) {
      const allLocations = await listLocationsFn({
        data: { includeInactive: true },
      })
      const selectedLocation =
        allLocations.find((l) => l.id === deps.locationId) || null

      if (selectedLocation?.type === 'damaged') {
        throw redirect({ to: '/damage' })
      }

      const [inventoryData, activeProducts] = await Promise.all([
        listInventoryFn({
          data: {
            page: deps.page,
            locationId: deps.locationId,
            search: deps.search,
            includeZeroQuantity: deps.includeZeroQuantity,
          },
        }),
        listActiveProductsWithVariantsFn(),
      ])

      return {
        mode: 'location-stock' as const,
        inventoryData,
        allLocations,
        selectedLocation,
        activeProducts,
        locationsWithStock: [],
      }
    }

    // Otherwise, overview mode: load all locations with stock summaries
    const [locationsWithStock, allLocations] = await Promise.all([
      listLocationsWithStockFn({
        data: {
          includeInactive: true,
          search: deps.search,
          storeType: deps.storeType,
        },
      }),
      listLocationsFn({ data: { includeInactive: false } }),
    ])

    return {
      mode: 'overview' as const,
      locationsWithStock,
      allLocations,
      selectedLocation: null,
      inventoryData: { items: [], total: 0, page: 1, pageSize: 20 },
      activeProducts: [],
    }
  },
  component: InventoryPage,
})

function InventoryPage() {
  const loaderData = Route.useLoaderData()
  const { search, locationId, storeType, includeZeroQuantity } =
    Route.useSearch()
  const { user } = Route.useRouteContext()
  const navigate = Route.useNavigate()
  const router = useRouter()

  const isAdmin = user.role === 'admin'

  // Server function mutations
  const addStock = useServerFn(addStockFn)
  const adjustStock = useServerFn(adjustStockFn)
  const createTransfer = useServerFn(createTransferFn)
  const createStore = useServerFn(createStoreFn)
  const updateLocation = useServerFn(updateLocationFn)
  const toggleLocationActive = useServerFn(toggleLocationActiveFn)

  // ===================== OVERVIEW MODAL STATES =====================
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false)
  const [createStorePending, setCreateStorePending] = useState(false)
  const [createStoreError, setCreateStoreError] = useState<string | null>(null)

  const [editingLocation, setEditingLocation] = useState<{
    id: string
    name: string
    address?: string | null
    phone?: string | null
  } | null>(null)
  const [editPending, setEditPending] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [actionPendingId, setActionPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // ===================== STOCK MODAL STATES =====================
  // 1. Receive Stock Modal State
  const [showInflowModal, setShowInflowModal] = useState(false)
  const [inflowPending, setInflowPending] = useState(false)
  const [inflowError, setInflowError] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedVariantId, setSelectedVariantId] = useState<string>('')

  // 2. Adjust Stock Modal State
  const [adjustingItem, setAdjustingItem] = useState<
    (typeof loaderData.inventoryData.items)[number] | null
  >(null)
  const [adjustPending, setAdjustPending] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  // 3. Transfer Stock Modal State
  const [transferringItem, setTransferringItem] = useState<
    (typeof loaderData.inventoryData.items)[number] | null
  >(null)
  const [transferPending, setTransferPending] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)

  // Selected product details for Inflow
  const activeProduct = useMemo(
    () =>
      loaderData.activeProducts.find((p) => p.id === selectedProductId) ?? null,
    [loaderData.activeProducts, selectedProductId],
  )

  // Eligible transfer destinations (active, not current location, not damaged)
  const transferDestinations = useMemo(
    () =>
      loaderData.allLocations.filter(
        (l) => l.isActive && l.id !== locationId && l.type !== 'damaged',
      ),
    [loaderData.allLocations, locationId],
  )

  // ===================== HANDLERS: OVERVIEW =====================
  function handleOverviewSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const val = String(
      new FormData(event.currentTarget).get('search') ?? '',
    ).trim()
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: val || undefined,
      }),
    })
  }

  function handleFilterStoreType(val: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        storeType: (val || undefined) as 'ownstore' | 'franchise' | undefined,
      }),
    })
  }

  async function handleCreateStoreSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setCreateStoreError(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const stType = String(form.get('storeType') ?? 'ownstore') as
      | 'ownstore'
      | 'franchise'
    const address = String(form.get('address') ?? '').trim() || undefined
    const phone = String(form.get('phone') ?? '').trim() || undefined

    if (!name) {
      setCreateStoreError('Store name is required')
      return
    }

    setCreateStorePending(true)
    try {
      await createStore({
        data: { name, storeType: stType, address, phone },
      })
      await router.invalidate()
      setShowCreateStoreModal(false)
    } catch (err) {
      setCreateStoreError(
        err instanceof Error ? err.message : 'Failed to create store',
      )
    } finally {
      setCreateStorePending(false)
    }
  }

  async function handleUpdateLocationSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    if (!editingLocation) return
    setEditError(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const address = String(form.get('address') ?? '').trim() || undefined
    const phone = String(form.get('phone') ?? '').trim() || undefined

    if (!name) {
      setEditError('Location name is required')
      return
    }

    setEditPending(true)
    try {
      await updateLocation({
        data: { id: editingLocation.id, name, address, phone },
      })
      await router.invalidate()
      setEditingLocation(null)
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Failed to update location',
      )
    } finally {
      setEditPending(false)
    }
  }

  async function handleToggleStatus(loc: {
    id: string
    name: string
    isActive: boolean
  }) {
    const nextState = !loc.isActive
    if (
      !nextState &&
      !window.confirm(`Deactivate location "${loc.name}"?`)
    ) {
      return
    }

    setActionError(null)
    setActionPendingId(loc.id)
    try {
      await toggleLocationActive({
        data: { id: loc.id, isActive: nextState },
      })
      await router.invalidate()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to change location status',
      )
    } finally {
      setActionPendingId(null)
    }
  }

  // ===================== HANDLERS: STOCK =====================
  function handleStockSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const val = String(
      new FormData(event.currentTarget).get('search') ?? '',
    ).trim()
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: val || undefined,
      }),
    })
  }

  function openInflowModal() {
    setInflowError(null)
    // Select first active product by default if available
    if (loaderData.activeProducts.length > 0) {
      const firstProd = loaderData.activeProducts[0]
      setSelectedProductId(firstProd.id)
      if (firstProd.variants.length > 0) {
        setSelectedVariantId(firstProd.variants[0].id)
      } else {
        setSelectedVariantId('')
      }
    } else {
      setSelectedProductId('')
      setSelectedVariantId('')
    }
    setShowInflowModal(true)
  }

  function handleProductChange(newProdId: string) {
    setSelectedProductId(newProdId)
    const prod = loaderData.activeProducts.find((p) => p.id === newProdId)
    if (prod && prod.variants.length > 0) {
      setSelectedVariantId(prod.variants[0].id)
    } else {
      setSelectedVariantId('')
    }
  }

  async function handleInflowSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInflowError(null)

    if (!selectedVariantId) {
      setInflowError('Please select a product variant')
      return
    }

    if (!locationId) {
      setInflowError('Location context missing')
      return
    }

    const form = new FormData(event.currentTarget)
    const quantity = String(form.get('quantity') ?? '').trim()
    const reason = String(form.get('reason') ?? '').trim() || undefined

    if (!quantity || Number(quantity) <= 0) {
      setInflowError('Please enter a valid positive quantity')
      return
    }

    const isCount =
      activeProduct?.measurementType === 'count' ||
      activeProduct?.unit === 'piece'
    if (isCount && !Number.isInteger(Number(quantity))) {
      setInflowError(
        `Quantity for ${activeProduct?.unit || 'piece'} items must be a whole number`,
      )
      return
    }

    setInflowPending(true)
    try {
      await addStock({
        data: {
          variantId: selectedVariantId,
          locationId,
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

    if (!quantity || Number(quantity) <= 0) {
      setAdjustError('Please enter a valid positive quantity')
      return
    }

    const isCount =
      adjustingItem.product.measurementType === 'count' ||
      adjustingItem.product.unit === 'piece'
    if (isCount && !Number.isInteger(Number(quantity))) {
      setAdjustError(
        `Quantity for ${adjustingItem.product.unit} items must be a whole number`,
      )
      return
    }

    if (
      adjustmentType === 'decrease' &&
      Number(quantity) > Number(adjustingItem.quantity)
    ) {
      setAdjustError(
        `Cannot decrease by more than available stock (${adjustingItem.quantity} ${adjustingItem.product.unit})`,
      )
      return
    }

    if (!reason) {
      setAdjustError('A reason is mandatory for audit logging')
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

  async function handleTransferSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!transferringItem || !locationId) return
    setTransferError(null)

    const form = new FormData(event.currentTarget)
    const destLocationId = String(
      form.get('destinationLocationId') ?? '',
    ).trim()
    const quantity = String(form.get('quantity') ?? '').trim()
    const notes = String(form.get('notes') ?? '').trim() || undefined

    if (!destLocationId) {
      setTransferError('Please select a destination location')
      return
    }

    if (!quantity || Number(quantity) <= 0) {
      setTransferError('Please enter a valid positive quantity')
      return
    }

    const isCount =
      transferringItem.product.measurementType === 'count' ||
      transferringItem.product.unit === 'piece'
    if (isCount && !Number.isInteger(Number(quantity))) {
      setTransferError(
        `Quantity for ${transferringItem.product.unit} items must be a whole number`,
      )
      return
    }

    if (Number(quantity) > Number(transferringItem.quantity)) {
      setTransferError(
        `Transfer quantity exceeds available stock (${transferringItem.quantity} ${transferringItem.product.unit})`,
      )
      return
    }

    setTransferPending(true)
    try {
      await createTransfer({
        data: {
          variantId: transferringItem.variantId,
          sourceLocationId: locationId,
          destinationLocationId: destLocationId,
          quantity,
          notes,
        },
      })
      await router.invalidate()
      setTransferringItem(null)
    } catch (err) {
      setTransferError(
        err instanceof Error ? err.message : 'Failed to initiate transfer',
      )
    } finally {
      setTransferPending(false)
    }
  }

  // =========================================================================
  // VIEW MODE 1: LOCATION-SPECIFIC PRODUCT LIST
  // =========================================================================
  if (loaderData.mode === 'location-stock') {
    const loc = loaderData.selectedLocation
    const { items, total, page, pageSize } = loaderData.inventoryData
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const isDamagedLocation = loc?.type === 'damaged'

    return (
      <main className="mx-auto max-w-6xl p-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-4">
          <Link
            to="/inventory"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-black"
          >
            ← Back to Locations Overview
          </Link>
        </div>

        {/* Location Header Banner */}
        <div className="mb-6 rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {loc ? loc.name : 'Unknown Location'}
                </h1>
                {loc ? (
                  <span
                    className={`rounded px-2.5 py-0.5 text-xs font-semibold ${
                      loc.type === 'warehouse'
                        ? 'bg-blue-100 text-blue-800'
                        : loc.type === 'damaged'
                          ? 'bg-red-100 text-red-800'
                          : loc.storeType === 'franchise'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {loc.type === 'warehouse'
                      ? 'Main Warehouse'
                      : loc.type === 'damaged'
                        ? 'Damaged Stock'
                        : loc.storeType === 'franchise'
                          ? 'Franchise Store'
                          : 'Own Store'}
                  </span>
                ) : null}
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    loc?.isActive
                      ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20'
                      : 'bg-gray-100 text-gray-600 ring-1 ring-gray-500/20'
                  }`}
                >
                  {loc?.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {loc?.address || loc?.phone ? (
                <p className="mt-1 text-xs text-gray-500">
                  {loc.address ? `Address: ${loc.address}` : ''}
                  {loc.address && loc.phone ? ' · ' : ''}
                  {loc.phone ? `Phone: ${loc.phone}` : ''}
                </p>
              ) : null}
            </div>

            {/* Quick Action Buttons */}
            {!isDamagedLocation ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openInflowModal}
                  className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  + Receive Stock
                </button>
              </div>
            ) : (
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                Damaged stock intake and resolution are managed via the{' '}
                <Link to="/damage" className="font-semibold underline">
                  Damaged Stock Module
                </Link>
                .
              </div>
            )}
          </div>
        </div>

        {/* Search Bar for Location's Inventory */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={handleStockSearch} className="flex flex-1 gap-2">
            <input
              name="search"
              defaultValue={search ?? ''}
              placeholder="Search by product name or SKU in this location..."
              className="flex-1 rounded border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-black px-3 py-2 text-sm text-white hover:bg-gray-800"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!includeZeroQuantity}
                onChange={(e) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      page: 1,
                      includeZeroQuantity: e.target.checked || undefined,
                    }),
                  })
                }
                className="rounded border-gray-300"
              />
              Show 0-balance items
            </label>

            {search ? (
              <Link
                to="/inventory"
                search={(prev) => ({ ...prev, search: undefined, page: 1 })}
                className="text-xs text-gray-500 underline"
              >
                Clear search filter
              </Link>
            ) : null}
          </div>
        </div>

        {/* Inventory Items Table */}
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <p className="text-base font-medium text-gray-700">
              No stock balances at this location
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {search
                ? 'No items matched your search query.'
                : 'Click "+ Receive Stock" above to record incoming inventory.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">SKU & Attributes</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Last Updated</th>
                  {!isDamagedLocation ? (
                    <th className="px-4 py-3 text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => {
                  const attrs = Object.entries(
                    (item.variant.attributes as Record<string, string>) || {},
                  )
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ')

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <Link
                          to="/products/$productId"
                          params={{ productId: item.product.id }}
                          className="font-semibold text-gray-900 hover:underline"
                        >
                          {item.product.name}
                        </Link>
                        <div className="text-xs text-gray-400">
                          {item.product.category}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-medium text-gray-800">
                          {item.variant.sku}
                        </div>
                        {attrs ? (
                          <div className="text-xs text-gray-500">{attrs}</div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-base font-bold text-gray-900">
                          {item.quantity}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {item.product.unit}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-600">
                        <div>${item.variant.discountedPrice}</div>
                        {item.variant.regularPrice &&
                        item.variant.regularPrice !==
                          item.variant.discountedPrice ? (
                          <div className="text-gray-400 line-through">
                            ${item.variant.regularPrice}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </td>

                      {!isDamagedLocation ? (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
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
                            <button
                              type="button"
                              onClick={() => {
                                setTransferError(null)
                                setTransferringItem(item)
                              }}
                              className="text-xs font-medium text-purple-600 hover:underline"
                            >
                              Transfer Stock
                            </button>
                          </div>
                        </td>
                      ) : null}
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
            {total} items · page {page} of {totalPages}
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

        {/* MODAL 1: RECEIVE STOCK (INFLOW) */}
        {showInflowModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-1 text-lg font-semibold text-gray-900">
                Receive Stock
              </h3>
              <p className="mb-4 text-xs text-gray-500">
                Receiving into:{' '}
                <span className="font-semibold text-gray-800">
                  {loc?.name}
                </span>
              </p>

              {inflowError ? (
                <p className="mb-3 rounded bg-red-50 p-2.5 text-xs text-red-600">
                  {inflowError}
                </p>
              ) : null}

              <form
                onSubmit={handleInflowSubmit}
                className="flex flex-col gap-3"
              >
                {/* 1. Product Selection */}
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Product *
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleProductChange(e.target.value)}
                    required
                    className="rounded border px-3 py-2 text-sm"
                  >
                    {loaderData.activeProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category}) · {p.unit}
                      </option>
                    ))}
                  </select>
                </label>

                {/* 2. Variant Selection */}
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Product Variant *
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    required
                    className="rounded border px-3 py-2 text-sm"
                  >
                    {activeProduct?.variants.map((v) => {
                      const attrStr = Object.entries(
                        (v.attributes as Record<string, string>) || {},
                      )
                        .map(([key, val]) => `${key}: ${val}`)
                        .join(', ')

                      return (
                        <option key={v.id} value={v.id}>
                          SKU: {v.sku}
                          {attrStr ? ` (${attrStr})` : ''} — $
                          {v.discountedPrice}
                        </option>
                      )
                    })}
                  </select>
                </label>

                {/* 3. Quantity Input with Unit */}
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Quantity ({activeProduct?.unit || 'unit'}) *
                  <div className="relative flex items-center">
                    <input
                      name="quantity"
                      required
                      type="number"
                      step={
                        activeProduct?.measurementType === 'count'
                          ? '1'
                          : '0.001'
                      }
                      min={
                        activeProduct?.measurementType === 'count'
                          ? '1'
                          : '0.001'
                      }
                      placeholder={
                        activeProduct?.measurementType === 'count'
                          ? 'e.g. 25'
                          : 'e.g. 12.500'
                      }
                      className="w-full rounded border px-3 py-2 pr-16 text-sm"
                    />
                    <span className="pointer-events-none absolute right-3 text-xs font-semibold text-gray-500">
                      {activeProduct?.unit}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    Measurement:{' '}
                    {activeProduct?.measurementType === 'count'
                      ? 'Whole units (pieces, items)'
                      : `Decimals supported (${activeProduct?.measurementType})`}
                  </span>
                </label>

                {/* 4. Note/Reference */}
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Receipt Note / PO Reference
                  <input
                    name="reason"
                    placeholder="e.g. Supplier PO #1002 or Invoice #5541"
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
                    disabled={inflowPending || !selectedVariantId}
                    className="rounded bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {inflowPending ? 'Receiving...' : 'Record Inflow'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {/* MODAL 2: ADJUST STOCK */}
        {adjustingItem ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-1 text-lg font-semibold text-gray-900">
                Adjust Stock
              </h3>
              <p className="mb-4 text-xs text-gray-500">
                {adjustingItem.product.name} (SKU: {adjustingItem.variant.sku})
                at {adjustingItem.location.name}
                <br />
                Current Stock:{' '}
                <span className="font-bold text-gray-900">
                  {adjustingItem.quantity} {adjustingItem.product.unit}
                </span>
              </p>

              {adjustError ? (
                <p className="mb-3 rounded bg-red-50 p-2.5 text-xs text-red-600">
                  {adjustError}
                </p>
              ) : null}

              <form
                onSubmit={handleAdjustSubmit}
                className="flex flex-col gap-3"
              >
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
                  Adjustment Quantity ({adjustingItem.product.unit}) *
                  <div className="relative flex items-center">
                    <input
                      name="quantity"
                      required
                      type="number"
                      step={
                        adjustingItem.product.measurementType === 'count'
                          ? '1'
                          : '0.001'
                      }
                      min={
                        adjustingItem.product.measurementType === 'count'
                          ? '1'
                          : '0.001'
                      }
                      placeholder="e.g. 5"
                      className="w-full rounded border px-3 py-2 pr-16 text-sm"
                    />
                    <span className="pointer-events-none absolute right-3 text-xs font-semibold text-gray-500">
                      {adjustingItem.product.unit}
                    </span>
                  </div>
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium">
                  Reason * (Required for audit log)
                  <textarea
                    name="reason"
                    required
                    rows={2}
                    placeholder="e.g. Physical inventory count discrepancy, returned shipment correction..."
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

        {/* MODAL 3: TRANSFER STOCK */}
        {transferringItem ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-1 text-lg font-semibold text-gray-900">
                Transfer Stock
              </h3>
              <p className="mb-4 text-xs text-gray-500">
                Item: {transferringItem.product.name} (SKU:{' '}
                {transferringItem.variant.sku})
                <br />
                Source:{' '}
                <span className="font-semibold text-gray-800">
                  {loc?.name}
                </span>{' '}
                · Available:{' '}
                <span className="font-bold text-gray-900">
                  {transferringItem.quantity} {transferringItem.product.unit}
                </span>
              </p>

              {transferError ? (
                <p className="mb-3 rounded bg-red-50 p-2.5 text-xs text-red-600">
                  {transferError}
                </p>
              ) : null}

              <form
                onSubmit={handleTransferSubmit}
                className="flex flex-col gap-3"
              >
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Destination Location *
                  <select
                    name="destinationLocationId"
                    required
                    className="rounded border px-3 py-2 text-sm"
                  >
                    <option value="">Select destination...</option>
                    {transferDestinations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} (
                        {d.type === 'warehouse'
                          ? 'Warehouse'
                          : d.storeType ?? d.type}
                        )
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium">
                  Transfer Quantity ({transferringItem.product.unit}) *
                  <div className="relative flex items-center">
                    <input
                      name="quantity"
                      required
                      type="number"
                      step={
                        transferringItem.product.measurementType === 'count'
                          ? '1'
                          : '0.001'
                      }
                      min={
                        transferringItem.product.measurementType === 'count'
                          ? '1'
                          : '0.001'
                      }
                      max={transferringItem.quantity}
                      placeholder={`Max: ${transferringItem.quantity}`}
                      className="w-full rounded border px-3 py-2 pr-16 text-sm"
                    />
                    <span className="pointer-events-none absolute right-3 text-xs font-semibold text-gray-500">
                      {transferringItem.product.unit}
                    </span>
                  </div>
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium">
                  Transfer Notes / Memo
                  <input
                    name="notes"
                    placeholder="e.g. Stock replenishment for downtown store"
                    className="rounded border px-3 py-2 text-sm"
                  />
                </label>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferringItem(null)}
                    className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={transferPending}
                    className="rounded bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {transferPending ? 'Transferring...' : 'Send Transfer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    )
  }

  // =========================================================================
  // VIEW MODE 2: LOCATION HUB OVERVIEW (when no locationId is selected)
  // =========================================================================
  const facilities = loaderData.locationsWithStock.filter(
    (l) => l.type !== 'store',
  )
  const stores = loaderData.locationsWithStock.filter((l) => l.type === 'store')

  const warehouseLoc = facilities.find((l) => l.type === 'warehouse')
  const damagedLoc = facilities.find((l) => l.type === 'damaged')

  return (
    <main className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Inventory & Locations
          </h1>
          <p className="text-sm text-gray-500">
            Select a facility or retail store to view and manage stock balances
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => {
              setCreateStoreError(null)
              setShowCreateStoreModal(true)
            }}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            + New Store
          </button>
        ) : null}
      </div>

      {actionError ? (
        <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">
          {actionError}
        </div>
      ) : null}

      {/* SECTION 1: PROMINENT PRIMARY FACILITIES (Main Warehouse & Damage Stock) */}
      <div className="mb-8">
        <h2 className="mb-3 text-xs font-semibold tracking-wider text-gray-500 uppercase">
          Primary Facilities
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Main Warehouse Card */}
          {warehouseLoc ? (
            <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                      Primary Warehouse
                    </span>
                    <h3 className="mt-2 text-xl font-bold text-gray-900">
                      {warehouseLoc.name}
                    </h3>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-600/20">
                    Active
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3">
                  <div>
                    <span className="text-xs text-gray-500">Total Quantity</span>
                    <p className="text-lg font-bold text-gray-900">
                      {warehouseLoc.totalQuantity}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Active Items</span>
                    <p className="text-lg font-bold text-gray-900">
                      {warehouseLoc.itemCount} in stock
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t pt-4">
                <span className="text-xs text-gray-400">
                  Central distribution center
                </span>
                <Link
                  to="/inventory"
                  search={{ locationId: warehouseLoc.id }}
                  className="rounded bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                >
                  Manage Stock →
                </Link>
              </div>
            </div>
          ) : null}

          {/* Central Damaged Stock Card */}
          {damagedLoc ? (
            <div className="flex flex-col justify-between rounded-xl border border-red-200 bg-red-50/30 p-5 shadow-sm transition hover:shadow-md">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                      Quarantine & Loss
                    </span>
                    <h3 className="mt-2 text-xl font-bold text-gray-900">
                      {damagedLoc.name}
                    </h3>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20">
                    Active
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-white p-3 border border-red-100">
                  <div>
                    <span className="text-xs text-gray-500">In Quarantine</span>
                    <p className="text-lg font-bold text-red-700">
                      {damagedLoc.totalQuantity} units
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Quarantined Items</span>
                    <p className="text-lg font-bold text-gray-900">
                      {damagedLoc.itemCount} in holding
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-red-100 pt-4">
                <Link
                  to="/damage"
                  search={{ status: 'disposed' }}
                  className="text-xs font-semibold text-rose-700 hover:underline"
                >
                  View Disposed / Wasted ↗
                </Link>
                <Link
                  to="/damage"
                  className="rounded bg-red-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
                >
                  Manage Damaged Stock →
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* SECTION 2: RETAIL STORES & BRANCHES */}
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Retail Stores</h2>
            <p className="text-xs text-gray-500">
              Company-owned retail outlets and franchise locations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <form onSubmit={handleOverviewSearch} className="flex gap-1.5">
              <input
                name="search"
                defaultValue={search ?? ''}
                placeholder="Search store name or address..."
                className="rounded border px-3 py-1.5 text-xs"
              />
              <button
                type="submit"
                className="rounded bg-black px-3 py-1.5 text-xs text-white hover:bg-gray-800"
              >
                Search
              </button>
            </form>

            {/* Filter Store Type */}
            <select
              value={storeType ?? ''}
              onChange={(e) => handleFilterStoreType(e.target.value)}
              className="rounded border px-2.5 py-1.5 text-xs"
            >
              <option value="">All Store Types</option>
              <option value="ownstore">Own Stores</option>
              <option value="franchise">Franchise Stores</option>
            </select>
          </div>
        </div>

        {/* Store Grid / Table */}
        {stores.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm font-medium text-gray-600">
              No retail stores found
            </p>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setCreateStoreError(null)
                  setShowCreateStoreModal(true)
                }}
                className="mt-3 text-xs font-semibold text-black underline"
              >
                + Create your first store
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Store Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Address & Phone</th>
                  <th className="px-4 py-3">Total Quantity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stores.map((store) => (
                  <tr
                    key={store.id}
                    className={`hover:bg-gray-50/60 ${
                      !store.isActive ? 'bg-gray-50/40 opacity-75' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      <Link
                        to="/inventory"
                        search={{ locationId: store.id }}
                        className="hover:underline"
                      >
                        {store.name}
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          store.storeType === 'franchise'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {store.storeType === 'franchise'
                          ? 'Franchise'
                          : 'Own Store'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-600">
                      <div>{store.address || '—'}</div>
                      {store.phone ? (
                        <div className="text-gray-400">{store.phone}</div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-900">
                        {store.totalQuantity}
                      </span>
                      <span className="ml-1 text-xs text-gray-500">
                        ({store.itemCount} items)
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          store.isActive
                            ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20'
                            : 'bg-gray-100 text-gray-600 ring-1 ring-gray-500/20'
                        }`}
                      >
                        {store.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to="/inventory"
                          search={{ locationId: store.id }}
                          className="rounded bg-black px-2.5 py-1 text-xs font-semibold text-white hover:bg-gray-800"
                        >
                          View Stock
                        </Link>

                        {isAdmin ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditError(null)
                                setEditingLocation({
                                  id: store.id,
                                  name: store.name,
                                  address: store.address,
                                  phone: store.phone,
                                })
                              }}
                              className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              disabled={actionPendingId === store.id}
                              onClick={() => handleToggleStatus(store)}
                              className={`rounded px-2 py-1 text-xs font-medium ${
                                store.isActive
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-green-700 hover:bg-green-50'
                              } disabled:opacity-50`}
                            >
                              {store.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* OVERVIEW MODAL 1: CREATE STORE */}
      {showCreateStoreModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Create New Store
            </h3>

            {createStoreError ? (
              <p className="mb-3 rounded bg-red-50 p-2.5 text-xs text-red-600">
                {createStoreError}
              </p>
            ) : null}

            <form
              onSubmit={handleCreateStoreSubmit}
              className="flex flex-col gap-3"
            >
              <label className="flex flex-col gap-1 text-sm font-medium">
                Store Name *
                <input
                  name="name"
                  required
                  placeholder="e.g. Uptown Branch"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Store Type *
                <select
                  name="storeType"
                  defaultValue="ownstore"
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="ownstore">Own Store</option>
                  <option value="franchise">Franchise</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Address
                <input
                  name="address"
                  placeholder="Street address, city"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Phone
                <input
                  name="phone"
                  placeholder="Contact phone number"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateStoreModal(false)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createStorePending}
                  className="rounded bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {createStorePending ? 'Creating...' : 'Create Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* OVERVIEW MODAL 2: EDIT LOCATION */}
      {editingLocation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Edit Location
            </h3>

            {editError ? (
              <p className="mb-3 rounded bg-red-50 p-2.5 text-xs text-red-600">
                {editError}
              </p>
            ) : null}

            <form
              onSubmit={handleUpdateLocationSubmit}
              className="flex flex-col gap-3"
            >
              <label className="flex flex-col gap-1 text-sm font-medium">
                Location Name *
                <input
                  name="name"
                  defaultValue={editingLocation.name}
                  required
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Address
                <input
                  name="address"
                  defaultValue={editingLocation.address ?? ''}
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Phone
                <input
                  name="phone"
                  defaultValue={editingLocation.phone ?? ''}
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLocation(null)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editPending}
                  className="rounded bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {editPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}
