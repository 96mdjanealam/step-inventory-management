import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TableActionLink } from '../../../components/Button.tsx'
import { FilterToolbar, SearchInput } from '../../../components/FilterToolbar.tsx'
import { LocationSelect } from '../../../components/LocationSelect.tsx'
import { TableCard } from '../../../components/TableCard.tsx'
import { TablePagination } from '../../../components/TablePagination.tsx'
import { formatVariantInfo } from '../../../lib/display-formatters.tsx'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import { listReturnsFn } from '../../../server/functions/returns.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z.number().int().min(1).max(100).default(10).catch(10),
  locationId: z.string().uuid().optional().catch(undefined),
  search: z.string().trim().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/returns/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
    locationId: search.locationId,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    const [returnsData, locations] = await Promise.all([
      listReturnsFn({
        data: {
          page: deps.page,
          pageSize: deps.pageSize,
          locationId: deps.locationId,
          search: deps.search,
        },
      }),
      listLocationsFn({ data: { includeInactive: false } }),
    ])
    return { ...returnsData, locations }
  },
  component: ReturnsPage,
})

function ReturnsPage() {
  const { returns, total, page, pageSize } = Route.useLoaderData()
  const { search, locationId } = Route.useSearch()
  const navigate = Route.useNavigate()

  function handleSearchQuery(query: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: query || undefined,
      }),
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Customer Returns & Refunds
          </h1>
          <p className="text-sm text-neutral-500">
            Audit history of returned customer merchandise and stock restorations.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <FilterToolbar>
        <SearchInput
          defaultValue={search || ''}
          placeholder="Search return #, original order #, or reason..."
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
              })
            }
            placeholder="All Store Locations"
            clearable
            className="w-full sm:w-64"
          />
        </FilterToolbar.Right>
      </FilterToolbar>

      {/* Returns List Table */}
      <TableCard>
        <TableCard.Table>
          <TableCard.Header>
            <TableCard.Row isHeader>
              <TableCard.Head>Return #</TableCard.Head>
              <TableCard.Head>Original Order</TableCard.Head>
              <TableCard.Head>Returned Item Details</TableCard.Head>
              <TableCard.Head>Date & Time</TableCard.Head>
              <TableCard.Head>Store Location</TableCard.Head>
              <TableCard.Head>Reason</TableCard.Head>
              <TableCard.Head align="right">Refund Amount</TableCard.Head>
              <TableCard.Head>Authorized By</TableCard.Head>
              <TableCard.Head align="right">Actions</TableCard.Head>
            </TableCard.Row>
          </TableCard.Header>
          <TableCard.Body>
            {returns.length === 0 ? (
              <TableCard.Empty
                colSpan={9}
                message="No customer returns found matching your filters."
              />
            ) : (
              returns.map((ret) => (
                <TableCard.Row key={ret.id}>
                  <TableCard.Cell className="font-mono font-medium text-amber-700 whitespace-nowrap">
                    {ret.returnNumber}
                  </TableCard.Cell>
                  <TableCard.Cell className="font-mono whitespace-nowrap">
                    <Link
                      to="/sales/$saleId"
                      params={{ saleId: ret.saleId }}
                      className="text-indigo-600 hover:underline"
                    >
                      {ret.saleOrderNumber}
                    </Link>
                  </TableCard.Cell>
                  <TableCard.Cell>
                    {ret.items && ret.items.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {ret.items.map((item, idx) => {
                          const variantInfo = formatVariantInfo({
                            attributes: item.attributes as Record<string, string>,
                            sku: item.sku,
                          })

                          return (
                            <div
                              key={idx}
                              className="text-xs"
                            >
                              <div className="font-semibold text-neutral-900">
                                {item.productName}{' '}
                                <span className="font-normal text-neutral-500">
                                  ({item.quantity} {item.unit})
                                </span>
                              </div>
                              <div className="text-neutral-700 font-medium">
                                {variantInfo.title}
                              </div>
                              {variantInfo.subtitle && (
                                <div className="text-neutral-400 font-mono text-[11px]">
                                  {variantInfo.subtitle}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </TableCard.Cell>
                  <TableCard.Cell className="text-neutral-500 whitespace-nowrap">
                    {new Date(ret.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCard.Cell>
                  <TableCard.Cell className="font-medium text-neutral-900 whitespace-nowrap">
                    {ret.locationName}
                  </TableCard.Cell>
                  <TableCard.Cell className="text-neutral-700 max-w-xs break-words leading-relaxed">
                    {ret.reason}
                  </TableCard.Cell>
                  <TableCard.Cell align="right" className="font-semibold text-rose-600 whitespace-nowrap">
                    -${Number(ret.totalRefundAmount).toFixed(2)}
                  </TableCard.Cell>
                  <TableCard.Cell className="text-neutral-700 whitespace-nowrap">
                    {ret.processedByUsername || 'Staff'}
                  </TableCard.Cell>
                  <TableCard.Cell align="right" className="whitespace-nowrap">
                    <TableActionLink
                      to="/sales/$saleId"
                      params={{ saleId: ret.saleId }}
                    >
                      View Sale Order
                    </TableActionLink>
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
    </div>
  )
}

