import { Link, createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { z } from 'zod'
import { LinkButton } from '../../../components/Button.tsx'
import { FilterToolbar, SearchInput } from '../../../components/FilterToolbar.tsx'
import { LocationSelect } from '../../../components/LocationSelect.tsx'
import { Select } from '../../../components/Select.tsx'
import { TablePagination } from '../../../components/TablePagination.tsx'
import { useTableAutoRefresh } from '../../../lib/hooks/useTableAutoRefresh.ts'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import { listSalesFn } from '../../../server/functions/sales.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z.number().int().min(1).max(100).default(10).catch(10),
  locationId: z.string().uuid().optional().catch(undefined),
  status: z.enum(['completed', 'cancelled']).optional().catch(undefined),
  search: z.string().trim().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/sales/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
    locationId: search.locationId,
    status: search.status,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    const [salesData, locations] = await Promise.all([
      listSalesFn({
        data: {
          page: deps.page,
          pageSize: deps.pageSize,
          locationId: deps.locationId,
          status: deps.status,
          search: deps.search,
        },
      }),
      listLocationsFn({ data: { includeInactive: false } }),
    ])
    return { ...salesData, locations }
  },
  component: SalesPage,
})

function SalesPage() {
  useTableAutoRefresh()
  const { sales, total, page, pageSize } = Route.useLoaderData()
  const { search, locationId, status } = Route.useSearch()
  const navigate = Route.useNavigate()

  function handleSearchQuery(query: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: query || undefined,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  function handleStatusFilter(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as 'completed' | 'cancelled' | ''
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        status: val || undefined,
      }),
      resetScroll: false,
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Sales & Orders
          </h1>
          <p className="text-sm text-neutral-500">
            Point-of-sale customer orders, receipts, and order cancellations.
          </p>
        </div>
        <LinkButton
          to="/sales/new"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Sale
        </LinkButton>
      </div>

      {/* Filter Toolbar */}
      <FilterToolbar>
        <SearchInput
          defaultValue={search || ''}
          placeholder="Search order #, customer name or phone..."
          onSearch={handleSearchQuery}
          onClear={() => handleSearchQuery('')}
        />

        <FilterToolbar.Right>
          <LocationSelect
            value={locationId || ''}
            type="store"
            onChange={(val) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  locationId: val || undefined,
                  page: 1,
                }),
                resetScroll: false,
              })
            }
            placeholder="Filter by location"
            clearable
            className="w-full sm:w-64"
          />

          <Select
            value={status || ''}
            onChange={handleStatusFilter}
            className="w-full sm:w-44"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </FilterToolbar.Right>
      </FilterToolbar>

      {/* Sales List Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50 text-neutral-900 font-semibold border-b border-neutral-200">
              <tr>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Store Location</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    No sales orders found matching your filters.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-neutral-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-medium text-neutral-900">
                      <Link
                        to="/sales/$saleId"
                        params={{ saleId: sale.id }}
                        className="hover:underline text-indigo-600"
                      >
                        {sale.orderNumber}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-500 whitespace-nowrap">
                      {new Date(sale.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-neutral-900">
                      {sale.locationName}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-700">
                      {sale.customerName ? (
                        <div>
                          <div className="font-medium text-neutral-900">
                            {sale.customerName}
                          </div>
                          {sale.customerPhone && (
                            <div className="text-xs text-neutral-400">
                              {sale.customerPhone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">Walk-in</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-neutral-900">
                      ${Number(sale.totalAmount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {sale.status === 'completed' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-rose-100 text-rose-800">
                          Cancelled
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <LinkButton
                        size="xs"
                        variant="secondary"
                        to="/sales/$saleId"
                        params={{ saleId: sale.id }}
                      >
                        View Details
                      </LinkButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="border-t border-neutral-200 bg-neutral-50 px-4">
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
                resetScroll: false,
              })
            }
            onPageSizeChange={(newPageSize) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  pageSize: newPageSize,
                  page: 1,
                }),
                resetScroll: false,
              })
            }
          />
        </div>
      </div>
    </div>
  )
}
