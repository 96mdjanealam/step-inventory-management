import { useState, useMemo } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import { listInventoryFn } from '../../../server/functions/inventory.ts'
import { createSaleFn } from '../../../server/functions/sales.ts'

export const Route = createFileRoute('/_authed/sales/new')({
  loader: async () => {
    const [locations, inventoryData] = await Promise.all([
      listLocationsFn({ data: { includeInactive: false } }),
      listInventoryFn({ data: { pageSize: 100 } }),
    ])
    return {
      locations: locations.filter((l) => l.type === 'store'),
      inventory: inventoryData.items,
    }
  },
  component: NewSalePage,
})

interface LineItem {
  variantId: string
  quantity: string
}

function NewSalePage() {
  const { locations, inventory } = Route.useLoaderData()
  const router = useRouter()
  const createSale = useServerFn(createSaleFn)

  const [locationId, setLocationId] = useState<string>(
    locations.length > 0 ? locations[0].id : '',
  )
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')

  const [items, setItems] = useState<LineItem[]>([
    { variantId: '', quantity: '1' },
  ])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Items in inventory at selected store
  const storeInventory = useMemo(() => {
    return inventory.filter((item) => item.locationId === locationId)
  }, [inventory, locationId])

  function getAvailableStock(variantId: string): string {
    const row = storeInventory.find((i) => i.variantId === variantId)
    return row ? row.quantity : '0.000'
  }

  function getVariantInfo(variantId: string) {
    const row = storeInventory.find((i) => i.variantId === variantId)
    if (!row) return null
    return {
      productName: row.product.name,
      sku: row.variant.sku,
      unit: row.product.unit,
      measurementType: row.product.measurementType,
      price: row.variant.discountedPrice || '0.00',
    }
  }

  function handleAddItem() {
    setItems((prev) => [...prev, { variantId: '', quantity: '1' }])
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleItemChange(
    index: number,
    field: keyof LineItem,
    value: string,
  ) {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  // Calculate totals
  const orderSummary = useMemo(() => {
    let totalCents = 0n
    let hasStockError = false

    for (const item of items) {
      if (!item.variantId) continue
      const info = getVariantInfo(item.variantId)
      if (!info) continue

      const qty = Number(item.quantity)
      if (isNaN(qty) || qty <= 0) continue

      const available = Number(getAvailableStock(item.variantId))
      if (qty > available) {
        hasStockError = true
      }

      const price = Number(info.price)
      const subtotalCents = BigInt(Math.round(qty * price * 100))
      totalCents += subtotalCents
    }

    const totalAmount = (Number(totalCents) / 100).toFixed(2)
    return {
      totalAmount,
      hasStockError,
    }
  }, [items, storeInventory])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!locationId) {
      setError('Please select a store location')
      return
    }

    const validItems = items.filter((i) => i.variantId && Number(i.quantity) > 0)
    if (validItems.length === 0) {
      setError('Please add at least one item with a valid quantity')
      return
    }

    if (orderSummary.hasStockError) {
      setError('One or more items exceed the available stock at this store')
      return
    }

    for (const item of validItems) {
      const info = getVariantInfo(item.variantId)
      const isCount = info?.measurementType === 'count' || info?.unit === 'piece'
      if (isCount && !Number.isInteger(Number(item.quantity))) {
        setError(
          `Quantity for ${info?.productName || 'item'} (${info?.unit || 'piece'}) must be a whole number`,
        )
        return
      }
    }

    try {
      setPending(true)
      const sale = await createSale({
        data: {
          locationId,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          items: validItems.map((i) => ({
            variantId: i.variantId,
            quantity: String(i.quantity),
          })),
          notes: notes.trim() || undefined,
        },
      })

      router.navigate({
        to: '/sales/$saleId',
        params: { saleId: sale.id },
      })
    } catch (err: any) {
      setError(err?.message || 'Failed to complete sale')
      setPending(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/sales"
            className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              New Point-of-Sale Order
            </h1>
            <p className="text-sm text-neutral-500">
              Record a customer purchase and immediately decrement store stock.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
          <svg
            className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Store & Customer Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
              Store Location <span className="text-rose-500">*</span>
            </label>
            <select
              value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value)
                setItems([{ variantId: '', quantity: '1' }])
              }}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none bg-white font-medium text-neutral-800"
              required
            >
              {locations.length === 0 ? (
                <option value="">No active store locations available</option>
              ) : (
                locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.storeType === 'ownstore' ? 'Own Store' : 'Franchise'})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Jane Doe (optional)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
              Customer Phone
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. +1 555-0199 (optional)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">
                Order Items
              </h2>
              <p className="text-xs text-neutral-500">
                Select items from available store stock.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-lg transition"
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
              Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => {
              const info = getVariantInfo(item.variantId)
              const availableStock = getAvailableStock(item.variantId)
              const numQty = Number(item.quantity)
              const numStock = Number(availableStock)
              const isOverStock =
                item.variantId !== '' && numQty > numStock && !isNaN(numQty)
              const lineSubtotal =
                info && !isNaN(numQty) && numQty > 0
                  ? (numQty * Number(info.price)).toFixed(2)
                  : '0.00'

              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-lg border ${
                    isOverStock
                      ? 'border-rose-300 bg-rose-50/40'
                      : 'border-neutral-200 bg-neutral-50/50'
                  } flex flex-col md:flex-row items-start md:items-center gap-3`}
                >
                  <div className="flex-1 w-full">
                    <label className="block text-xs text-neutral-500 mb-1">
                      Select Item in Stock
                    </label>
                    <select
                      value={item.variantId}
                      onChange={(e) =>
                        handleItemChange(idx, 'variantId', e.target.value)
                      }
                      className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-neutral-900 font-medium text-neutral-800"
                      required
                    >
                      <option value="">-- Choose In-Stock Variant --</option>
                      {storeInventory.map((row) => (
                        <option key={row.variantId} value={row.variantId}>
                          {row.product.name} ({row.variant.sku || 'No SKU'}) — ${Number(row.variant.discountedPrice).toFixed(2)} [In Stock: {row.quantity} {row.product.unit}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full md:w-36">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-neutral-500">
                        Quantity
                      </label>
                      {info && (
                        <span
                          className={`text-xs ${
                            isOverStock
                              ? 'text-rose-600 font-semibold'
                              : 'text-neutral-500'
                          }`}
                        >
                          Max: {availableStock}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step={
                          info?.measurementType === 'count' ||
                          info?.unit === 'piece'
                            ? '1'
                            : '0.001'
                        }
                        min={
                          info?.measurementType === 'count' ||
                          info?.unit === 'piece'
                            ? '1'
                            : '0.001'
                        }
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(idx, 'quantity', e.target.value)
                        }
                        className={`w-full rounded-md border ${
                          isOverStock
                            ? 'border-rose-500 bg-white text-rose-900'
                            : 'border-neutral-300 bg-white'
                        } px-2.5 py-1.5 text-sm font-medium focus:outline-none focus:border-neutral-900`}
                        required
                      />
                      {info && (
                        <span className="absolute right-2.5 top-2 text-xs text-neutral-400">
                          {info.unit}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full md:w-28 text-left md:text-right">
                    <div className="text-xs text-neutral-500 mb-1">Subtotal</div>
                    <div className="text-sm font-semibold text-neutral-900 py-1.5">
                      ${lineSubtotal}
                    </div>
                  </div>

                  <div className="pt-2 md:pt-4">
                    <button
                      type="button"
                      disabled={items.length === 1}
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove item"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
              Order Notes / Comments
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any special remarks or payment notes..."
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Order Summary & Submit Button */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left w-full sm:w-auto">
            <span className="text-sm text-neutral-500 block">Total Due</span>
            <span className="text-3xl font-bold tracking-tight text-neutral-900">
              ${orderSummary.totalAmount}
            </span>
          </div>

          <div className="flex gap-3 w-full sm:w-auto justify-end">
            <Link
              to="/sales"
              className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={
                pending ||
                orderSummary.hasStockError ||
                !locationId ||
                items.filter((i) => i.variantId && Number(i.quantity) > 0)
                  .length === 0
              }
              className="px-6 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              {pending ? 'Processing Order...' : 'Complete & Record Sale'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
