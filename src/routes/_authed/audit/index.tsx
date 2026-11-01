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
                <TableCard.Head>Date & Time</TableCard.Head>
                <TableCard.Head align="center">Type</TableCard.Head>
                <TableCard.Head>Product & SKU</TableCard.Head>
                <TableCard.Head align="right">Quantity</TableCard.Head>
                <TableCard.Head>Origin / Destination</TableCard.Head>
                <TableCard.Head>Reference</TableCard.Head>
                <TableCard.Head>Reason / Notes</TableCard.Head>
                <TableCard.Head>Operator</TableCard.Head>
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
                      <TableCard.Cell className="text-neutral-500 whitespace-nowrap text-xs">
                        {new Date(m.createdAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </TableCard.Cell>
                      <TableCard.Cell align="center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                            badgeStyles[m.type] || 'bg-neutral-100 text-neutral-800'
                          }`}
                        >
                          {m.type}
                        </span>
                      </TableCard.Cell>
                      <TableCard.Cell className="font-medium text-neutral-900">
                        <div className="font-semibold text-neutral-900">{m.product.name}</div>
                        <VariantDisplay
                          variant={{
                            attributes: m.variant.attributes as Record<string, string>,
                            sku: m.variant.sku,
                          }}
                        />
                      </TableCard.Cell>
                      <TableCard.Cell align="right" className="font-semibold text-neutral-900 whitespace-nowrap">
                        {m.quantity} {m.product.unit}
                      </TableCard.Cell>
                      <TableCard.Cell className="text-xs">
                        {m.sourceLocation && m.destinationLocation ? (
                          <div className="font-medium text-neutral-800">
                            <span>{m.sourceLocation.name}</span>
                            <span className="text-neutral-400 mx-1.5">&rarr;</span>
                            <span>{m.destinationLocation.name}</span>
                          </div>
                        ) : m.sourceLocation ? (
                          <div className="text-neutral-700">
                            From: <strong>{m.sourceLocation.name}</strong>
                          </div>
                        ) : m.destinationLocation ? (
                          <div className="text-neutral-700">
                            To: <strong>{m.destinationLocation.name}</strong>
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </TableCard.Cell>
                      <TableCard.Cell className="font-mono text-xs text-neutral-700 whitespace-nowrap">
                        {m.referenceId || '—'}
                      </TableCard.Cell>
                      <TableCard.Cell className="text-xs text-neutral-600 max-w-xs break-words leading-relaxed">
                        {m.reason || '—'}
                      </TableCard.Cell>
                      <TableCard.Cell className="text-xs text-neutral-700 whitespace-nowrap">
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
                <TableCard.Head>Date & Time</TableCard.Head>
                <TableCard.Head>Action</TableCard.Head>
                <TableCard.Head>Entity</TableCard.Head>
                <TableCard.Head>Description</TableCard.Head>
                <TableCard.Head>Locations</TableCard.Head>
                <TableCard.Head>Operator</TableCard.Head>
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
                    <TableCard.Cell className="text-neutral-500 whitespace-nowrap text-xs">
                      {new Date(log.createdAt).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </TableCard.Cell>
                    <TableCard.Cell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-neutral-100 text-neutral-800">
                        {log.action}
                      </span>
                    </TableCard.Cell>
                    <TableCard.Cell className="text-xs font-mono capitalize text-neutral-600 whitespace-nowrap">
                      {log.entityType}
                    </TableCard.Cell>
                    <TableCard.Cell className="text-neutral-900 text-xs max-w-md break-words leading-relaxed">
                      {log.description}
                    </TableCard.Cell>
                    <TableCard.Cell className="text-xs">
                      {log.sourceLocation && log.destinationLocation ? (
                        <div>
                          {log.sourceLocation.name} &rarr; {log.destinationLocation.name}
                        </div>
                      ) : log.sourceLocation ? (
                        log.sourceLocation.name
                      ) : log.destinationLocation ? (
                        log.destinationLocation.name
                      ) : (
                        '—'
                      )}
                    </TableCard.Cell>
                    <TableCard.Cell className="text-xs text-neutral-700 whitespace-nowrap">
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

