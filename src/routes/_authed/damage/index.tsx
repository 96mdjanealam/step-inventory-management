import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import { listInventoryFn } from '../../../server/functions/inventory.ts'
import {
  listDamageReportsFn,
  reportDamageFn,
  resolveDamageFn,
} from '../../../server/functions/damage.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  locationId: z.string().uuid().optional().catch(undefined),
  status: z
    .enum(['quarantined', 'repaired', 'disposed'])
    .optional()
    .catch(undefined),
  search: z.string().trim().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/damage/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    locationId: search.locationId,
    status: search.status,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    const [reportsData, locations, inventoryData] = await Promise.all([
      listDamageReportsFn({
        data: {
          page: deps.page,
          locationId: deps.locationId,
          status: deps.status,
          search: deps.search,
        },
      }),
      listLocationsFn({ data: { includeInactive: false } }),
      listInventoryFn({ data: { pageSize: 100 } }),
    ])
    return { ...reportsData, locations, inventory: inventoryData.items }
  },
  component: DamageReportsPage,
})

function DamageReportsPage() {
  const { damageReports, total, page, pageSize, locations, inventory } =
    Route.useLoaderData()
  const { search, locationId, status } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()

  const reportDamage = useServerFn(reportDamageFn)
  const resolveDamage = useServerFn(resolveDamageFn)

  // Report Modal State
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportSourceId, setReportSourceId] = useState('')
  const [reportVariantId, setReportVariantId] = useState('')
  const [reportQuantity, setReportQuantity] = useState('1')
  const [reportReason, setReportReason] = useState('')
  const [reportPending, setReportPending] = useState(false)

  // Resolve Modal State
  const [resolvingReport, setResolvingReport] = useState<(typeof damageReports)[0] | null>(null)
  const [resolveAction, setResolveAction] = useState<'repair' | 'disposal'>('repair')
  const [resolveLocationId, setResolveLocationId] = useState('')
  const [resolveNotes, setResolveNotes] = useState('')
  const [resolvePending, setResolvePending] = useState(false)

  const [modalError, setModalError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const sellableLocations = locations.filter((l) => l.type !== 'damaged')
  const damagedStockLocation = locations.find((l) => l.type === 'damaged')

  // Stock at selected source location for report modal
  const sourceStockItems = inventory.filter(
    (i) => i.locationId === reportSourceId && Number(i.quantity) > 0,
  )
  const selectedSourceItem = sourceStockItems.find(
    (i) => i.variantId === reportVariantId,
  )

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const query = String(new FormData(form).get('search') ?? '').trim()
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: query || undefined,
      }),
    })
  }

  function handleLocationFilter(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        locationId: val || undefined,
      }),
    })
  }

  function handleStatusFilter(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as 'quarantined' | 'repaired' | 'disposed' | ''
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        status: val || undefined,
      }),
    })
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault()
    setModalError(null)

    if (!reportSourceId) {
      setModalError('Please select a source location')
      return
    }
    if (!reportVariantId) {
      setModalError('Please select a product variant to quarantine')
      return
    }
    if (Number(reportQuantity) <= 0) {
      setModalError('Quantity must be greater than 0')
      return
    }
    if (selectedSourceItem && Number(reportQuantity) > Number(selectedSourceItem.quantity)) {
      setModalError(
        `Quantity cannot exceed available stock (${selectedSourceItem.quantity} ${selectedSourceItem.product.unit})`,
      )
      return
    }
    if (reportReason.trim().length < 3) {
      setModalError('Please provide a damage reason with at least 3 characters')
      return
    }

    try {
      setReportPending(true)
      await reportDamage({
        data: {
          sourceLocationId: reportSourceId,
          variantId: reportVariantId,
          quantity: reportQuantity,
          reason: reportReason.trim(),
        },
      })
      setShowReportModal(false)
      setReportSourceId('')
      setReportVariantId('')
      setReportQuantity('1')
      setReportReason('')
      await router.invalidate()
    } catch (err: any) {
      setModalError(err?.message || 'Failed to report damaged stock')
      setReportPending(false)
    }
  }

  async function handleSubmitResolve(e: React.FormEvent) {
    e.preventDefault()
    setModalError(null)

    if (!resolvingReport) return

    if (resolveAction === 'repair' && !resolveLocationId) {
      setModalError('Please select a target restock location for repaired merchandise')
      return
    }

    if (resolveNotes.trim().length < 3) {
      setModalError('Please provide resolution notes with at least 3 characters')
      return
    }

    try {
      setResolvePending(true)
      await resolveDamage({
        data: {
          damageReportId: resolvingReport.id,
          action: resolveAction,
          resolutionLocationId:
            resolveAction === 'repair' ? resolveLocationId : undefined,
          notes: resolveNotes.trim(),
        },
      })
      setResolvingReport(null)
      setResolveNotes('')
      setResolveLocationId('')
      await router.invalidate()
    } catch (err: any) {
      setModalError(err?.message || 'Failed to resolve damaged stock report')
      setResolvePending(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Damaged Stock & Quarantines
          </h1>
          <p className="text-sm text-neutral-500">
            Quarantine damaged merchandise into Central Damaged Stock, repair
            units back to sellable inventory, or permanently dispose of write-offs.
          </p>
        </div>

        <button
          onClick={() => {
            setModalError(null)
            if (sellableLocations.length > 0) {
              setReportSourceId(sellableLocations[0].id)
            }
            setShowReportModal(true)
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition shadow-sm"
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
          + Report Damaged Stock
        </button>
      </div>

      {/* Damaged Stock Banner */}
      {damagedStockLocation && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-amber-900 text-sm">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-amber-100 text-amber-700">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </span>
            <div>
              <div className="font-semibold">Central Damaged Stock Facility</div>
              <div className="text-xs text-amber-700">
                All quarantined stock is isolated at <strong>{damagedStockLocation.name}</strong> until repaired or disposed.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            name="search"
            defaultValue={search || ''}
            placeholder="Search damage #, product name, SKU, or reason..."
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium transition"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() =>
                navigate({
                  search: (prev) => ({ ...prev, search: undefined, page: 1 }),
                })
              }
              className="px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-900"
            >
              Clear
            </button>
          )}
        </form>

        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={locationId || ''}
            onChange={handleLocationFilter}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none bg-white text-neutral-700"
          >
            <option value="">All Source Locations</option>
            {sellableLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.type === 'warehouse' ? 'Warehouse' : 'Store'})
              </option>
            ))}
          </select>

          <select
            value={status || ''}
            onChange={handleStatusFilter}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none bg-white text-neutral-700"
          >
            <option value="">All Statuses</option>
            <option value="quarantined">Quarantined</option>
            <option value="repaired">Repaired</option>
            <option value="disposed">Disposed</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50 text-neutral-900 font-semibold border-b border-neutral-200">
              <tr>
                <th className="py-3 px-4">Damage #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Source Location</th>
                <th className="py-3 px-4">Product & SKU</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {damageReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    No damage reports found matching your criteria.
                  </td>
                </tr>
              ) : (
                damageReports.map((report) => (
                  <tr key={report.id} className="hover:bg-neutral-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-medium text-neutral-900">
                      {report.damageNumber}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-500 whitespace-nowrap">
                      {new Date(report.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-neutral-900">
                      {report.sourceLocationName}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-900">
                      <div>{report.productName}</div>
                      <div className="text-xs font-mono text-neutral-400">
                        {report.sku || 'No SKU'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-neutral-900">
                      {report.quantity} {report.unit}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-700 max-w-xs truncate" title={report.reason}>
                      {report.reason}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {report.status === 'quarantined' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Quarantined
                        </span>
                      )}
                      {report.status === 'repaired' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Repaired
                        </span>
                      )}
                      {report.status === 'disposed' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                          Disposed
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {report.status === 'quarantined' ? (
                        <button
                          onClick={() => {
                            setModalError(null)
                            setResolvingReport(report)
                            setResolveAction('repair')
                            setResolveLocationId(report.sourceLocationId)
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition"
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400" title={report.resolutionNotes || ''}>
                          Resolved
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 bg-neutral-50 text-sm">
            <span className="text-neutral-500">
              Showing page <span className="font-medium">{page}</span> of{' '}
              <span className="font-medium">{totalPages}</span> ({total} reports)
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      page: Math.max(1, page - 1),
                    }),
                  })
                }
                className="px-3 py-1 rounded border border-neutral-300 bg-white text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium hover:bg-neutral-100"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() =>
                  navigate({
                    search: (prev) => ({ ...prev, page: page + 1 }),
                  })
                }
                className="px-3 py-1 rounded border border-neutral-300 bg-white text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium hover:bg-neutral-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Damage Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">
                Report Damaged Stock
              </h3>
              <p className="text-xs text-neutral-500">
                Move defective or damaged units out of sellable inventory into
                Central Damaged Stock.
              </p>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Source Location <span className="text-rose-500">*</span>
                </label>
                <select
                  value={reportSourceId}
                  onChange={(e) => {
                    setReportSourceId(e.target.value)
                    setReportVariantId('')
                  }}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none bg-white font-medium text-neutral-800"
                  required
                >
                  <option value="">-- Choose Location --</option>
                  {sellableLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type === 'warehouse' ? 'Warehouse' : 'Store'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Product Variant <span className="text-rose-500">*</span>
                </label>
                <select
                  value={reportVariantId}
                  onChange={(e) => setReportVariantId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none bg-white font-medium text-neutral-800"
                  required
                  disabled={!reportSourceId}
                >
                  <option value="">-- Choose In-Stock Variant --</option>
                  {sourceStockItems.map((item) => (
                    <option key={item.variantId} value={item.variantId}>
                      {item.product.name} ({item.variant.sku || 'No SKU'}) — Available: {item.quantity} {item.product.unit}
                    </option>
                  ))}
                </select>
                {reportSourceId && sourceStockItems.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No active stock available at this location.
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Quantity to Quarantine <span className="text-rose-500">*</span>
                  </label>
                  {selectedSourceItem && (
                    <span className="text-xs text-neutral-500">
                      Max: {selectedSourceItem.quantity} {selectedSourceItem.product.unit}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0.001"
                    step={
                      selectedSourceItem?.product.measurementType === 'count'
                        ? '1'
                        : '0.001'
                    }
                    value={reportQuantity}
                    onChange={(e) => setReportQuantity(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none font-medium"
                    required
                  />
                  {selectedSourceItem && (
                    <span className="absolute right-3 top-2.5 text-xs text-neutral-400">
                      {selectedSourceItem.product.unit}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Damage Description / Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  minLength={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="e.g. Broken zipper, shattered screen, transit carton crushed..."
                  rows={2}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={reportPending}
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    reportPending ||
                    !reportSourceId ||
                    !reportVariantId ||
                    Number(reportQuantity) <= 0
                  }
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition shadow-sm"
                >
                  {reportPending ? 'Quarantining...' : 'Quarantine Damaged Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Damage Modal */}
      {resolvingReport && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">
                Resolve Damaged Stock {resolvingReport.damageNumber}
              </h3>
              <p className="text-xs text-neutral-500">
                {resolvingReport.quantity} {resolvingReport.unit} of{' '}
                <strong>{resolvingReport.productName}</strong> currently in
                Central Damaged Stock.
              </p>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmitResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Resolution Action <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolveAction('repair')}
                    className={`py-2 px-3 text-sm font-medium rounded-lg border transition ${
                      resolveAction === 'repair'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold'
                        : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    Repair & Restock
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveAction('disposal')}
                    className={`py-2 px-3 text-sm font-medium rounded-lg border transition ${
                      resolveAction === 'disposal'
                        ? 'bg-rose-50 border-rose-500 text-rose-800 font-semibold'
                        : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    Dispose & Write Off
                  </button>
                </div>
              </div>

              {resolveAction === 'repair' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Target Restock Location <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={resolveLocationId}
                    onChange={(e) => setResolveLocationId(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none bg-white font-medium text-neutral-800"
                    required
                  >
                    <option value="">-- Select Target Location --</option>
                    {sellableLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.type === 'warehouse' ? 'Warehouse' : 'Store'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Resolution Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  minLength={3}
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder={
                    resolveAction === 'repair'
                      ? 'e.g. Replaced defective zipper, tested and confirmed grade-A condition...'
                      : 'e.g. Unsalvageable crushed chassis, discarded in e-waste bin...'
                  }
                  rows={2}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={resolvePending}
                  onClick={() => setResolvingReport(null)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolvePending || resolveNotes.trim().length < 3}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition shadow-sm ${
                    resolveAction === 'repair'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {resolvePending
                    ? 'Processing...'
                    : resolveAction === 'repair'
                    ? 'Confirm Restock'
                    : 'Confirm Disposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

