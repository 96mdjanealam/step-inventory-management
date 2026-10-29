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
  const { damageReports, total, page, pageSize, locations, inventory, summary } =
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

  function handleStatusFilter(val: 'quarantined' | 'repaired' | 'disposed' | '') {
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
    const isCount =
      selectedSourceItem?.product.measurementType === 'count' ||
      selectedSourceItem?.product.unit === 'piece'
    if (isCount && !Number.isInteger(Number(reportQuantity))) {
      setModalError(
        `Quantity for ${selectedSourceItem?.product.unit || 'piece'} items must be a whole number`,
      )
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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Quarantined Card */}
        <div
          onClick={() => handleStatusFilter('quarantined')}
          className={`cursor-pointer rounded-xl border p-4 transition ${
            status === 'quarantined'
              ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20'
              : 'border-neutral-200 bg-white hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-amber-800">
            <span>In Quarantine</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              {summary?.quarantined?.count ?? 0} tickets
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-900">
            {summary?.quarantined?.totalQuantity ?? '0'}{' '}
            <span className="text-sm font-normal text-amber-700">units</span>
          </div>
          <p className="mt-1 text-xs text-amber-700">
            Awaiting inspection, repair, or scrap
          </p>
        </div>

        {/* Disposed / Wasted Card */}
        <div
          onClick={() => handleStatusFilter('disposed')}
          className={`cursor-pointer rounded-xl border p-4 transition ${
            status === 'disposed'
              ? 'border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/20'
              : 'border-neutral-200 bg-white hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-rose-800">
            <span>Disposed / Wasted</span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">
              {summary?.disposed?.count ?? 0} write-offs
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-900">
            {summary?.disposed?.totalQuantity ?? '0'}{' '}
            <span className="text-sm font-normal text-rose-700">units wasted</span>
          </div>
          <p className="mt-1 text-xs text-rose-700">
            Permanently written off as scrap or total loss
          </p>
        </div>

        {/* Repaired / Restocked Card */}
        <div
          onClick={() => handleStatusFilter('repaired')}
          className={`cursor-pointer rounded-xl border p-4 transition ${
            status === 'repaired'
              ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
              : 'border-neutral-200 bg-white hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-800">
            <span>Repaired & Restocked</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
              {summary?.repaired?.count ?? 0} restored
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-900">
            {summary?.repaired?.totalQuantity ?? '0'}{' '}
            <span className="text-sm font-normal text-emerald-700">units salvaged</span>
          </div>
          <p className="mt-1 text-xs text-emerald-700">
            Restored back into active sellable stock
          </p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-3">
        <button
          type="button"
          onClick={() => handleStatusFilter('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            !status
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
          }`}
        >
          All Reports ({summary?.all?.count ?? total})
        </button>

        <button
          type="button"
          onClick={() => handleStatusFilter('quarantined')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
            status === 'quarantined'
              ? 'bg-amber-600 text-white'
              : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
          }`}
        >
          Quarantined
          <span className="rounded-full bg-amber-200/60 px-1.5 py-0.2 text-[10px] font-bold">
            {summary?.quarantined?.count ?? 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleStatusFilter('disposed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
            status === 'disposed'
              ? 'bg-rose-700 text-white'
              : 'text-rose-800 bg-rose-50 hover:bg-rose-100'
          }`}
        >
          Disposed / Wasted Stock
          <span className="rounded-full bg-rose-200/60 px-1.5 py-0.2 text-[10px] font-bold">
            {summary?.disposed?.count ?? 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleStatusFilter('repaired')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
            status === 'repaired'
              ? 'bg-emerald-700 text-white'
              : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
          }`}
        >
          Repaired
          <span className="rounded-full bg-emerald-200/60 px-1.5 py-0.2 text-[10px] font-bold">
            {summary?.repaired?.count ?? 0}
          </span>
        </button>
      </div>

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
            onChange={(e) =>
              handleStatusFilter(
                e.target.value as 'quarantined' | 'repaired' | 'disposed' | '',
              )
            }
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
                      <div className="font-semibold text-neutral-900">
                        {report.productName}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {report.attributes &&
                        Object.keys(report.attributes).length > 0 ? (
                          <span className="text-neutral-700">
                            {Object.entries(
                              report.attributes as Record<string, string>,
                            )
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ')}
                            {' · '}
                          </span>
                        ) : null}
                        <span className="font-mono text-neutral-400">
                          SKU: {report.sku || 'No SKU'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {report.status === 'disposed' ? (
                        <div>
                          <span className="font-bold text-rose-700">
                            {report.quantity} {report.unit}
                          </span>
                          <span className="block text-[10px] font-semibold text-rose-500 uppercase tracking-tight">
                            Wasted
                          </span>
                        </div>
                      ) : report.status === 'repaired' ? (
                        <div>
                          <span className="font-bold text-emerald-700">
                            {report.quantity} {report.unit}
                          </span>
                          <span className="block text-[10px] font-semibold text-emerald-600 uppercase tracking-tight">
                            Restored
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="font-bold text-amber-800">
                            {report.quantity} {report.unit}
                          </span>
                          <span className="block text-[10px] font-semibold text-amber-600 uppercase tracking-tight">
                            In Quarantine
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-700 max-w-xs">
                      <div
                        className="text-xs text-neutral-800 truncate"
                        title={report.reason}
                      >
                        {report.reason}
                      </div>
                      {report.resolutionNotes ? (
                        <div
                          className="mt-0.5 text-xs text-neutral-500 truncate"
                          title={report.resolutionNotes}
                        >
                          <span className="font-medium text-neutral-600">
                            {report.status === 'disposed'
                              ? 'Disposal Note: '
                              : 'Note: '}
                          </span>
                          {report.resolutionNotes}
                        </div>
                      ) : null}
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
                        <div className="text-xs text-neutral-500 text-right">
                          <span className="font-medium text-neutral-700">
                            {report.status === 'disposed'
                              ? 'Written Off'
                              : 'Restored'}
                          </span>
                          {report.resolverUsername ? (
                            <div className="text-[11px] text-neutral-400">
                              by {report.resolverUsername}
                            </div>
                          ) : null}
                        </div>
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
                    min={
                      selectedSourceItem?.product.measurementType === 'count' ||
                      selectedSourceItem?.product.unit === 'piece'
                        ? '1'
                        : '0.001'
                    }
                    step={
                      selectedSourceItem?.product.measurementType === 'count' ||
                      selectedSourceItem?.product.unit === 'piece'
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

