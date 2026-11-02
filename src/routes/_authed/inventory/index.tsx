import { useMemo, useState } from 'react'
import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Plus } from 'lucide-react'
import { z } from 'zod'
import {
  Button,
  SmallButton,
  SmallLinkButton,
  TableActionButton,
} from '../../../components/Button.tsx'
import { FilterToolbar, SearchInput } from '../../../components/FilterToolbar.tsx'
import { LocationSelect } from '../../../components/LocationSelect.tsx'
import { ProductSelect } from '../../../components/ProductSelect.tsx'
import { Select } from '../../../components/Select.tsx'
import { TableCard } from '../../../components/TableCard.tsx'
import { TablePagination } from '../../../components/TablePagination.tsx'
import { VariantSelect } from '../../../components/VariantSelect.tsx'
import {
  VariantDisplay,
} from '../../../lib/display-formatters.tsx'
import {
  addStockFn,
  adjustStockFn,
  listInventoryFn,
} from '../../../server/functions/inventory.ts'
import {
  createStoreFn,
  listLocationsFn,
  listLocationsWithStockFn,
  listLocationsWithStockPaginatedFn,
  toggleLocationActiveFn,
  updateLocationFn,
} from '../../../server/functions/locations.ts'
import { listActiveProductsWithVariantsFn } from '../../../server/functions/products.ts'
import { createTransferFn } from '../../../server/functions/transfers.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z.number().int().min(1).max(100).default(10).catch(10),
  locationId: z.string().uuid().optional().catch(undefined),
  search: z.string().trim().min(1).optional().catch(undefined),
  storeType: z.enum(['ownstore', 'franchise']).optional().catch(undefined),
  includeZeroQuantity: z.boolean().default(false).catch(false),
})

export const Route = createFileRoute('/_authed/inventory/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
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
            pageSize: deps.pageSize,
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
        facilitiesWithStock: [],
        storesData: { items: [], total: 0, page: 1, pageSize: 10 },
        locationsWithStock: [],
      }
    }

    // Otherwise, overview mode: load primary facilities (independent of search) and paginated stores
    const [facilitiesWithStock, storesData, allLocations] = await Promise.all([
      listLocationsWithStockFn({
        data: {
          includeInactive: true,
        },
      }),
      listLocationsWithStockPaginatedFn({
        data: {
          includeInactive: true,
          type: 'store',
          search: deps.search,
          storeType: deps.storeType,
          page: deps.page,
          pageSize: deps.pageSize,
        },
      }),
      listLocationsFn({ data: { includeInactive: false } }),
    ])

    return {
      mode: 'overview' as const,
      facilitiesWithStock,
      storesData,
      locationsWithStock: facilitiesWithStock,
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
  const { search, locationId, storeType, includeZeroQuantity, page = 1, pageSize = 10 } =
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
  const [transferDestinationId, setTransferDestinationId] = useState<string>('')
  const [transferPending, setTransferPending] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)

  // Selected product details for Inflow
  const activeProduct = useMemo(
    () =>
      loaderData.activeProducts.find((p) => p.id === selectedProductId) ?? null,
    [loaderData.activeProducts, selectedProductId],
  )


  // ===================== HANDLERS: OVERVIEW =====================
  function handleOverviewSearchQuery(val: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: val || undefined,
      }),
      replace: true,
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
  function handleStockSearchQuery(val: string) {
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
    // Start with blank product and blank variant
    setSelectedProductId('')
    setSelectedVariantId('')
    setShowInflowModal(true)
  }

  function handleProductChange(newProdId: string) {
    setSelectedProductId(newProdId)
    // Automatically reset variant selection to blank when product changes
    setSelectedVariantId('')
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
    const destLocationId = (
      transferDestinationId || String(form.get('destinationLocationId') ?? '')
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
    const isDamagedLocation = loc?.type === 'damaged'

    return (
      <main className="mx-auto max-w-7xl p-6 space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            to="/inventory"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            ← Back to Locations Overview
          </Link>
        </div>

        {/* Location Header Banner */}
        <div className="border border-neutral-200 bg-white p-5 shadow-xs">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                  {loc ? loc.name : 'Unknown Location'}
                </h1>
                {loc ? (
                  <span
                    className={`px-2.5 py-0.5 text-xs font-semibold ${
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
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                    loc?.isActive
                      ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20'
                      : 'bg-gray-100 text-gray-600 ring-1 ring-gray-500/20'
                  }`}
                >
                  {loc?.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {loc?.address || loc?.phone ? (
                <p className="mt-1 text-xs text-neutral-500">
                  {loc.address ? `Address: ${loc.address}` : ''}
                  {loc.address && loc.phone ? ' · ' : ''}
                  {loc.phone ? `Phone: ${loc.phone}` : ''}
                </p>
              ) : null}
            </div>

            {/* Quick Action Buttons */}
            {!isDamagedLocation ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={openInflowModal}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Receive Stock
                </Button>
              </div>
            ) : (
              <div className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Damaged stock intake and resolution are managed via the{' '}
                <Link to="/damage" className="font-semibold underline">
                  Damaged Stock Module
                </Link>
                .
              </div>
            )}
          </div>
        </div>

        {/* Search and Filters for Location's Inventory */}
        <FilterToolbar>
          <SearchInput
            defaultValue={search ?? ''}
            placeholder="Search by product name or SKU in this location..."
            onSearch={handleStockSearchQuery}
            onClear={() => handleStockSearchQuery('')}
          />

          <FilterToolbar.Right>
            <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer select-none">
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
                className="border-neutral-300 text-neutral-900 focus:ring-neutral-900"
              />
              Show 0-balance items
            </label>
          </FilterToolbar.Right>
        </FilterToolbar>

        {/* Inventory Items Table */}
        <TableCard>
          <TableCard.Table>
            <TableCard.Header>
              <TableCard.Row isHeader>
                <TableCard.Head>Product Name</TableCard.Head>
                <TableCard.Head>SKU & Attributes</TableCard.Head>
                <TableCard.Head align="right">Quantity</TableCard.Head>
                <TableCard.Head>Unit</TableCard.Head>
                <TableCard.Head>Price</TableCard.Head>
                <TableCard.Head>Last Updated</TableCard.Head>
                {!isDamagedLocation ? (
                  <TableCard.Head align="right">Actions</TableCard.Head>
                ) : null}
              </TableCard.Row>
            </TableCard.Header>
            <TableCard.Body>
              {items.length === 0 ? (
                <TableCard.Empty
                  colSpan={!isDamagedLocation ? 7 : 6}
                  message={
                    search
                      ? 'No items matched your search query.'
                      : 'No stock balances at this location.'
                  }
                />
              ) : (
                items.map((item) => {
                  return (
                    <TableCard.Row key={item.id}>
                      <TableCard.Cell>
                        <Link
                          to="/products/$productId"
                          params={{ productId: item.product.id }}
                          className="font-semibold text-neutral-900 hover:underline block"
                        >
                          {item.product.name}
                        </Link>
                        <div className="text-xs text-neutral-400">
                          {item.product.category}
                        </div>
                      </TableCard.Cell>

                      <TableCard.Cell>
                        <VariantDisplay
                          variant={{
                            attributes: item.variant.attributes as Record<string, string>,
                            sku: item.variant.sku,
                          }}
                        />
                      </TableCard.Cell>

                      <TableCard.Cell align="right" className="whitespace-nowrap">
                        <span className="text-base font-bold text-neutral-900">
                          {item.quantity}
                        </span>
                      </TableCard.Cell>

                      <TableCard.Cell className="whitespace-nowrap">
                        <span className="bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                          {item.product.unit}
                        </span>
                      </TableCard.Cell>

                      <TableCard.Cell className="text-xs text-neutral-600 whitespace-nowrap">
                        <div>${item.variant.discountedPrice}</div>
                        {item.variant.regularPrice &&
                        item.variant.regularPrice !==
                          item.variant.discountedPrice ? (
                          <div className="text-neutral-400 line-through">
                            ${item.variant.regularPrice}
                          </div>
                        ) : null}
                      </TableCard.Cell>

                      <TableCard.Cell className="text-xs text-neutral-500 whitespace-nowrap">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </TableCard.Cell>

                      {!isDamagedLocation ? (
                        <TableCard.Cell align="right" className="whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <TableActionButton
                              variant="default"
                              onClick={() => {
                                setAdjustError(null)
                                setAdjustingItem(item)
                              }}
                            >
                              Adjust Stock
                            </TableActionButton>
                            <TableActionButton
                              variant="default"
                              onClick={() => {
                                setTransferError(null)
                                setTransferDestinationId('')
                                setTransferringItem(item)
                              }}
                            >
                              Transfer Stock
                            </TableActionButton>
                          </div>
                        </TableCard.Cell>
                      ) : null}
                    </TableCard.Row>
                  )
                })
              )}
            </TableCard.Body>
          </TableCard.Table>
          <TableCard.Footer>
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
          </TableCard.Footer>
        </TableCard>

        {/* MODAL 1: RECEIVE STOCK (INFLOW) */}
        {showInflowModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg bg-white p-6 shadow-xl border border-neutral-300">
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
                <p className="mb-3 bg-red-50 p-2.5 text-xs text-red-600 border border-red-200">
                  {inflowError}
                </p>
              ) : null}

              <form
                onSubmit={handleInflowSubmit}
                className="flex flex-col gap-3"
              >
                {/* 1. Product Selection */}
                <div className="flex flex-col gap-1 text-sm font-medium">
                  <label className="text-xs font-semibold text-gray-700">
                    Product *
                  </label>
                  <ProductSelect
                    value={selectedProductId}
                    onChange={(val) => handleProductChange(val)}
                    placeholder="-- Choose Product --"
                  />
                </div>

                {/* 2. Variant Selection */}
                <div className="flex flex-col gap-1 text-sm font-medium">
                  <label className="text-xs font-semibold text-gray-700">
                    Product Variant *
                  </label>
                  <VariantSelect
                    productId={selectedProductId}
                    value={selectedVariantId}
                    onChange={(val) => setSelectedVariantId(val)}
                    placeholder="-- Choose Variant --"
                    disabled={!selectedProductId}
                  />
                </div>

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
                      className="w-full border border-neutral-300 px-3 py-2 pr-16 text-sm"
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
                    className="border border-neutral-300 px-3 py-2 text-sm"
                  />
                </label>

                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setShowInflowModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!selectedVariantId}
                    isLoading={inflowPending}
                  >
                    Record Inflow
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {/* MODAL 2: ADJUST STOCK */}
        {adjustingItem ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md bg-white p-6 shadow-xl border border-neutral-300">
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
                <p className="mb-3 bg-red-50 p-2.5 text-xs text-red-600 border border-red-200">
                  {adjustError}
                </p>
              ) : null}

              <form
                onSubmit={handleAdjustSubmit}
                className="flex flex-col gap-3"
              >
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Adjustment Type
                  <Select
                    name="adjustmentType"
                    defaultValue="increase"
                  >
                    <option value="increase">Increase Stock (+)</option>
                    <option value="decrease">Decrease Stock (-)</option>
                  </Select>
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
                      className="w-full border border-neutral-300 px-3 py-2 pr-16 text-sm"
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
                    className="border border-neutral-300 px-3 py-2 text-sm"
                  />
                </label>

                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setAdjustingItem(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    isLoading={adjustPending}
                  >
                    Confirm Adjustment
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {/* MODAL 3: TRANSFER STOCK */}
        {transferringItem ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md bg-white p-6 shadow-xl border border-neutral-300">
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
                <p className="mb-3 bg-red-50 p-2.5 text-xs text-red-600 border border-red-200">
                  {transferError}
                </p>
              ) : null}

              <form
                onSubmit={handleTransferSubmit}
                className="flex flex-col gap-3"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-neutral-800">
                    Destination Location *
                  </label>
                  <LocationSelect
                    value={transferDestinationId}
                    onChange={(val) => setTransferDestinationId(val)}
                    placeholder="-- Select destination --"
                  />
                </div>

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
                      className="w-full border border-neutral-300 px-3 py-2 pr-16 text-sm"
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
                    className="border border-neutral-300 px-3 py-2 text-sm"
                  />
                </label>

                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setTransferringItem(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    isLoading={transferPending}
                  >
                    Send Transfer
                  </Button>
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
  const facilities = (
    loaderData.facilitiesWithStock || loaderData.locationsWithStock || []
  ).filter((l) => l.type !== 'store')
  const warehouseLoc = facilities.find((l) => l.type === 'warehouse')
  const damagedLoc = facilities.find((l) => l.type === 'damaged')

  const stores = loaderData.storesData?.items || []
  const totalStores = loaderData.storesData?.total || 0

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Inventory & Locations
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Select a facility or retail store to view and manage stock balances
          </p>
        </div>
        {isAdmin ? (
          <Button
            onClick={() => {
              setCreateStoreError(null)
              setShowCreateStoreModal(true)
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Store
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <div className="mb-4 bg-red-50 p-3 text-sm text-red-600 border border-red-200">
          {actionError}
        </div>
      ) : null}

      {/* SECTION 1: PROMINENT PRIMARY FACILITIES (Main Warehouse & Damage Stock) */}
      <div className="mb-8">
        <h2 className="mb-3 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Primary Facilities
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Main Warehouse Card */}
          {warehouseLoc ? (
            <div className="flex flex-col justify-between border border-neutral-200 bg-white p-5 shadow-xs transition hover:border-neutral-300">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block bg-neutral-100 text-neutral-800 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">
                      Primary Facility
                    </span>
                    <h3 className="mt-1.5 text-xl font-bold tracking-tight text-neutral-900">
                      {warehouseLoc.name}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Central distribution hub · Stock intake & inter-location transfers
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50 p-3.5 border border-neutral-200">
                  <div>
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                      Stock by Unit
                    </span>
                    {warehouseLoc.units && warehouseLoc.units.length > 0 ? (
                      <div className="space-y-1">
                        {warehouseLoc.units.map((u) => (
                          <div key={u.unit} className="flex items-baseline gap-1.5">
                            <span className="text-lg font-bold text-neutral-900">
                              {u.quantity}
                            </span>
                            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wide">
                              {u.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-neutral-400">
                        0 in stock
                      </span>
                    )}
                  </div>

                  <div className="sm:border-l sm:border-neutral-200 sm:pl-3">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                      Active Catalog Items
                    </span>
                    <div className="text-lg font-bold text-neutral-900">
                      {warehouseLoc.itemCount}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Distinct product variants in stock
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-3.5">
                <span className="text-xs text-neutral-400">
                  {warehouseLoc.address || 'Central Storage & Fulfillment'}
                </span>
                <SmallLinkButton
                  to="/inventory"
                  search={{ locationId: warehouseLoc.id }}
                  variant="primary"
                >
                  Manage Stock →
                </SmallLinkButton>
              </div>
            </div>
          ) : null}

          {/* Central Damaged Stock Card */}
          {damagedLoc ? (
            <div className="flex flex-col justify-between border border-rose-200 bg-rose-50/20 p-5 shadow-xs transition hover:border-rose-300">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block bg-rose-100 text-rose-800 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">
                      Quarantine & Loss
                    </span>
                    <h3 className="mt-1.5 text-xl font-bold tracking-tight text-neutral-900">
                      {damagedLoc.name}
                    </h3>
                    <p className="text-xs text-rose-700/80 mt-0.5">
                      Defective stock quarantined for inspection, repair, or scrap
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                    Quarantine
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 border border-rose-100">
                  <div>
                    <span className="text-[11px] font-semibold text-rose-800/80 uppercase tracking-wider block mb-1">
                      In Quarantine by Unit
                    </span>
                    {damagedLoc.units && damagedLoc.units.length > 0 ? (
                      <div className="space-y-1">
                        {damagedLoc.units.map((u) => (
                          <div key={u.unit} className="flex items-baseline gap-1.5">
                            <span className="text-lg font-bold text-rose-700">
                              {u.quantity}
                            </span>
                            <span className="text-xs font-medium text-rose-600 uppercase tracking-wide">
                              {u.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-neutral-400">
                        0 quarantined
                      </span>
                    )}
                  </div>

                  <div className="sm:border-l sm:border-rose-100 sm:pl-3">
                    <span className="text-[11px] font-semibold text-rose-800/80 uppercase tracking-wider block mb-1">
                      Quarantined Batches
                    </span>
                    <div className="text-lg font-bold text-neutral-900">
                      {damagedLoc.itemCount}
                    </div>
                    <p className="text-xs text-rose-600/80 mt-0.5">
                      Items currently in holding
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-rose-100 pt-3.5">
                <Link
                  to="/damage"
                  search={{ status: 'disposed' }}
                  className="text-xs font-semibold text-rose-700 hover:underline"
                >
                  View Disposed / Wasted ↗
                </Link>
                <SmallLinkButton to="/damage" variant="danger">
                  Manage Damaged Stock →
                </SmallLinkButton>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* SECTION 2: RETAIL STORES & BRANCHES */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">Retail Stores</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Company-owned retail outlets and franchise locations
          </p>
        </div>

        {/* Filter Toolbar matching the rest of the application */}
        <FilterToolbar>
          <SearchInput
            defaultValue={search ?? ''}
            placeholder="Search stores by name, address, or phone..."
            debounceMs={300}
            onSearch={handleOverviewSearchQuery}
            onClear={() => handleOverviewSearchQuery('')}
          />

          <FilterToolbar.Right>
            <Select
              value={storeType ?? ''}
              onChange={(e) => handleFilterStoreType(e.target.value)}
              className="w-full sm:w-48"
            >
              <option value="">All Store Types</option>
              <option value="ownstore">Own Stores</option>
              <option value="franchise">Franchise Stores</option>
            </Select>
          </FilterToolbar.Right>
        </FilterToolbar>

        {/* Store Grid / Table */}
        <TableCard>
          <TableCard.Table>
            <TableCard.Header>
              <TableCard.Row isHeader>
                <TableCard.Head>Store Name</TableCard.Head>
                <TableCard.Head>Type</TableCard.Head>
                <TableCard.Head>Address & Phone</TableCard.Head>
                <TableCard.Head>Stock by Unit</TableCard.Head>
                <TableCard.Head>Status</TableCard.Head>
                <TableCard.Head align="right">Actions</TableCard.Head>
              </TableCard.Row>
            </TableCard.Header>
            <TableCard.Body>
              {stores.length === 0 ? (
                <TableCard.Empty
                  colSpan={6}
                  message="No retail stores found matching your filters."
                />
              ) : (
                stores.map((store) => (
                  <TableCard.Row
                    key={store.id}
                    className={!store.isActive ? 'bg-neutral-50/40 opacity-75' : ''}
                  >
                    <TableCard.Cell className="font-semibold text-neutral-900">
                      <Link
                        to="/inventory"
                        search={{ locationId: store.id }}
                        className="hover:underline"
                      >
                        {store.name}
                      </Link>
                    </TableCard.Cell>

                    <TableCard.Cell className="whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold ${
                          store.storeType === 'franchise'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {store.storeType === 'franchise'
                          ? 'Franchise'
                          : 'Own Store'}
                      </span>
                    </TableCard.Cell>

                    <TableCard.Cell className="text-xs text-neutral-600 max-w-xs break-words leading-relaxed">
                      <div>{store.address || '—'}</div>
                      {store.phone ? (
                        <div className="text-neutral-400 mt-0.5">{store.phone}</div>
                      ) : null}
                    </TableCard.Cell>

                    <TableCard.Cell className="whitespace-nowrap">
                      {store.units && store.units.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {store.units.map((u) => (
                            <span key={u.unit} className="text-xs font-bold text-neutral-900">
                              {u.quantity}{' '}
                              <span className="font-normal text-neutral-500 uppercase text-[10px]">
                                {u.unit}
                              </span>
                            </span>
                          ))}
                          <span className="text-[11px] text-neutral-400">
                            ({store.itemCount} items)
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">0 items</span>
                      )}
                    </TableCard.Cell>

                    <TableCard.Cell className="whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                          store.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                        }`}
                      >
                        {store.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCard.Cell>

                    <TableCard.Cell align="right" className="whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <SmallLinkButton
                          to="/inventory"
                          search={{ locationId: store.id }}
                          variant="primary"
                        >
                          View Stock
                        </SmallLinkButton>

                        {isAdmin ? (
                          <>
                            <SmallButton
                              variant="outline"
                              onClick={() => {
                                setEditError(null)
                                setEditingLocation({
                                  id: store.id,
                                  name: store.name,
                                  address: store.address,
                                  phone: store.phone,
                                })
                              }}
                            >
                              Edit
                            </SmallButton>

                            <SmallButton
                              variant={store.isActive ? 'danger' : 'success'}
                              disabled={actionPendingId === store.id}
                              onClick={() => handleToggleStatus(store)}
                            >
                              {store.isActive ? 'Deactivate' : 'Activate'}
                            </SmallButton>
                          </>
                        ) : null}
                      </div>
                    </TableCard.Cell>
                  </TableCard.Row>
                ))
              )}
            </TableCard.Body>
          </TableCard.Table>

          {/* Pagination Bar for Retail Stores */}
          <TableCard.Footer>
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={totalStores}
              onPageChange={(newPage) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    page: newPage,
                  }),
                })
              }
              onPageSizeChange={(newPageSize) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    pageSize: newPageSize,
                    page: 1,
                  }),
                })
              }
            />
          </TableCard.Footer>
        </TableCard>
      </div>

      {/* OVERVIEW MODAL 1: CREATE STORE */}
      {showCreateStoreModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white p-6 shadow-xl border border-neutral-300">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Create New Store
            </h3>

            {createStoreError ? (
              <p className="mb-3 bg-red-50 p-2.5 text-xs text-red-600 border border-red-200">
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
                  className="border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Store Type *
                <Select
                  name="storeType"
                  defaultValue="ownstore"
                >
                  <option value="ownstore">Own Store</option>
                  <option value="franchise">Franchise</option>
                </Select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Address
                <input
                  name="address"
                  placeholder="Street address, city"
                  className="border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Phone
                <input
                  name="phone"
                  placeholder="Contact phone number"
                  className="border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowCreateStoreModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={createStorePending}
                >
                  Create Store
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* OVERVIEW MODAL 2: EDIT LOCATION */}
      {editingLocation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white p-6 shadow-xl border border-neutral-300">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Edit Location
            </h3>

            {editError ? (
              <p className="mb-3 bg-red-50 p-2.5 text-xs text-red-600 border border-red-200">
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
                  className="border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Address
                <input
                  name="address"
                  defaultValue={editingLocation.address ?? ''}
                  className="border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Phone
                <input
                  name="phone"
                  defaultValue={editingLocation.phone ?? ''}
                  className="border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setEditingLocation(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={editPending}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}
