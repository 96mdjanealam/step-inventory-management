import { Link, createFileRoute } from '@tanstack/react-router'
import { Plus, Image as ImageIcon } from 'lucide-react'
import { z } from 'zod'
import { LinkButton } from '../../../components/Button.tsx'
import { FilterToolbar, SearchInput } from '../../../components/FilterToolbar.tsx'
import { LocationSelect } from '../../../components/LocationSelect.tsx'
import { TableCard } from '../../../components/TableCard.tsx'
import { TablePagination } from '../../../components/TablePagination.tsx'
import { VariantDisplay } from '../../../lib/display-formatters.tsx'
import { useTableAutoRefresh } from '../../../lib/hooks/useTableAutoRefresh.ts'
import { listLocationsFn } from '../../../server/functions/locations.ts'
import { listTransfersFn } from '../../../server/functions/transfers.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z.number().int().min(1).max(100).default(10).catch(10),
  locationId: z.string().uuid().optional().catch(undefined),
  search: z.string().trim().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/transfers/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
    locationId: search.locationId,
    search: search.search,
  }),
  loader: async ({ deps }) => {
    const [transfersData, locations] = await Promise.all([
      listTransfersFn({
        data: {
          page: deps.page,
          pageSize: deps.pageSize,
          locationId: deps.locationId,
          search: deps.search,
        },
      }),
      listLocationsFn({ data: { includeInactive: false } }),
    ])
    return { ...transfersData, locations }
  },
  component: TransfersPage,
})

function TransfersPage() {
  useTableAutoRefresh()
  const { items, total, page, pageSize } = Route.useLoaderData()
  const { search, locationId } = Route.useSearch()
  const navigate = Route.useNavigate()

  function handleSearchQuery(q: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: q || undefined,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  function handleLocationFilter(newLocId: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        locationId: newLocId || undefined,
      }),
      resetScroll: false,
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Stock Transfers
          </h1>
          <p className="text-sm text-neutral-500">
            Dispatch and track inventory movements between warehouses and retail stores
          </p>
        </div>
        <LinkButton
          to="/transfers/new"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Transfer
        </LinkButton>
      </div>

      {/* Filter and Search Bar */}
      <FilterToolbar>
        <SearchInput
          defaultValue={search ?? ''}
          placeholder="Search by product, SKU, or location name..."
          onSearch={handleSearchQuery}
          onClear={() => handleSearchQuery('')}
        />

        <FilterToolbar.Right>
          <LocationSelect
            value={locationId ?? ''}
            onChange={(val) => handleLocationFilter(val)}
            placeholder="Filter by location"
            clearable
            className="w-full sm:w-64"
          />
        </FilterToolbar.Right>
      </FilterToolbar>

      {/* Transfers Table Card */}
      <TableCard>
        <TableCard.Container>
          <TableCard.Table className="table-fixed min-w-[850px]">
            <TableCard.Header>
              <TableCard.Row isHeader>
                <TableCard.Th className="w-28 whitespace-nowrap text-xs">Date & Time</TableCard.Th>
                <TableCard.Th className="w-48 text-xs">Product / Variant</TableCard.Th>
                <TableCard.Th className="w-48 text-xs">Movement Route</TableCard.Th>
                <TableCard.Th className="w-24 text-right whitespace-nowrap text-xs">Quantity</TableCard.Th>
                <TableCard.Th className="w-28 whitespace-nowrap text-xs">Dispatched By</TableCard.Th>
                <TableCard.Th className="text-xs w-48">Reference / Notes</TableCard.Th>
              </TableCard.Row>
            </TableCard.Header>
            <TableCard.Body>
              {items.length === 0 ? (
                <TableCard.Empty
                  colSpan={6}
                  message="No stock transfers recorded matching your filters. Use 'New Transfer' to dispatch inventory."
                />
              ) : (
                items.map((t) => {
                  const img = t.variant.image || t.product.images?.[0]
                  const createdDate = new Date(t.createdAt)

                  return (
                    <TableCard.Row key={t.id}>
                      {/* Date & Time: 2 lines */}
                      <TableCard.Td className="whitespace-nowrap text-xs">
                        <div className="font-medium text-neutral-800">
                          {createdDate.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {createdDate.toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </TableCard.Td>

                      {/* Product & Variant with Image */}
                      <TableCard.Td>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 shrink-0 overflow-hidden border border-neutral-200 bg-neutral-50 flex items-center justify-center">
                            {img ? (
                              <img
                                src={img}
                                alt=""
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  ;(e.target as HTMLImageElement).src =
                                    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                                }}
                              />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-neutral-300" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <Link
                              to="/products/$productId"
                              params={{ productId: t.product.id }}
                              className="font-semibold text-neutral-900 hover:underline block truncate text-xs"
                              title={t.product.name}
                            >
                              {t.product.name}
                            </Link>
                            <VariantDisplay
                              variant={{
                                attributes: t.variant.attributes as Record<string, string>,
                                sku: t.variant.sku,
                              }}
                            />
                          </div>
                        </div>
                      </TableCard.Td>

                      {/* Movement Route: From / To */}
                      <TableCard.Td className="text-xs leading-relaxed">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="truncate" title={t.sourceLocation?.name}>
                            <span className="font-medium text-neutral-400 mr-1">From:</span>
                            <span className="font-medium text-neutral-800">
                              {t.sourceLocation?.name ?? '—'}
                            </span>
                          </div>
                          <div className="truncate" title={t.destinationLocation?.name}>
                            <span className="font-semibold text-indigo-500 mr-1">To:</span>
                            <span className="font-semibold text-indigo-700">
                              {t.destinationLocation?.name ?? '—'}
                            </span>
                          </div>
                        </div>
                      </TableCard.Td>

                      {/* Quantity */}
                      <TableCard.Td className="text-right font-bold text-neutral-900 whitespace-nowrap text-xs">
                        {t.quantity}{' '}
                        <span className="text-xs font-normal text-neutral-500">
                          {t.product.unit}
                        </span>
                      </TableCard.Td>

                      {/* Dispatched By */}
                      <TableCard.Td className="whitespace-nowrap text-xs text-neutral-600 truncate" title={t.user?.username ?? t.user?.role ?? 'System'}>
                        {t.user?.username ?? t.user?.role ?? 'System'}
                      </TableCard.Td>

                      {/* Reference / Notes */}
                      <TableCard.Td className="text-xs text-neutral-600 break-words leading-relaxed" title={t.reason || ''}>
                        {t.reason || '—'}
                      </TableCard.Td>
                    </TableCard.Row>
                  )
                })
              )}
            </TableCard.Body>
          </TableCard.Table>
        </TableCard.Container>

        <TableCard.Footer>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(newPage) =>
              navigate({
                search: (prev) => ({ ...prev, page: newPage }),
                resetScroll: false,
              })
            }
            onPageSizeChange={(newPageSize) =>
              navigate({
                search: (prev) => ({ ...prev, pageSize: newPageSize, page: 1 }),
                resetScroll: false,
              })
            }
          />
        </TableCard.Footer>
      </TableCard>
    </div>
  )
}
