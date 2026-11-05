import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { LinkButton } from '../../../components/Button.tsx'
import { FilterToolbar, SearchInput } from '../../../components/FilterToolbar.tsx'
import { LocationSelect } from '../../../components/LocationSelect.tsx'
import { TableCard } from '../../../components/TableCard.tsx'
import { TablePagination } from '../../../components/TablePagination.tsx'
import { formatVariantInfo } from '../../../lib/display-formatters.tsx'
import { useTableAutoRefresh } from '../../../lib/hooks/useTableAutoRefresh.ts'
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
  useTableAutoRefresh()
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
      replace: true,
      resetScroll: false,
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
                resetScroll: false,
              })
            }
            placeholder="Filter by location"
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
              <TableCard.Head className="w-24 whitespace-nowrap">Return #</TableCard.Head>
              <TableCard.Head className="w-28 whitespace-nowrap">Original Order</TableCard.Head>
              <TableCard.Head className="min-w-[170px] max-w-[220px]">
                Returned Item Details
              </TableCard.Head>
              <TableCard.Head className="w-28 whitespace-nowrap">Date & Time</TableCard.Head>
              <TableCard.Head className="max-w-[130px]">Store Location</TableCard.Head>
              <TableCard.Head className="min-w-[150px] max-w-[200px]">Reason</TableCard.Head>
              <TableCard.Head align="right" className="w-24 whitespace-nowrap">Refund Amount</TableCard.Head>
              <TableCard.Head className="w-28 whitespace-nowrap">Authorized By</TableCard.Head>
              <TableCard.Head align="right" className="w-24 whitespace-nowrap">Actions</TableCard.Head>
            </TableCard.Row>
          </TableCard.Header>
          <TableCard.Body>
            {returns.length === 0 ? (
              <TableCard.Empty
                colSpan={9}
                message="No customer returns found matching your filters."
              />
            ) : (
              returns.map((ret) => {
                const returnedItemsTooltip =
                  ret.items && ret.items.length > 0
                    ? ret.items
                        .map((item) => {
                          const variantInfo = formatVariantInfo({
                            attributes: item.attributes as Record<
                              string,
                              string
                            >,
                            sku: item.sku,
                          })
                          const variantStr = [
                            variantInfo.title,
                            variantInfo.subtitle,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                          return `${item.productName} (${item.quantity} ${item.unit})${
                            variantStr ? ` - ${variantStr}` : ''
                          }`
                        })
                        .join('\n')
                    : ''

                return (
                  <TableCard.Row key={ret.id}>
                    <TableCard.Cell className="font-mono font-medium text-amber-700 whitespace-nowrap align-top text-xs">
                      {ret.returnNumber}
                    </TableCard.Cell>
                    <TableCard.Cell className="font-mono whitespace-nowrap align-top text-xs">
                      <Link
                        to="/sales/$saleId"
                        params={{ saleId: ret.saleId }}
                        className="text-indigo-600 hover:underline"
                      >
                        {ret.saleOrderNumber}
                      </Link>
                    </TableCard.Cell>
                    <TableCard.Cell
                      className="min-w-[170px] max-w-[220px] align-top"
                      title={returnedItemsTooltip || undefined}
                    >
                      {ret.items && ret.items.length > 0 ? (
                        <div className="line-clamp-3 text-xs leading-relaxed space-y-1">
                          {ret.items.map((item, idx) => {
                            const variantInfo = formatVariantInfo({
                              attributes: item.attributes as Record<
                                string,
                                string
                              >,
                              sku: item.sku,
                            })

                            return (
                              <div key={idx} className="text-xs">
                                <div className="font-semibold text-neutral-900 leading-tight">
                                  {item.productName}{' '}
                                  <span className="font-normal text-neutral-500">
                                    ({item.quantity} {item.unit})
                                  </span>
                                </div>
                                {(variantInfo.title || variantInfo.subtitle) && (
                                  <div className="text-neutral-600 text-[11px] leading-tight">
                                    {variantInfo.title}
                                    {variantInfo.subtitle && (
                                      <span className="text-neutral-400 font-mono ml-1.5">
                                        {variantInfo.subtitle}
                                      </span>
                                    )}
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
                    <TableCard.Cell className="text-neutral-500 whitespace-nowrap align-top">
                      <div className="text-xs text-neutral-800">
                        {new Date(ret.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {new Date(ret.createdAt).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </TableCard.Cell>
                    <TableCard.Cell
                      className="font-medium text-neutral-900 align-top max-w-[130px]"
                      title={ret.locationName}
                    >
                      <div className="text-xs line-clamp-2 break-words leading-tight">
                        {ret.locationName}
                      </div>
                    </TableCard.Cell>
                    <TableCard.Cell
                      className="text-neutral-700 min-w-[150px] max-w-[200px] align-top"
                      title={ret.reason || undefined}
                    >
                      <div className="line-clamp-3 text-xs leading-relaxed break-words">
                        {ret.reason || '—'}
                      </div>
                    </TableCard.Cell>
                    <TableCard.Cell
                      align="right"
                      className="font-semibold text-rose-600 whitespace-nowrap align-top text-xs"
                    >
                      -${Number(ret.totalRefundAmount).toFixed(2)}
                    </TableCard.Cell>
                    <TableCard.Cell className="text-neutral-700 whitespace-nowrap align-top text-xs">
                      {ret.processedByUsername || 'Staff'}
                    </TableCard.Cell>
                    <TableCard.Cell
                      align="right"
                      className="whitespace-nowrap align-top"
                    >
                      <LinkButton
                        size="xs"
                        variant="secondary"
                        to="/sales/$saleId"
                        params={{ saleId: ret.saleId }}
                      >
                        View Order
                      </LinkButton>
                    </TableCard.Cell>
                  </TableCard.Row>
                )
              })
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
        </TableCard.Footer>
      </TableCard>
    </div>
  )
}

