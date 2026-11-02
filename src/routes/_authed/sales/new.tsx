import { useState, useMemo } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ArrowLeft, AlertCircle, Package, Plus, Image as ImageIcon } from 'lucide-react'
import { Button, LinkButton, SmallButton } from '../../../components/Button.tsx'
import { formatVariantInfo } from '../../../lib/display-formatters.tsx'
import { LocationSelect } from '../../../components/LocationSelect.tsx'
import { ProductSelect } from '../../../components/ProductSelect.tsx'
import { VariantSelect, type VariantSelectItem } from '../../../components/VariantSelect.tsx'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import {
  createSaleFn,
  getStoreInventoryForSaleFn,
} from '../../../server/functions/sales.ts'

export const Route = createFileRoute('/_authed/sales/new')({
  loader: async () => {
    const locations = await listLocationsFn({ data: { includeInactive: false } })
    const storeLocations = locations.filter((l) => l.type === 'store')
    const initialLocationId = storeLocations[0]?.id
    const initialInventory = initialLocationId
      ? await getStoreInventoryForSaleFn({ data: { locationId: initialLocationId } })
      : []

    return {
      locations: storeLocations,
      initialInventory,
    }
  },
  component: NewSalePage,
})

interface OrderItem {
  id: string
  productId: string
  variantId: string
  quantity: string
}

interface DraftState {
  productId: string
  variantId: string
  quantity: string
}

function NewSalePage() {
  const { locations, initialInventory } = Route.useLoaderData()
  const router = useRouter()
  const createSale = useServerFn(createSaleFn)
  const getStoreInventory = useServerFn(getStoreInventoryForSaleFn)

  const [locationId, setLocationId] = useState<string>(
    locations.length > 0 ? locations[0].id : '',
  )
  const [storeInventory, setStoreInventory] = useState(initialInventory)
  const [loadingInventory, setLoadingInventory] = useState(false)

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')

  // Committed items in the order
  const [items, setItems] = useState<OrderItem[]>([])

  // State for Add / Edit Row
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftState>({
    productId: '',
    variantId: '',
    quantity: '1',
  })
  const [draftVariantItem, setDraftVariantItem] = useState<VariantSelectItem | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch store inventory when location changes
  async function handleLocationChange(newLocId: string) {
    setLocationId(newLocId)
    setLoadingInventory(true)
    setError(null)
    setIsAdding(false)
    setEditingId(null)
    setDraftVariantItem(null)
    setItems([])
    try {
      const inv = await getStoreInventory({ data: { locationId: newLocId } })
      setStoreInventory(inv)
    } catch (err: any) {
      setError(err?.message || 'Failed to load inventory for selected store')
    } finally {
      setLoadingInventory(false)
    }
  }

  // Available unique products in stock at the selected store
  const availableProducts = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string
        name: string
        category: string
        unit: string
        measurementType: 'count' | 'weight' | 'volume'
        image: string | null
        totalQuantity: number
      }
    >()

    for (const row of storeInventory) {
      const existing = map.get(row.productId)
      const qty = Number(row.quantity) || 0
      if (existing) {
        existing.totalQuantity += qty
      } else {
        map.set(row.productId, {
          id: row.productId,
          name: row.productName,
          category: row.category,
          unit: row.unit,
          measurementType: row.measurementType,
          image: row.variantImage || row.productImages?.[0] || null,
          totalQuantity: qty,
        })
      }
    }

    return Array.from(map.values())
  }, [storeInventory])

  // Look up specific variant details
  function getVariantInfo(variantId: string) {
    if (!variantId) return null
    const row = storeInventory.find((i) => i.variantId === variantId)
    if (!row) return null

    return {
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      attributes: (row.attributes as Record<string, string>) || null,
      unit: row.unit,
      measurementType: row.measurementType,
      image: row.variantImage || row.productImages?.[0] || null,
      price: row.price || '0.00',
      availableStock: row.quantity,
    }
  }

  // Start adding a new item
  async function handleOpenAdd() {
    setEditingId(null)
    setDraftError(null)
    setDraftVariantItem(null)
    setDraft({
      productId: '',
      variantId: '',
      quantity: '1',
    })
    setIsAdding(true)
    if (locationId) {
      try {
        const inv = await getStoreInventory({ data: { locationId } })
        setStoreInventory(inv)
      } catch (err) {
        console.error('Failed to refresh store inventory:', err)
      }
    }
  }

  // Start editing an existing item
  async function handleOpenEdit(item: OrderItem) {
    setIsAdding(false)
    setEditingId(item.id)
    setDraftError(null)
    setDraft({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    })
    const existingInfo = getVariantInfo(item.variantId)
    if (existingInfo) {
      setDraftVariantItem({
        id: item.variantId,
        productId: existingInfo.productId,
        productName: existingInfo.productName,
        unit: existingInfo.unit,
        measurementType: existingInfo.measurementType,
        variantId: item.variantId,
        sku: existingInfo.sku,
        attributes: existingInfo.attributes,
        variantImage: existingInfo.image,
        quantity: existingInfo.availableStock,
        price: existingInfo.price,
      })
    } else {
      setDraftVariantItem(null)
    }
    if (locationId) {
      try {
        const inv = await getStoreInventory({ data: { locationId } })
        setStoreInventory(inv)
        const row = inv.find((i) => i.variantId === item.variantId)
        if (row) {
          setDraftVariantItem({
            id: row.id,
            productId: row.productId,
            productName: row.productName,
            category: row.category,
            measurementType: row.measurementType,
            unit: row.unit,
            productImages: row.productImages,
            variantId: row.variantId,
            sku: row.sku,
            attributes: row.attributes as Record<string, string>,
            variantImage: row.variantImage,
            quantity: row.quantity,
            price: row.price,
            regularPrice: row.regularPrice,
          })
        }
      } catch (err) {
        console.error('Failed to refresh store inventory:', err)
      }
    }
  }

  function handleCancelDraft() {
    setIsAdding(false)
    setEditingId(null)
    setDraftVariantItem(null)
    setDraftError(null)
  }

  function handleDraftProductChange(newProductId: string) {
    // Automatically reset variant selection to blank when product changes
    setDraft({
      productId: newProductId,
      variantId: '',
      quantity: '1',
    })
    setDraftVariantItem(null)
    setDraftError(null)
  }

  function handleDraftVariantChange(
    newVariantId: string,
    variantItem?: VariantSelectItem | null,
  ) {
    setDraft((prev) => ({
      ...prev,
      variantId: newVariantId,
      quantity: prev.variantId === newVariantId ? prev.quantity : '1',
    }))
    setDraftVariantItem(variantItem || null)
    setDraftError(null)

    if (variantItem) {
      setStoreInventory((prev) => {
        const targetId = variantItem.variantId || variantItem.id
        const idx = prev.findIndex((i) => i.variantId === targetId)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = {
            ...updated[idx],
            quantity: variantItem.quantity ?? updated[idx].quantity,
            price: variantItem.price ?? updated[idx].price,
            productName: variantItem.productName ?? updated[idx].productName,
            sku: variantItem.sku ?? updated[idx].sku,
            unit: variantItem.unit ?? updated[idx].unit,
            measurementType:
              variantItem.measurementType ?? updated[idx].measurementType,
          }
          return updated
        }
        return [
          ...prev,
          {
            id: variantItem.id,
            productId: variantItem.productId,
            productName: variantItem.productName || '',
            category: variantItem.category || '',
            measurementType: variantItem.measurementType || 'count',
            unit: variantItem.unit || 'piece',
            productImages: variantItem.productImages || [],
            variantId: targetId,
            sku: variantItem.sku || null,
            attributes: variantItem.attributes || {},
            variantImage: variantItem.variantImage || null,
            quantity: variantItem.quantity || '0',
            price: variantItem.price || '0.00',
            regularPrice: variantItem.regularPrice || null,
          },
        ]
      })
    }
  }

  // Save current draft (either insert new item or update existing)
  function handleSaveDraft() {
    setDraftError(null)

    if (!draft.productId) {
      setDraftError('Please choose a product')
      return
    }

    if (!draft.variantId) {
      setDraftError('Please choose a variant')
      return
    }

    const info = draftInfo || getVariantInfo(draft.variantId)
    if (!info) {
      setDraftError('Selected variant is not available in store stock')
      return
    }

    const qtyNum = Number(draft.quantity)
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setDraftError('Please enter a valid positive quantity')
      return
    }

    // Whole number validation for piece/count
    const isCount = info.measurementType === 'count' || info.unit === 'piece'
    if (isCount && !Number.isInteger(qtyNum)) {
      setDraftError(`Quantity for ${info.unit} items must be a whole number`)
      return
    }

    // Total quantity check for this variant across the order (excluding currently editing row)
    const otherUsage = items
      .filter((i) => i.id !== editingId && i.variantId === draft.variantId)
      .reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)

    const totalNeeded = otherUsage + qtyNum
    const effectiveStock = draftVariantItem?.quantity ?? info.availableStock
    const available = Number(effectiveStock)
    if (totalNeeded > available) {
      setDraftError(
        `Quantity exceeds available stock (${effectiveStock} ${info.unit} in stock).`,
      )
      return
    }

    if (editingId) {
      // Update existing item
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingId
            ? {
                ...i,
                productId: draft.productId,
                variantId: draft.variantId,
                quantity: draft.quantity.trim(),
              }
            : i,
        ),
      )
      setEditingId(null)
      setDraftVariantItem(null)
    } else {
      // Add new item to list
      setItems((prev) => [
        ...prev,
        {
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          productId: draft.productId,
          variantId: draft.variantId,
          quantity: draft.quantity.trim(),
        },
      ])
      setIsAdding(false)
      setDraftVariantItem(null)
    }
  }

  function handleRemoveItem(idToRemove: string) {
    setItems((prev) => prev.filter((i) => i.id !== idToRemove))
    if (editingId === idToRemove) {
      setEditingId(null)
    }
  }

  // Order summary calculations
  const orderSummary = useMemo(() => {
    let totalCents = 0n
    let totalItems = 0

    for (const item of items) {
      const info = getVariantInfo(item.variantId)
      if (!info) continue

      const qty = Number(item.quantity)
      if (isNaN(qty) || qty <= 0) continue

      totalItems += 1
      const price = Number(info.price)
      const subtotalCents = BigInt(Math.round(qty * price * 100))
      totalCents += subtotalCents
    }

    const totalAmount = (Number(totalCents) / 100).toFixed(2)
    return {
      totalAmount,
      totalItems,
    }
  }, [items, storeInventory])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!locationId) {
      setError('Please select a store location')
      return
    }

    if (items.length === 0) {
      setError('Please add at least one item to the order')
      return
    }

    try {
      setPending(true)
      const sale = await createSale({
        data: {
          locationId,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          items: items.map((i) => ({
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

  const selectedLocation = locations.find((l) => l.id === locationId)
  const fallbackDraftInfo = getVariantInfo(draft.variantId)
  const draftInfo = useMemo(() => {
    if (!draft.variantId) return null
    if (
      draftVariantItem &&
      (draftVariantItem.variantId === draft.variantId ||
        draftVariantItem.id === draft.variantId)
    ) {
      return {
        productId: draftVariantItem.productId,
        productName:
          draftVariantItem.productName || fallbackDraftInfo?.productName || '',
        sku: draftVariantItem.sku ?? fallbackDraftInfo?.sku ?? null,
        attributes:
          draftVariantItem.attributes || fallbackDraftInfo?.attributes || null,
        unit: draftVariantItem.unit || fallbackDraftInfo?.unit || 'piece',
        measurementType:
          draftVariantItem.measurementType ||
          fallbackDraftInfo?.measurementType ||
          'count',
        image:
          draftVariantItem.variantImage ||
          draftVariantItem.image ||
          draftVariantItem.productImages?.[0] ||
          fallbackDraftInfo?.image ||
          null,
        price: draftVariantItem.price || fallbackDraftInfo?.price || '0.00',
        availableStock:
          draftVariantItem.quantity ?? fallbackDraftInfo?.availableStock ?? '0',
      }
    }
    return fallbackDraftInfo
  }, [draft.variantId, draftVariantItem, fallbackDraftInfo])

  const isDraftCount =
    draftInfo?.measurementType === 'count' || draftInfo?.unit === 'piece'

  const draftNumQty = Number(draft.quantity)
  const draftSubtotal =
    draftInfo && !isNaN(draftNumQty) && draftNumQty > 0
      ? (draftNumQty * Number(draftInfo.price)).toFixed(2)
      : '0.00'

  // Component rendering the 2-sided Add / Edit Builder Row
  const renderBuilderRow = (mode: 'add' | 'edit') => {
    return (
      <div className="p-4 border-2 border-neutral-800 bg-neutral-50/90 shadow-sm space-y-3 animate-in fade-in duration-150">
        <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-neutral-800 font-semibold">
            <span className="w-2 h-2 bg-neutral-900"></span>
            {mode === 'edit' ? 'Edit Item' : 'Configure New Item'}
          </span>
          {draftInfo && (
            <span className="text-xs text-neutral-600 font-normal">
              Available at Store:{' '}
              <strong className="text-emerald-700">
                {draftVariantItem?.quantity ?? draftInfo.availableStock} {draftInfo.unit}
              </strong>
            </span>
          )}
        </div>

        {/* 2 SIDES: Left = Product Name & Variant | Right = Quantity, Price, Subtotal & Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pt-1">
          {/* LEFT SIDE: Product & Variant (Vertical) */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Product Name *
              </label>
              <ProductSelect
                value={draft.productId}
                onChange={(val) => handleDraftProductChange(val)}
                placeholder="-- Choose Product --"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Variant *
              </label>
              <VariantSelect
                locationId={locationId}
                productId={draft.productId}
                value={draft.variantId}
                onChange={(newVariantId, variantItem) =>
                  handleDraftVariantChange(newVariantId, variantItem)
                }
                placeholder={
                  !draft.productId
                    ? '-- Select Product First --'
                    : '-- Choose Variant --'
                }
                disabled={!draft.productId}
                initialVariant={draftVariantItem}
              />
            </div>
          </div>

          {/* RIGHT SIDE: Quantity, Price/Subtotal & Actions (Vertical) */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Quantity {draftInfo ? `(${draftInfo.unit})` : ''} *
              </label>
              <input
                type="number"
                step={isDraftCount ? '1' : '0.001'}
                min={isDraftCount ? '1' : '0.001'}
                max={draftVariantItem?.quantity ?? draftInfo?.availableStock ?? undefined}
                value={draft.quantity}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, quantity: e.target.value }))
                }
                disabled={!draft.variantId}
                className="w-full border border-neutral-300 px-3 py-2 text-sm font-medium focus:outline-none focus:border-neutral-900 bg-white text-neutral-900 disabled:opacity-50"
              />
            </div>

            {/* Price & Subtotal */}
            <div className="flex items-center justify-between px-3 py-2 bg-neutral-100/80 border border-neutral-200">
              <div className="text-xs text-neutral-500">
                Unit Price:{' '}
                <span className="font-semibold text-neutral-800">
                  ${draftInfo ? Number(draftInfo.price).toFixed(2) : '0.00'}
                </span>
              </div>
              <div className="text-sm font-bold text-neutral-900">
                Subtotal: ${draftSubtotal}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <SmallButton
                type="button"
                variant="outline"
                onClick={handleCancelDraft}
              >
                Cancel
              </SmallButton>
              <SmallButton
                type="button"
                variant="primary"
                onClick={handleSaveDraft}
                disabled={!draft.variantId || !draft.quantity || Number(draft.quantity) <= 0}
              >
                {mode === 'edit' ? 'Update Item' : 'Add Item'}
              </SmallButton>
            </div>
          </div>
        </div>

        {draftError && (
          <p className="text-xs font-medium text-rose-600 bg-rose-50 p-2.5 border border-rose-200">
            {draftError}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/sales"
            className="p-2 border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition"
            title="Back to Sales"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              New Point-of-Sale Order
            </h1>
            <p className="text-sm text-neutral-500">
              Select store location, add items to the order, and record customer purchase.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
          <div className="font-medium">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Store Location & Customer Information */}
        <div className="bg-white p-5 border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
            <div>
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Step 1
              </span>
              <h2 className="text-base font-semibold text-neutral-900">
                Store Location & Customer Info
              </h2>
            </div>
            {selectedLocation && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-neutral-100 text-neutral-700">
                <span className="w-2 h-2 bg-emerald-500"></span>
                {selectedLocation.storeType === 'ownstore' ? 'Company Store' : 'Franchise Store'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                Sale Store Location <span className="text-rose-500">*</span>
              </label>
              <LocationSelect
                value={locationId}
                type="store"
                onChange={(newLocId) => handleLocationChange(newLocId)}
                placeholder="-- Select Store Location --"
                initialLocation={selectedLocation}
              />
              <div className="mt-1 text-xs text-neutral-500">
                {loadingInventory
                  ? 'Loading inventory...'
                  : `${availableProducts.length} product(s) in stock`}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                Customer Name (Optional)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                Customer Phone (Optional)
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. +1 555-0199"
                className="w-full border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Order Items */}
        <div className="bg-white p-5 border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Step 2
              </span>
              <h2 className="text-base font-semibold text-neutral-900">
                Order Items ({items.length})
              </h2>
              <p className="text-xs text-neutral-500">
                Pick products and variants available at {selectedLocation?.name || 'this store'}.
              </p>
            </div>
          </div>

          {availableProducts.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-amber-200 bg-amber-50/50">
              <Package className="w-8 h-8 mx-auto text-amber-500 mb-2" />
              <h3 className="text-sm font-semibold text-amber-900">
                No Stock Available at {selectedLocation?.name || 'This Location'}
              </h3>
              <p className="text-xs text-amber-700 mt-1 max-w-md mx-auto">
                There are currently no active in-stock products at this store. Please receive stock or transfer items from the Main Warehouse first.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary table of committed items */}
              {items.length > 0 && (
                <div className="overflow-x-auto border border-neutral-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-neutral-50 text-xs font-semibold text-neutral-600 uppercase">
                      <tr>
                        <th className="px-4 py-3">Product / Variant</th>
                        <th className="px-4 py-3">Unit Price</th>
                        <th className="px-4 py-3">Quantity</th>
                        <th className="px-4 py-3">Subtotal</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {items.map((item) => {
                        const isThisEditing = editingId === item.id
                        if (isThisEditing) {
                          return (
                            <tr key={item.id}>
                              <td colSpan={5} className="p-2 bg-neutral-50/60">
                                {renderBuilderRow('edit')}
                              </td>
                            </tr>
                          )
                        }

                        const info = getVariantInfo(item.variantId)
                        const variantInfo = formatVariantInfo(info)
                        const numQty = Number(item.quantity)
                        const subtotal =
                          info && !isNaN(numQty)
                            ? (numQty * Number(info.price)).toFixed(2)
                            : '0.00'

                        return (
                          <tr key={item.id} className="hover:bg-neutral-50/50">
                            {/* Product & Variant with Thumbnail */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 border border-neutral-200 bg-white flex-shrink-0 flex items-center justify-center overflow-hidden">
                                  {info?.image ? (
                                    <img
                                      src={info.image}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        ;(e.target as HTMLImageElement).src =
                                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                                      }}
                                    />
                                  ) : (
                                    <ImageIcon className="w-5 h-5 text-neutral-300" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-semibold text-neutral-900">
                                    {info?.productName || 'Unknown Product'}
                                  </div>
                                  <div className="text-xs font-medium text-neutral-700">
                                    {variantInfo.title}
                                  </div>
                                  {variantInfo.subtitle && (
                                    <div className="text-xs font-mono text-neutral-400">
                                      {variantInfo.subtitle}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Unit Price */}
                            <td className="px-4 py-3 font-medium text-neutral-700 whitespace-nowrap">
                              ${info ? Number(info.price).toFixed(2) : '0.00'}
                            </td>

                            {/* Quantity */}
                            <td className="px-4 py-3 font-bold text-neutral-900 whitespace-nowrap">
                              {item.quantity}{' '}
                              <span className="text-xs font-normal text-neutral-500">
                                {info?.unit || 'unit'}
                              </span>
                            </td>

                            {/* Subtotal */}
                            <td className="px-4 py-3 font-bold text-neutral-900 whitespace-nowrap">
                              ${subtotal}
                            </td>

                            {/* Actions: Edit & Delete */}
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <SmallButton
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleOpenEdit(item)}
                                >
                                  Edit
                                </SmallButton>
                                <SmallButton
                                  type="button"
                                  variant="danger"
                                  onClick={() => handleRemoveItem(item.id)}
                                  title="Delete item"
                                >
                                  Delete
                                </SmallButton>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Empty state when 0 items added yet and not adding */}
              {items.length === 0 && !isAdding && (
                <div className="py-8 text-center border border-dashed border-neutral-300 bg-neutral-50/50">
                  <p className="text-sm text-neutral-500">
                    No items added to this order yet.
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Click the button below to add your first product.
                  </p>
                </div>
              )}

              {/* Add Builder Row if isAdding is active */}
              {isAdding && renderBuilderRow('add')}

              {/* Add Item Button AT THE END OF THE LIST */}
              {!isAdding && !editingId && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleOpenAdd}
                    leftIcon={<Plus className="w-4 h-4 text-neutral-500" />}
                    className="w-full sm:w-auto"
                  >
                    Add Item to Order
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Order Notes */}
          <div className="pt-3 border-t border-neutral-100">
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
              Order Notes / Payment Remarks (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Paid in cash, customer requested receipt by SMS, etc."
              className="w-full border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Order Summary & Submit Bar */}
        <div className="bg-white p-5 border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left w-full sm:w-auto">
            <span className="text-xs font-medium text-neutral-500 block">
              Total Due ({orderSummary.totalItems} item{orderSummary.totalItems === 1 ? '' : 's'})
            </span>
            <span className="text-3xl font-extrabold tracking-tight text-neutral-900">
              ${orderSummary.totalAmount}
            </span>
          </div>

          <div className="flex gap-3 w-full sm:w-auto justify-end">
            <LinkButton
              to="/sales"
              variant="secondary"
            >
              Cancel
            </LinkButton>
            <Button
              type="submit"
              disabled={
                items.length === 0 ||
                !locationId ||
                isAdding ||
                editingId !== null
              }
              isLoading={pending}
            >
              Complete & Record Sale
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
