import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { FilterToolbar, SearchInput } from '../../../components/FilterToolbar.tsx'
import { LocationSelect } from '../../../components/LocationSelect.tsx'
import { Select } from '../../../components/Select.tsx'
import { TableCard } from '../../../components/TableCard.tsx'
import { TablePagination } from '../../../components/TablePagination.tsx'
import { VariantDisplay } from '../../../lib/display-formatters.tsx'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import { listStockMovementsFn } from '../../../server/functions/inventory.ts'
import { listActivityLogsFn } from '../../../server/functions/activity-logs.ts'

const searchSchema = z.object({
  tab: z.enum(['ledger', 'activity']).default('ledger').catch('ledger'),
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z.number().int().min(1).max(100).default(10).catch(10),
  locationId: z.string().uuid().optional().catch(undefined),
  movementType: z
    .enum([
      'inflow',
      'transfer',
      'sale',
      'return',
      'adjustment',
      'damage',
      'repair',
      'disposal',
    ])
    .optional()
    .catch(undefined),
  search: z.string().trim().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/audit/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    tab: search.tab,
    page: search.page,
    pageSize: search.pageSize,
    locationId: search.locationId,
    movementType: search.movementType,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    const locations = await listLocationsFn({ data: { includeInactive: false } })

    if (deps.tab === 'activity') {
      const activityData = await listActivityLogsFn({
        data: {
          page: deps.page,
          pageSize: deps.pageSize,
          locationId: deps.locationId,
        },
      })
      return { tab: 'activity' as const, activityData, ledgerData: null, locations }
    } else {
      const ledgerData = await listStockMovementsFn({
        data: {
          page: deps.page,
          pageSize: deps.pageSize,
          locationId: deps.locationId,
          type: deps.movementType,
          search: deps.search,
        },
      })
      return { tab: 'ledger' as const, activityData: null, ledgerData, locations }
    }
  },
  component: AuditPage,
})

function AuditPage() {
  const { tab, activityData, ledgerData } = Route.useLoaderData()
  const { search, locationId, movementType } = Route.useSearch()
  const navigate = Route.useNavigate()

  const total = tab === 'activity' ? activityData?.total ?? 0 : ledgerData?.total ?? 0
  const page = tab === 'activity' ? activityData?.page ?? 1 : ledgerData?.page ?? 1
  const pageSize = tab === 'activity' ? activityData?.pageSize ?? 20 : ledgerData?.pageSize ?? 20

  function handleSearchQuery(query: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: query || undefined,
      }),
    })
  }

  function handleTypeFilter(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as any
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        movementType: val || undefined,
      }),
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Audit Explorer & Stock Ledger
          </h1>
          <p className="text-sm text-neutral-500">
            Immutable, append-only records of all inventory movements and system operations.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() =>
            navigate({
              search: (prev) => ({
                ...prev,
                tab: 'ledger',
                page: 1,
              }),
            })
          }
          className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition -mb-px ${
            tab === 'ledger'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Stock Movement Ledger
        </button>
        <button
          onClick={() =>
            navigate({
              search: (prev) => ({
                ...prev,
                tab: 'activity',
                page: 1,
                movementType: undefined,
              }),
            })
          }
          className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition -mb-px ${
            tab === 'activity'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Activity Audit Trail
        </button>
      </div>

      {/* Filter Toolbar */}
      <FilterToolbar>
        {tab === 'ledger' && (
          <SearchInput
            defaultValue={search || ''}
            placeholder="Search product, SKU, reference #, or reason..."
            onSearch={handleSearchQuery}
            onClear={() => handleSearchQuery('')}
          />
        )}

        <FilterToolbar.Right>
          {tab === 'ledger' && (
            <Select
              value={movementType || ''}
              onChange={handleTypeFilter}
              className="w-full sm:w-48 capitalize"
            >
              <option value="">All Movement Types</option>
              <option value="inflow">Inflow</option>
              <option value="transfer">Transfer</option>
              <option value="sale">Sale</option>
              <option value="return">Return</option>
              <option value="adjustment">Adjustment</option>
              <option value="damage">Damage</option>
              <option value="repair">Repair</option>
              <option value="disposal">Disposal</option>
            </Select>
          )}

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
            placeholder="All Locations"
            clearable
            className="w-full sm:w-64"
          />
        </FilterToolbar.Right>
      </FilterToolbar>

      {/* Main Table */}
      <TableCard>
        {tab === 'ledger' && ledgerData && (
          <TableCard.Table>
            <TableCard.Header>
              <TableCard.Row isHeader>
                <TableCard.Head className="w-24 whitespace-nowrap">Date & Time</TableCard.Head>
                <TableCard.Head align="center" className="w-20 whitespace-nowrap">Type</TableCard.Head>
                <TableCard.Head className="min-w-[140px] max-w-[200px]">Product & SKU</TableCard.Head>
                <TableCard.Head align="right" className="w-24 whitespace-nowrap">Quantity</TableCard.Head>
                <TableCard.Head className="min-w-[130px] max-w-[170px]">Origin / Destination</TableCard.Head>
                <TableCard.Head className="w-24 whitespace-nowrap">Reference</TableCard.Head>
                <TableCard.Head className="min-w-[240px]">Reason / Notes</TableCard.Head>
                <TableCard.Head className="w-24 whitespace-nowrap">Operator</TableCard.Head>
              </TableCard.Row>
            </TableCard.Header>
            <TableCard.Body>
              {ledgerData.items.length === 0 ? (
                <TableCard.Empty
                  colSpan={8}
                  message="No stock movements recorded matching your filters."
                />
              ) : (
                ledgerData.items.map((m) => {
                  const badgeStyles: Record<string, string> = {
                    inflow: 'bg-blue-100 text-blue-800',
                    transfer: 'bg-indigo-100 text-indigo-800',
                    sale: 'bg-emerald-100 text-emerald-800',
                    return: 'bg-amber-100 text-amber-800',
                    adjustment: 'bg-purple-100 text-purple-800',
                    damage: 'bg-rose-100 text-rose-800',
                    repair: 'bg-teal-100 text-teal-800',
                    disposal: 'bg-neutral-200 text-neutral-800',
                  }

                  return (
                    <TableCard.Row key={m.id}>
                      <TableCard.Cell className="text-neutral-500 whitespace-nowrap align-top text-xs">
                        <div className="font-medium text-neutral-800">
                          {new Date(m.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {new Date(m.createdAt).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </TableCard.Cell>
                      <TableCard.Cell align="center" className="whitespace-nowrap align-top">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                            badgeStyles[m.type] || 'bg-neutral-100 text-neutral-800'
                          }`}
                        >
                          {m.type}
                        </span>
                      </TableCard.Cell>
                      <TableCard.Cell className="font-medium text-neutral-900 min-w-[140px] max-w-[200px] align-top text-xs">
                        <div className="font-semibold text-neutral-900 leading-tight">{m.product.name}</div>
                        <VariantDisplay
                          variant={{
                            attributes: m.variant.attributes as Record<string, string>,
                            sku: m.variant.sku,
                          }}
                        />
                      </TableCard.Cell>
                      <TableCard.Cell align="right" className="font-semibold text-neutral-900 whitespace-nowrap align-top text-xs">
                        {m.quantity} {m.product.unit}
                      </TableCard.Cell>
                      <TableCard.Cell className="text-xs min-w-[130px] max-w-[170px] align-top">
                        {m.sourceLocation && m.destinationLocation ? (
                          <div className="font-medium text-neutral-800 leading-tight">
                            <div>{m.sourceLocation.name}</div>
                            <div className="text-neutral-400 text-[11px] flex items-center gap-1">
                              <span>&darr;</span>
                              <span className="text-neutral-700">{m.destinationLocation.name}</span>
                            </div>
                          </div>
                        ) : m.sourceLocation ? (
                          <div className="text-neutral-700 leading-tight">
                            <span className="text-[11px] text-neutral-400 uppercase tracking-wider block">From</span>
                            <strong>{m.sourceLocation.name}</strong>
                          </div>
                        ) : m.destinationLocation ? (
                          <div className="text-neutral-700 leading-tight">
                            <span className="text-[11px] text-neutral-400 uppercase tracking-wider block">To</span>
                            <strong>{m.destinationLocation.name}</strong>
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </TableCard.Cell>
                      <TableCard.Cell className="font-mono text-xs text-neutral-700 whitespace-nowrap align-top">
                        {m.referenceId || '—'}
                      </TableCard.Cell>
                      <TableCard.Cell
                        className="text-xs text-neutral-600 min-w-[240px] max-w-md break-words leading-relaxed align-top"
                        title={m.reason || undefined}
                      >
                        <div className="line-clamp-3 break-words">
                          {m.reason || '—'}
                        </div>
                      </TableCard.Cell>
                      <TableCard.Cell className="text-xs text-neutral-700 whitespace-nowrap align-top">
                        {m.user?.username || 'System'}
                      </TableCard.Cell>
                    </TableCard.Row>
                  )
                })
              )}
            </TableCard.Body>
          </TableCard.Table>
        )}

        {tab === 'activity' && activityData && (
          <TableCard.Table>
            <TableCard.Header>
              <TableCard.Row isHeader>
                <TableCard.Head className="w-24 whitespace-nowrap">Date & Time</TableCard.Head>
                <TableCard.Head className="w-24 whitespace-nowrap">Action</TableCard.Head>
                <TableCard.Head className="w-20 whitespace-nowrap">Entity</TableCard.Head>
                <TableCard.Head className="min-w-[240px]">Description</TableCard.Head>
                <TableCard.Head className="min-w-[130px] max-w-[170px]">Locations</TableCard.Head>
                <TableCard.Head className="w-24 whitespace-nowrap">Operator</TableCard.Head>
              </TableCard.Row>
            </TableCard.Header>
            <TableCard.Body>
              {activityData.items.length === 0 ? (
                <TableCard.Empty
                  colSpan={6}
                  message="No activity logs found."
                />
              ) : (
                activityData.items.map((log) => (
                  <TableCard.Row key={log.id}>
                    <TableCard.Cell className="text-neutral-500 whitespace-nowrap align-top text-xs">
                      <div className="font-medium text-neutral-800">
                        {new Date(log.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {new Date(log.createdAt).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </TableCard.Cell>
                    <TableCard.Cell className="whitespace-nowrap align-top">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium bg-neutral-100 text-neutral-800">
                        {log.action}
                      </span>
                    </TableCard.Cell>
                    <TableCard.Cell className="text-xs font-mono capitalize text-neutral-600 whitespace-nowrap align-top">
                      {log.entityType}
                    </TableCard.Cell>
                    <TableCard.Cell className="text-neutral-900 text-xs min-w-[240px] max-w-lg break-words leading-relaxed align-top">
                      {log.description}
                    </TableCard.Cell>
                    <TableCard.Cell className="text-xs min-w-[130px] max-w-[170px] align-top">
                      {log.sourceLocation && log.destinationLocation ? (
                        <div className="font-medium text-neutral-800 leading-tight">
                          <div>{log.sourceLocation.name}</div>
                          <div className="text-neutral-400 text-[11px] flex items-center gap-1">
                            <span>&darr;</span>
                            <span className="text-neutral-700">{log.destinationLocation.name}</span>
                          </div>
                        </div>
                      ) : log.sourceLocation ? (
                        <div className="text-neutral-700 leading-tight">
                          <span className="text-[11px] text-neutral-400 uppercase tracking-wider block">Source</span>
                          <strong>{log.sourceLocation.name}</strong>
                        </div>
                      ) : log.destinationLocation ? (
                        <div className="text-neutral-700 leading-tight">
                          <span className="text-[11px] text-neutral-400 uppercase tracking-wider block">Destination</span>
                          <strong>{log.destinationLocation.name}</strong>
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCard.Cell>
                    <TableCard.Cell className="text-xs text-neutral-700 whitespace-nowrap align-top">
                      {log.user?.username || 'System'}
                    </TableCard.Cell>
                  </TableCard.Row>
                ))
              )}
            </TableCard.Body>
          </TableCard.Table>
        )}

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
    </div>
  )
}

