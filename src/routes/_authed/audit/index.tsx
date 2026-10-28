import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import { listStockMovementsFn } from '../../../server/functions/inventory.ts'
import { listActivityLogsFn } from '../../../server/functions/activity-logs.ts'

const searchSchema = z.object({
  tab: z.enum(['ledger', 'activity']).default('ledger').catch('ledger'),
  page: z.number().int().min(1).default(1).catch(1),
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
          locationId: deps.locationId,
        },
      })
      return { tab: 'activity' as const, activityData, ledgerData: null, locations }
    } else {
      const ledgerData = await listStockMovementsFn({
        data: {
          page: deps.page,
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
  const { tab, activityData, ledgerData, locations } = Route.useLoaderData()
  const { search, locationId, movementType } = Route.useSearch()
  const navigate = Route.useNavigate()

  const total = tab === 'activity' ? activityData?.total ?? 0 : ledgerData?.total ?? 0
  const page = tab === 'activity' ? activityData?.page ?? 1 : ledgerData?.page ?? 1
  const pageSize = tab === 'activity' ? activityData?.pageSize ?? 20 : ledgerData?.pageSize ?? 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

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
      <div className="flex flex-col md:flex-row gap-3 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
        {tab === 'ledger' && (
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text"
              name="search"
              defaultValue={search || ''}
              placeholder="Search product, SKU, reference #, or reason..."
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
        )}

        <div className="flex flex-wrap gap-2 items-center">
          {tab === 'ledger' && (
            <select
              value={movementType || ''}
              onChange={handleTypeFilter}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none bg-white text-neutral-700 capitalize"
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
            </select>
          )}

          <select
            value={locationId || ''}
            onChange={handleLocationFilter}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none bg-white text-neutral-700"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        {tab === 'ledger' && ledgerData && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-600">
              <thead className="bg-neutral-50 text-neutral-900 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4 text-center">Type</th>
                  <th className="py-3 px-4">Product & SKU</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4">Origin / Destination</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {ledgerData.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-400">
                      No stock movements recorded matching your filters.
                    </td>
                  </tr>
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
                      <tr key={m.id} className="hover:bg-neutral-50/70 transition">
                        <td className="py-3.5 px-4 text-neutral-500 whitespace-nowrap text-xs">
                          {new Date(m.createdAt).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                              badgeStyles[m.type] || 'bg-neutral-100 text-neutral-800'
                            }`}
                          >
                            {m.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-neutral-900">
                          <div>{m.product.name}</div>
                          <div className="text-xs font-mono text-neutral-400">
                            {m.variant.sku || 'No SKU'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-neutral-900 whitespace-nowrap">
                          {m.quantity} {m.product.unit}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
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
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-neutral-700">
                          {m.referenceId || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-neutral-600 max-w-xs truncate" title={m.reason || ''}>
                          {m.reason || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-neutral-700">
                          {m.user?.username || 'System'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'activity' && activityData && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-600">
              <thead className="bg-neutral-50 text-neutral-900 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Locations</th>
                  <th className="py-3 px-4">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {activityData.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                      No activity logs found.
                    </td>
                  </tr>
                ) : (
                  activityData.items.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50/70 transition">
                      <td className="py-3.5 px-4 text-neutral-500 whitespace-nowrap text-xs">
                        {new Date(log.createdAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-neutral-100 text-neutral-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono capitalize text-neutral-600">
                        {log.entityType}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-900 text-xs">
                        {log.description}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
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
                      </td>
                      <td className="py-3.5 px-4 text-xs text-neutral-700">
                        {log.user?.username || 'System'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 bg-neutral-50 text-sm">
            <span className="text-neutral-500 text-xs">
              Showing page <span className="font-medium">{page}</span> of{' '}
              <span className="font-medium">{totalPages}</span> ({total} records)
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
    </div>
  )
}

