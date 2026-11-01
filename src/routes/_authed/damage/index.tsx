import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Plus } from 'lucide-react'
import { z } from 'zod'
import { Button, TableActionButton } from '../../../components/Button.tsx'
import { FilterToolbar, SearchInput } from '../../../components/FilterToolbar.tsx'
import { LocationSelect } from '../../../components/LocationSelect.tsx'
import { Select } from '../../../components/Select.tsx'
import { TableCard } from '../../../components/TableCard.tsx'
import { TablePagination } from '../../../components/TablePagination.tsx'
import { VariantSelect } from '../../../components/VariantSelect.tsx'
import { VariantDisplay } from '../../../lib/display-formatters.tsx'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import { listInventoryFn } from '../../../server/functions/inventory.ts'
import {
  listDamageReportsFn,
  reportDamageFn,
  resolveDamageFn,
} from '../../../server/functions/damage.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z.number().int().min(1).max(100).default(10).catch(10),
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
    pageSize: search.pageSize,
    locationId: search.locationId,
    status: search.status,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    const [reportsData, locations, inventoryData] = await Promise.all([
      listDamageReportsFn({
        data: {
          page: deps.page,
          pageSize: deps.pageSize,
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

  const sellableLocations = locations.filter((l) => l.type !== 'damaged')

  // Stock at selected source location for report modal
  const sourceStockItems = inventory.filter(
    (i) => i.locationId === reportSourceId && Number(i.quantity) > 0,
  )
  const selectedSourceItem = sourceStockItems.find(
    (i) => i.variantId === reportVariantId,
  )

  function handleSearchQuery(query: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: query || undefined,
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

        <Button
          onClick={() => {
            setModalError(null)
            if (sellableLocations.length > 0) {
              setReportSourceId(sellableLocations[0].id)
            }
            setShowReportModal(true)
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Report Damaged Stock
        </Button>
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
      <FilterToolbar>
        <SearchInput
          defaultValue={search || ''}
          placeholder="Search damage #, product name, SKU, or reason..."
          onSearch={handleSearchQuery}
          onClear={() => handleSearchQuery('')}
        />

        <FilterToolbar.Right>
          <LocationSelect
            value={locationId || ''}
            onChange={(val) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  locationId: val || undefined,
                  page: 1,
                }),
              })
            }
            placeholder="All Source Locations"
            clearable
            className="w-full sm:w-64"
          />

          <Select
            value={status || ''}
            onChange={(e) =>
              handleStatusFilter(
                e.target.value as 'quarantined' | 'repaired' | 'disposed' | '',
              )
            }
            className="w-full sm:w-44"
          >
            <option value="">All Statuses</option>
            <option value="quarantined">Quarantined</option>
            <option value="repaired">Repaired</option>
            <option value="disposed">Disposed</option>
          </Select>
        </FilterToolbar.Right>
      </FilterToolbar>

      {/* Reports Table */}
      <TableCard>
        <TableCard.Table>
          <TableCard.Header>
            <TableCard.Row isHeader>
              <TableCard.Head>Damage #</TableCard.Head>
              <TableCard.Head>Date</TableCard.Head>
              <TableCard.Head>Source Location</TableCard.Head>
              <TableCard.Head>Product & SKU</TableCard.Head>
              <TableCard.Head align="right">Quantity</TableCard.Head>
              <TableCard.Head>Reason</TableCard.Head>
              <TableCard.Head align="center">Status</TableCard.Head>
              <TableCard.Head align="right">Actions</TableCard.Head>
            </TableCard.Row>
          </TableCard.Header>
          <TableCard.Body>
            {damageReports.length === 0 ? (
              <TableCard.Empty
                colSpan={8}
                message="No damage reports found matching your criteria."
              />
            ) : (
              damageReports.map((report) => (
                <TableCard.Row key={report.id}>
                  <TableCard.Cell className="font-mono font-medium text-neutral-900 whitespace-nowrap">
                    {report.damageNumber}
                  </TableCard.Cell>
                  <TableCard.Cell className="text-neutral-500 whitespace-nowrap">
                    {new Date(report.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCard.Cell>
                  <TableCard.Cell className="font-medium text-neutral-900 whitespace-nowrap">
                    {report.sourceLocationName}
                  </TableCard.Cell>
                  <TableCard.Cell className="text-neutral-900">
                    <div className="font-semibold text-neutral-900">
                      {report.productName}
                    </div>
                    <VariantDisplay
                      variant={{
                        attributes: report.attributes as Record<string, string>,
                        sku: report.sku,
                      }}
                    />
                  </TableCard.Cell>
                  <TableCard.Cell align="right" className="whitespace-nowrap">
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
                  </TableCard.Cell>
                  <TableCard.Cell className="text-neutral-700 max-w-xs break-words leading-relaxed">
                    <div className="text-xs text-neutral-800">
                      {report.reason}
                    </div>
                    {report.resolutionNotes ? (
                      <div className="mt-1 text-xs text-neutral-500">
                        <span className="font-medium text-neutral-600">
                          {report.status === 'disposed'
                            ? 'Disposal Note: '
                            : 'Note: '}
                        </span>
                        {report.resolutionNotes}
                      </div>
                    ) : null}
                  </TableCard.Cell>
                  <TableCard.Cell align="center" className="whitespace-nowrap">
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
                  </TableCard.Cell>
                  <TableCard.Cell align="right" className="whitespace-nowrap">
                    {report.status === 'quarantined' ? (
                      <TableActionButton
                        onClick={() => {
                          setModalError(null)
                          setResolvingReport(report)
                          setResolveAction('repair')
                          setResolveLocationId(report.sourceLocationId)
                        }}
                      >
                        Resolve
                      </TableActionButton>
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
                  </TableCard.Cell>
                </TableCard.Row>
              ))
            )}
          </TableCard.Body>
        </TableCard.Table>

        {/* Pagination Bar */}
        <TableCard.Footer>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
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
                <LocationSelect
                  value={reportSourceId}
                  onChange={(val) => {
                    setReportSourceId(val)
                    setReportVariantId('')
                  }}
                  placeholder="-- Choose Location --"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Product Variant <span className="text-rose-500">*</span>
                </label>
                <VariantSelect
                  locationId={reportSourceId}
                  value={reportVariantId}
                  onChange={(val) => setReportVariantId(val)}
                  placeholder="-- Choose In-Stock Variant --"
                  disabled={!reportSourceId}
                />
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
                <Button
                  variant="secondary"
                  disabled={reportPending}
                  onClick={() => setShowReportModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !reportSourceId ||
                    !reportVariantId ||
                    Number(reportQuantity) <= 0
                  }
                  isLoading={reportPending}
                >
                  Quarantine Damaged Stock
                </Button>
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
                  <LocationSelect
                    value={resolveLocationId}
                    onChange={(val) => setResolveLocationId(val)}
                    placeholder="-- Select Target Location --"
                  />
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
                <Button
                  variant="secondary"
                  disabled={resolvePending}
                  onClick={() => setResolvingReport(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={resolveAction === 'repair' ? 'primary' : 'danger'}
                  disabled={resolveNotes.trim().length < 3}
                  isLoading={resolvePending}
                >
                  {resolveAction === 'repair' ? 'Confirm Restock' : 'Confirm Disposal'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

