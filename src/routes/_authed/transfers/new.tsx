import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import {
  createTransferFn,
  getLocationStockForTransferFn,
} from '../../../server/functions/transfers.ts'

export const Route = createFileRoute('/_authed/transfers/new')({
  loader: async () => {
    const locations = await listLocationsFn({
      data: { includeInactive: false },
    })
    return { locations }
  },
  component: NewTransferPage,
})

type StockItem = {
  id: string
  productId: string
  productName: string
  category: string
  measurementType: 'count' | 'weight' | 'volume'
  unit: string
  productImages: string[]
  variantId: string
  sku: string | null
  attributes: Record<string, string> | null
  variantImage: string | null
  quantity: string
  discountedPrice: string
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black'

function NewTransferPage() {
  const { locations } = Route.useLoaderData()
  const navigate = useNavigate()

  const createTransfer = useServerFn(createTransferFn)
  const getLocationStock = useServerFn(getLocationStockForTransferFn)

  // Filter eligible locations (active and non-damaged)
  const eligibleLocations = useMemo(
    () => locations.filter((l) => l.type !== 'damaged' && l.isActive),
    [locations],
  )

  const [sourceLocationId, setSourceLocationId] = useState<string>(
    eligibleLocations[0]?.id || '',
  )
  const [destinationLocationId, setDestinationLocationId] = useState<string>(
    eligibleLocations.find((l) => l.id !== eligibleLocations[0]?.id)?.id || '',
  )

  const [sourceStock, setSourceStock] = useState<StockItem[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedVariantId, setSelectedVariantId] = useState<string>('')
  const [transferQuantity, setTransferQuantity] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch stock whenever source location changes
  async function fetchStockForLocation(locId: string) {
    if (!locId) {
      setSourceStock([])
      return
    }
    setStockLoading(true)
    setError(null)
    try {
      const stock = await getLocationStock({ data: { locationId: locId } })
      setSourceStock(stock as StockItem[])

      // Auto-select first product if any available
      if (stock.length > 0) {
        const firstProdId = stock[0].productId
        setSelectedProductId(firstProdId)
        const variantsForFirst = stock.filter(
          (s) => s.productId === firstProdId,
        )
        setSelectedVariantId(variantsForFirst[0]?.variantId || '')
      } else {
        setSelectedProductId('')
        setSelectedVariantId('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock')
    } finally {
      setStockLoading(false)
    }
  }

  useEffect(() => {
    if (sourceLocationId) {
      fetchStockForLocation(sourceLocationId)
    }
  }, [sourceLocationId])

  // Products available in source location
  const availableProducts = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; category: string; images: string[] }
    >()
    for (const item of sourceStock) {
      if (!map.has(item.productId)) {
        map.set(item.productId, {
          id: item.productId,
          name: item.productName,
          category: item.category,
          images: item.productImages || [],
        })
      }
    }
    return Array.from(map.values())
  }, [sourceStock])

  // Variants available for selected product
  const availableVariants = useMemo(() => {
    if (!selectedProductId) return []
    return sourceStock.filter((s) => s.productId === selectedProductId)
  }, [sourceStock, selectedProductId])

  // Selected variant item
  const selectedVariantItem = useMemo(() => {
    return (
      availableVariants.find((v) => v.variantId === selectedVariantId) || null
    )
  }, [availableVariants, selectedVariantId])

  function handleProductChange(productId: string) {
    setSelectedProductId(productId)
    const vars = sourceStock.filter((s) => s.productId === productId)
    setSelectedVariantId(vars[0]?.variantId || '')
    setTransferQuantity('')
  }

  // Active cover / image of selected variant
  const selectedImage =
    selectedVariantItem?.variantImage ||
    selectedVariantItem?.productImages?.[0] ||
    null

  const availableQtyNum = selectedVariantItem
    ? Number(selectedVariantItem.quantity)
    : 0
  const transferQtyNum = Number(transferQuantity)
  const isOverStock =
    transferQuantity.trim() !== '' &&
    !isNaN(transferQtyNum) &&
    transferQtyNum > availableQtyNum

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!sourceLocationId || !destinationLocationId) {
      setError('Please select both source and destination locations')
      return
    }

    if (sourceLocationId === destinationLocationId) {
      setError('Source and destination locations must be different')
      return
    }

    if (!selectedVariantId || !selectedVariantItem) {
      setError('Please select a product variant to transfer')
      return
    }

    if (isNaN(transferQtyNum) || transferQtyNum <= 0) {
      setError('Please enter a valid positive transfer quantity')
      return
    }

    const isCount =
      selectedVariantItem.measurementType === 'count' ||
      selectedVariantItem.unit === 'piece'

    if (isCount && !Number.isInteger(transferQtyNum)) {
      setError(`Quantity for ${selectedVariantItem.unit} items must be a whole number`)
      return
    }

    if (isOverStock) {
      setError(
        `Transfer quantity exceeds available stock (${selectedVariantItem?.quantity} ${selectedVariantItem?.unit})`,
      )
      return
    }

    setPending(true)
    try {
      await createTransfer({
        data: {
          variantId: selectedVariantId,
          sourceLocationId,
          destinationLocationId,
          quantity: transferQuantity.trim(),
          notes: notes.trim() || undefined,
        },
      })
      await navigate({ to: '/transfers' })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to complete stock transfer',
      )
    } finally {
      setPending(false)
    }
  }

  const sourceLoc = eligibleLocations.find((l) => l.id === sourceLocationId)
  const destLoc = eligibleLocations.find((l) => l.id === destinationLocationId)

  return (
    <main className="mx-auto max-w-3xl p-6">
      {/* Top Header */}
      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            New Stock Transfer
          </h1>
          <p className="text-xs text-gray-500">
            Dispatch inventory between warehouses and retail stores with real-time stock verification.
          </p>
        </div>
        <Link
          to="/transfers"
          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Back to Transfers
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {/* Section 1: Route Setup */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 uppercase tracking-wide">
            1. Transfer Route
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-center">
            {/* Source Facility */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Source Location (Dispatching From) *
              </label>
              <select
                value={sourceLocationId}
                onChange={(e) => {
                  const newSource = e.target.value
                  setSourceLocationId(newSource)
                  if (newSource === destinationLocationId) {
                    const fallback =
                      eligibleLocations.find((l) => l.id !== newSource)?.id || ''
                    setDestinationLocationId(fallback)
                  }
                }}
                className={inputClass}
                required
              >
                {eligibleLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.type === 'warehouse' ? 'Warehouse' : l.storeType})
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Facility */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Destination Location (Receiving At) *
              </label>
              <select
                value={destinationLocationId}
                onChange={(e) => setDestinationLocationId(e.target.value)}
                className={inputClass}
                required
              >
                {eligibleLocations
                  .filter((l) => l.id !== sourceLocationId)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.type === 'warehouse' ? 'Warehouse' : l.storeType})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Visual Route Pill */}
          <div className="mt-4 flex items-center justify-center gap-3 rounded-md bg-gray-50 py-2.5 px-4 text-xs">
            <span className="font-semibold text-gray-800">
              {sourceLoc?.name ?? '—'}
            </span>
            <span className="font-bold text-blue-600">───►</span>
            <span className="font-semibold text-blue-700">
              {destLoc?.name ?? '—'}
            </span>
          </div>
        </section>

        {/* Section 2: Product & Variant Selection */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              2. Select Product & Variant
            </h2>
            {stockLoading && (
              <span className="text-xs text-gray-400 animate-pulse">
                Loading available stock...
              </span>
            )}
          </div>

          {sourceStock.length === 0 && !stockLoading ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-800">
              There is currently <strong>no active stock available</strong> at{' '}
              {sourceLoc?.name}. Please receive stock or select a different source location.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Product Selection */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Select Product *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className={inputClass}
                  required
                >
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Variant Selection */}
              {availableVariants.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Select Variant *
                  </label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => {
                      setSelectedVariantId(e.target.value)
                      setTransferQuantity('')
                    }}
                    className={inputClass}
                    required
                  >
                    {availableVariants.map((v) => {
                      const attrStr =
                        v.attributes && typeof v.attributes === 'object'
                          ? Object.entries(v.attributes)
                              .map(([k, val]) => `${k}: ${val}`)
                              .join(', ')
                          : ''
                      return (
                        <option key={v.variantId} value={v.variantId}>
                          {v.sku ? `SKU: ${v.sku}` : 'Default Variant'}
                          {attrStr ? ` (${attrStr})` : ''} — Balance:{' '}
                          {v.quantity} {v.unit}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}

              {/* Variant Card Preview */}
              {selectedVariantItem && (
                <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3.5">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white flex items-center justify-center">
                    {selectedImage ? (
                      <img
                        src={selectedImage}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <svg
                        className="h-6 w-6 text-gray-300"
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

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {selectedVariantItem.productName}
                    </p>
                    <p className="text-xs text-gray-500">
                      SKU: {selectedVariantItem.sku || 'Default'}
                      {selectedVariantItem.attributes &&
                        Object.keys(selectedVariantItem.attributes).length > 0 &&
                        ` · ${Object.entries(selectedVariantItem.attributes)
                          .map(([k, val]) => `${k}: ${val}`)
                          .join(', ')}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      Measurement: {selectedVariantItem.measurementType} (
                      {selectedVariantItem.unit})
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="block text-xs text-gray-500">Available</span>
                    <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
                      {selectedVariantItem.quantity} {selectedVariantItem.unit}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section 3: Quantity & Transfer Details */}
        {selectedVariantItem && (
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900 uppercase tracking-wide">
              3. Quantity & Transfer Details
            </h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Transfer Quantity ({selectedVariantItem.unit}) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step={
                      selectedVariantItem.measurementType === 'count' ||
                      selectedVariantItem.unit === 'piece'
                        ? '1'
                        : '0.001'
                    }
                    min={
                      selectedVariantItem.measurementType === 'count' ||
                      selectedVariantItem.unit === 'piece'
                        ? '1'
                        : '0.001'
                    }
                    max={selectedVariantItem.quantity}
                    value={transferQuantity}
                    onChange={(e) => setTransferQuantity(e.target.value)}
                    placeholder={
                      selectedVariantItem.measurementType === 'count' ||
                      selectedVariantItem.unit === 'piece'
                        ? 'e.g. 10'
                        : 'e.g. 10.500'
                    }
                    className={`${inputClass} pr-16 ${
                      isOverStock ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                    }`}
                    required
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-gray-500">
                    {selectedVariantItem.unit}
                  </span>
                </div>
                {isOverStock ? (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    Cannot transfer more than available balance ({selectedVariantItem.quantity}{' '}
                    {selectedVariantItem.unit}).
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Reference / Transfer Notes (optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Restock request, Seasonal relocation, Urgent transfer..."
                  className={inputClass}
                />
              </div>
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            to="/transfers"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={
              pending ||
              !selectedVariantItem ||
              !transferQuantity ||
              isOverStock ||
              sourceLocationId === destinationLocationId
            }
            className="rounded-md bg-black px-6 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {pending ? 'Dispatching Transfer...' : 'Confirm & Dispatch Transfer'}
          </button>
        </div>
      </form>
    </main>
  )
}

