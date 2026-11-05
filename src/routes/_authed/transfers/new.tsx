import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Image as ImageIcon,
  Package,
  Plus,
} from 'lucide-react'
import { Button, LinkButton } from '../../../components/Button.tsx'
import { formatVariantInfo } from '../../../lib/display-formatters.tsx'
import { LocationSelect } from '../../../components/LocationSelect.tsx'
import { ProductSelect } from '../../../components/ProductSelect.tsx'
import { VariantSelect, type VariantSelectItem } from '../../../components/VariantSelect.tsx'
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

interface TransferItem {
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

  // Committed items in the transfer
  const [items, setItems] = useState<TransferItem[]>([])

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
      // Never auto-select variant or product beforehand
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

  function handleSourceLocationChange(newSource: string) {
    setSourceLocationId(newSource)
    if (newSource === destinationLocationId) {
      const fallback =
        eligibleLocations.find((l) => l.id !== newSource)?.id || ''
      setDestinationLocationId(fallback)
    }
    // Reset transfer items and draft on source change
    setItems([])
    setIsAdding(false)
    setEditingId(null)
    setDraft({ productId: '', variantId: '', quantity: '1' })
    setDraftError(null)
  }

  // Look up specific variant details from loaded source stock
  function getVariantInfo(variantId: string) {
    if (!variantId) return null
    const row = sourceStock.find((i) => i.variantId === variantId)
    if (!row) return null

    return {
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      attributes: (row.attributes as Record<string, string>) || null,
      unit: row.unit,
      measurementType: row.measurementType,
      image: row.variantImage || row.productImages?.[0] || null,
      availableStock: row.quantity,
    }
  }

  // Start adding a new item
  function handleOpenAdd() {
    setEditingId(null)
    setDraftError(null)
    setDraftVariantItem(null)
    setDraft({
      productId: '',
      variantId: '',
      quantity: '1',
    })
    setIsAdding(true)
    if (sourceLocationId) {
      fetchStockForLocation(sourceLocationId)
    }
  }

  // Start editing an existing item
  function handleOpenEdit(item: TransferItem) {
    setIsAdding(false)
    setEditingId(item.id)
    setDraftError(null)
    setDraftVariantItem(null)
    setDraft({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    })
    if (sourceLocationId) {
      fetchStockForLocation(sourceLocationId)
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
      setSourceStock((prev) => {
        const targetId = variantItem.variantId || variantItem.id
        const idx = prev.findIndex((i) => i.variantId === targetId)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = {
            ...updated[idx],
            quantity: variantItem.quantity ?? updated[idx].quantity,
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
            discountedPrice: variantItem.price || '0.00',
          },
        ]
      })
    }
  }

  const fallbackDraftInfo = getVariantInfo(draft.variantId)
  const draftInfo =
    draftVariantItem &&
    (draftVariantItem.variantId === draft.variantId ||
      draftVariantItem.id === draft.variantId)
      ? {
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
          availableStock:
            draftVariantItem.quantity ?? fallbackDraftInfo?.availableStock ?? '0',
        }
      : fallbackDraftInfo

  const isDraftCount =
    draftInfo?.measurementType === 'count' || draftInfo?.unit === 'piece'

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
      setDraftError('Selected variant is not available in source stock')
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

    // Total quantity check for this variant across the transfer (excluding currently editing row)
    const otherUsage = items
      .filter((i) => i.id !== editingId && i.variantId === draft.variantId)
      .reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)

    const totalNeeded = otherUsage + qtyNum
    const effectiveStock = draftVariantItem?.quantity ?? info.availableStock
    const available = Number(effectiveStock)
    if (totalNeeded > available) {
      setDraftError(
        `Quantity exceeds available stock (${effectiveStock} ${info.unit} in stock at source).`,
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

    if (items.length === 0) {
      setError('Please add at least one item to transfer')
      return
    }

    setPending(true)
    try {
      await createTransfer({
        data: {
          sourceLocationId,
          destinationLocationId,
          items: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
          })),
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

  // Render the Builder Row (2 sides, vertical within each side)
  function renderBuilderRow(mode: 'add' | 'edit') {
    return (
      <div className="bg-neutral-50/80 border border-neutral-300 p-4 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-neutral-900"></span>
            {mode === 'edit' ? 'Edit Transfer Item' : 'Configure New Transfer Item'}
          </span>
          {draftInfo && (
            <span className="text-xs text-neutral-600 font-normal">
              Available at Source:{' '}
              <strong className="text-emerald-700">
                {draftVariantItem?.quantity ?? draftInfo.availableStock} {draftInfo.unit}
              </strong>
            </span>
          )}
        </div>

        {/* 2 SIDES: Left = Product & Variant | Right = Quantity & Actions */}
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
                locationId={sourceLocationId}
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

          {/* RIGHT SIDE: Quantity & Actions (Vertical) */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Transfer Quantity {draftInfo ? `(${draftInfo.unit})` : ''} *
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

            {/* Available stock card info */}
            {draftInfo && (
              <div className="flex items-center justify-between px-3 py-2 bg-neutral-100/80 border border-neutral-200">
                <span className="text-xs text-neutral-600">Stock Balance:</span>
                <span className="text-xs font-bold text-neutral-900">
                  {draftVariantItem?.quantity ?? draftInfo.availableStock} {draftInfo.unit}
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={handleCancelDraft}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="xs"
                variant="primary"
                onClick={handleSaveDraft}
                disabled={
                  !draft.variantId ||
                  !draft.quantity ||
                  Number(draft.quantity) <= 0
                }
              >
                {mode === 'edit' ? 'Update Item' : 'Add Item'}
              </Button>
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
            to="/transfers"
            className="p-2 border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition"
            title="Back to Transfers"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              New Stock Transfer
            </h1>
            <p className="text-sm text-neutral-500">
              Dispatch inventory between warehouses and retail stores with real-time stock verification.
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
        {/* Step 1: Transfer Route */}
        <div className="bg-white p-5 border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
            <div>
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Step 1
              </span>
              <h2 className="text-base font-semibold text-neutral-900">
                Transfer Route
              </h2>
            </div>
            {sourceLoc && destLoc && (
              <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium bg-neutral-100 text-neutral-700">
                <span>{sourceLoc.name}</span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                <span>{destLoc.name}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                Source Location (Dispatching From) <span className="text-rose-500">*</span>
              </label>
              <LocationSelect
                value={sourceLocationId}
                onChange={handleSourceLocationChange}
                placeholder="Select source location"
                initialLocation={sourceLoc}
              />
              <div className="mt-1 text-xs text-neutral-500">
                {stockLoading
                  ? 'Loading source stock...'
                  : `${sourceStock.length} variant(s) currently in stock`}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                Destination Location (Receiving At) <span className="text-rose-500">*</span>
              </label>
              <LocationSelect
                value={destinationLocationId}
                onChange={(newDest) => setDestinationLocationId(newDest)}
                placeholder="Select destination location"
                initialLocation={destLoc}
              />
            </div>
          </div>
        </div>

        {/* Step 2: Transfer Items */}
        <div className="bg-white p-5 border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Step 2
              </span>
              <h2 className="text-base font-semibold text-neutral-900">
                Transfer Items ({items.length})
              </h2>
              <p className="text-xs text-neutral-500">
                Select products and variants available at {sourceLoc?.name || 'source location'}.
              </p>
            </div>
          </div>

          {sourceStock.length === 0 && !stockLoading ? (
            <div className="p-8 text-center border border-dashed border-amber-200 bg-amber-50/50">
              <Package className="w-8 h-8 mx-auto text-amber-500 mb-2" />
              <h3 className="text-sm font-semibold text-amber-900">
                No Stock Available at {sourceLoc?.name || 'Selected Location'}
              </h3>
              <p className="text-xs text-amber-700 mt-1 max-w-md mx-auto">
                There is currently no active in-stock inventory at this source facility. Please select another source location or receive stock first.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary table of committed transfer items */}
              {items.length > 0 && (
                <div className="overflow-x-auto border border-neutral-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-neutral-50 text-xs font-semibold text-neutral-600 uppercase">
                      <tr>
                        <th className="px-4 py-3">Product / Variant</th>
                        <th className="px-4 py-3">Available at Source</th>
                        <th className="px-4 py-3">Transfer Quantity</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {items.map((item) => {
                        const isThisEditing = editingId === item.id
                        if (isThisEditing) {
                          return (
                            <tr key={item.id}>
                              <td colSpan={4} className="p-2 bg-neutral-50/60">
                                {renderBuilderRow('edit')}
                              </td>
                            </tr>
                          )
                        }

                        const info = getVariantInfo(item.variantId)
                        const variantInfo = formatVariantInfo(info)

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

                            {/* Available at Source */}
                            <td className="px-4 py-3 font-medium text-neutral-600 whitespace-nowrap">
                              {info?.availableStock || '0.000'} {info?.unit || 'units'}
                            </td>

                            {/* Transfer Quantity */}
                            <td className="px-4 py-3 font-bold text-neutral-900 whitespace-nowrap">
                              {item.quantity}{' '}
                              <span className="text-xs font-normal text-neutral-500">
                                {info?.unit || 'unit'}
                              </span>
                            </td>

                            {/* Actions: Edit & Delete */}
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => handleOpenEdit(item)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="dangerSoft"
                                  onClick={() => handleRemoveItem(item.id)}
                                  title="Delete item"
                                >
                                  Delete
                                </Button>
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
                    No items added to this transfer yet.
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
                    Add Item to Transfer
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Reference / Transfer Notes */}
          <div className="pt-3 border-t border-neutral-100">
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
              Reference / Transfer Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Weekly store replenishment, Seasonal rebalance, Urgent restock..."
              className="w-full border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Transfer Summary & Submit Bar */}
        <div className="bg-white p-5 border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left w-full sm:w-auto">
            <span className="text-xs font-medium text-neutral-500 block">
              Total Transfer Items
            </span>
            <span className="text-2xl font-extrabold tracking-tight text-neutral-900">
              {items.length} {items.length === 1 ? 'line item' : 'line items'}
            </span>
          </div>

          <div className="flex gap-3 w-full sm:w-auto justify-end">
            <LinkButton
              to="/transfers"
              variant="secondary"
            >
              Cancel
            </LinkButton>
            <Button
              type="submit"
              disabled={
                items.length === 0 ||
                !sourceLocationId ||
                !destinationLocationId ||
                sourceLocationId === destinationLocationId ||
                isAdding ||
                editingId !== null
              }
              isLoading={pending}
            >
              Confirm & Dispatch Transfer
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
