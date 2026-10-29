import { useState, useMemo } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { cancelSaleFn, getSaleFn } from '../../../server/functions/sales.ts'
import { createReturnFn } from '../../../server/functions/returns.ts'

export const Route = createFileRoute('/_authed/sales/$saleId')({
  loader: async ({ params }) => {
    const sale = await getSaleFn({ data: { saleId: params.saleId } })
    if (!sale) {
      throw new Error(`Sale order not found`)
    }
    return { sale }
  },
  component: SaleDetailPage,
})

function SaleDetailPage() {
  const { sale } = Route.useLoaderData()
  const router = useRouter()
  const cancelSale = useServerFn(cancelSaleFn)
  const createReturn = useServerFn(createReturnFn)

  // Cancel Modal State
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelPending, setCancelPending] = useState(false)

  // Return Modal State
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({})
  const [returnPending, setReturnPending] = useState(false)

  const [error, setError] = useState<string | null>(null)

  // Calculate remaining returnable units for each item
  const returnableSummary = useMemo(() => {
    let totalReturnableItems = 0
    const itemsMap = new Map<
      string,
      {
        soldQty: number
        returnedQty: number
        maxReturnable: number
      }
    >()

    for (const item of sale.items) {
      const sold = Number(item.quantity)
      const returned = Number(item.returnedQuantity || '0')
      const max = Math.max(0, sold - returned)
      if (max > 0) totalReturnableItems++
      itemsMap.set(item.id, {
        soldQty: sold,
        returnedQty: returned,
        maxReturnable: max,
      })
    }

    return {
      totalReturnableItems,
      itemsMap,
    }
  }, [sale.items])

  // Total refund preview in return modal
  const returnRefundTotal = useMemo(() => {
    let sum = 0
    for (const item of sale.items) {
      const qty = Number(returnQuantities[item.id] || 0)
      if (qty > 0) {
        sum += qty * Number(item.unitPrice)
      }
    }
    return sum.toFixed(2)
  }, [returnQuantities, sale.items])

  async function handleConfirmCancel(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (cancelReason.trim().length < 3) {
      setError('Please provide a cancellation reason with at least 3 characters')
      return
    }

    try {
      setCancelPending(true)
      await cancelSale({
        data: {
          saleId: sale.id,
          reason: cancelReason.trim(),
        },
      })
      setShowCancelModal(false)
      await router.invalidate()
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel order')
      setCancelPending(false)
    }
  }

  async function handleConfirmReturn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (returnReason.trim().length < 3) {
      setError('Please provide a return reason with at least 3 characters')
      return
    }

    const itemsToReturn: Array<{ saleItemId: string; quantity: string }> = []
    for (const [saleItemId, qtyStr] of Object.entries(returnQuantities)) {
      const qtyNum = Number(qtyStr)
      if (!isNaN(qtyNum) && qtyNum > 0) {
        itemsToReturn.push({ saleItemId, quantity: qtyStr })
      }
    }

    if (itemsToReturn.length === 0) {
      setError('Please specify a return quantity greater than 0 for at least one item')
      return
    }

    for (const item of itemsToReturn) {
      const original = sale.items.find((si) => si.id === item.saleItemId)
      const isCount = original?.unit === 'piece'
      if (isCount && !Number.isInteger(Number(item.quantity))) {
        setError(
          `Quantity for ${original?.productName || 'item'} (${original?.unit || 'piece'}) must be a whole number`,
        )
        return
      }
    }

    try {
      setReturnPending(true)
      await createReturn({
        data: {
          saleId: sale.id,
          reason: returnReason.trim(),
          items: itemsToReturn,
        },
      })
      setShowReturnModal(false)
      setReturnQuantities({})
      setReturnReason('')
      await router.invalidate()
    } catch (err: any) {
      setError(err?.message || 'Failed to process customer return')
      setReturnPending(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Navigation & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono tracking-tight text-neutral-900">
                {sale.orderNumber}
              </h1>
              {sale.status === 'completed' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Completed
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                  Cancelled
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-500">
              Placed on{' '}
              {new Date(sale.createdAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sale.status === 'completed' && returnableSummary.totalReturnableItems > 0 && (
            <button
              onClick={() => {
                setError(null)
                setShowReturnModal(true)
              }}
              className="px-3.5 py-2 text-sm font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition shadow-xs"
            >
              Process Return
            </button>
          )}

          {sale.status === 'completed' && (
            <button
              onClick={() => {
                setError(null)
                setShowCancelModal(true)
              }}
              className="px-3.5 py-2 text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
            >
              Cancel Order
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition"
          >
            Print Receipt
          </button>
        </div>
      </div>

      {/* Cancellation Banner */}
      {sale.status === 'cancelled' && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm space-y-1">
          <div className="font-semibold flex items-center gap-2">
            <svg
              className="w-4 h-4 text-rose-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            This order has been cancelled and stock returned to inventory.
          </div>
          <div className="text-xs text-rose-700">
            <strong>Reason:</strong> {sale.cancellationReason || 'No reason provided'}
          </div>
          {sale.cancelledByUser && (
            <div className="text-xs text-rose-600">
              Cancelled by <strong>{sale.cancelledByUser.username}</strong> on{' '}
              {sale.cancelledAt
                ? new Date(sale.cancelledAt).toLocaleString()
                : 'N/A'}
            </div>
          )}
        </div>
      )}

      {/* Metadata Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Store Location
          </span>
          <div className="font-medium text-neutral-900">{sale.locationName}</div>
          <div className="text-xs text-neutral-500">Retail Sales Branch</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Customer Information
          </span>
          <div className="font-medium text-neutral-900">
            {sale.customerName || 'Walk-in Customer'}
          </div>
          {sale.customerPhone ? (
            <div className="text-xs text-neutral-500">{sale.customerPhone}</div>
          ) : (
            <div className="text-xs text-neutral-400 italic">No phone recorded</div>
          )}
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Cashier / Staff
          </span>
          <div className="font-medium text-neutral-900">
            {sale.seller?.username || 'Staff'}
          </div>
          <div className="text-xs text-neutral-500 capitalize">
            {sale.seller?.role || 'User'}
          </div>
        </div>
      </div>

      {sale.notes && (
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
            Order Notes
          </span>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">
            {sale.notes}
          </p>
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">
            Purchased Line Items
          </h2>
          <span className="text-xs text-neutral-500">
            {sale.items.length} items
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50/50 text-neutral-900 font-medium border-b border-neutral-200">
              <tr>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Attributes</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Purchased</th>
                <th className="py-3 px-4 text-right">Returned</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sale.items.map((item) => {
                const returnedNum = Number(item.returnedQuantity || '0')
                return (
                  <tr key={item.id}>
                    <td className="py-3.5 px-4 font-medium text-neutral-900">
                      <div>{item.productName}</div>
                      <div className="text-xs font-mono text-neutral-400">
                        {item.sku || 'N/A'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-neutral-500">
                      {item.attributes && Object.keys(item.attributes).length > 0
                        ? Object.entries(item.attributes)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right text-neutral-700">
                      ${Number(item.unitPrice).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-neutral-900">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {returnedNum > 0 ? (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          {item.returnedQuantity} {item.unit}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-neutral-900">
                      ${Number(item.subtotal).toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-neutral-200 bg-neutral-50 font-bold text-neutral-900">
              <tr>
                <td colSpan={5} className="py-3 px-4 text-right text-base">
                  Total Order Amount:
                </td>
                <td className="py-3 px-4 text-right text-lg text-neutral-900">
                  ${Number(sale.totalAmount).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Customer Returns Section */}
      {sale.returns && sale.returns.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-neutral-200 bg-amber-50/50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                Processed Customer Returns
              </h2>
              <p className="text-xs text-neutral-500">
                Restocked inventory and refund records issued for this sale.
              </p>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800">
              {sale.returns.length} return receipt{sale.returns.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="divide-y divide-neutral-100">
            {sale.returns.map((ret) => (
              <div
                key={ret.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-neutral-50/70 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-neutral-900">
                      {ret.returnNumber}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {new Date(ret.createdAt).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600 mt-1">
                    <strong>Reason:</strong> {ret.reason}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-neutral-500 block">
                    Refund Amount
                  </span>
                  <span className="font-bold text-base text-rose-600">
                    -${Number(ret.totalRefundAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-neutral-900">
              Cancel Order {sale.orderNumber}?
            </h3>
            <p className="text-sm text-neutral-600">
              Cancelling will reverse this sale, mark the order cancelled, and
              restore all quantities back to the stock at{' '}
              <strong>{sale.locationName}</strong>. This action cannot be undone.
            </p>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleConfirmCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Cancellation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  minLength={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Order placed by error..."
                  rows={3}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={cancelPending}
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
                >
                  Nevermind
                </button>
                <button
                  type="submit"
                  disabled={cancelPending || cancelReason.trim().length < 3}
                  className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition shadow-sm"
                >
                  {cancelPending ? 'Cancelling...' : 'Confirm Order Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Customer Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">
                Process Customer Return
              </h3>
              <p className="text-xs text-neutral-500">
                Select items to return for order {sale.orderNumber}. Restocked
                items will be added back to <strong>{sale.locationName}</strong>.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleConfirmReturn} className="space-y-4">
              <div className="space-y-3">
                {sale.items.map((item) => {
                  const summary = returnableSummary.itemsMap.get(item.id)
                  const maxReturnable = summary?.maxReturnable || 0
                  if (maxReturnable <= 0) return null

                  const currentInput = returnQuantities[item.id] || ''

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/60 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm text-neutral-900">
                          {item.productName}
                        </div>
                        <div className="text-xs text-neutral-500">
                          ${Number(item.unitPrice).toFixed(2)} each · Max
                          returnable:{' '}
                          <span className="font-semibold text-neutral-700">
                            {maxReturnable} {item.unit}
                          </span>
                        </div>
                      </div>

                      <div className="w-28">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max={maxReturnable}
                            step={item.unit === 'piece' ? '1' : '0.001'}
                            placeholder="0"
                            value={currentInput}
                            onChange={(e) => {
                              const val = e.target.value
                              setReturnQuantities((prev) => ({
                                ...prev,
                                [item.id]: val,
                              }))
                            }}
                            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-medium text-neutral-900 bg-white focus:outline-none focus:border-neutral-900"
                          />
                          <span className="absolute right-2 top-2 text-xs text-neutral-400">
                            {item.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Reason for Return <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  minLength={3}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Defective seam, wrong size requested by customer..."
                  rows={2}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
                <div>
                  <span className="text-xs text-neutral-500 block">
                    Total Refund
                  </span>
                  <span className="text-xl font-bold text-neutral-900">
                    ${returnRefundTotal}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={returnPending}
                    onClick={() => setShowReturnModal(false)}
                    className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      returnPending ||
                      Number(returnRefundTotal) <= 0 ||
                      returnReason.trim().length < 3
                    }
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition shadow-sm"
                  >
                    {returnPending ? 'Processing...' : 'Authorize Refund'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
