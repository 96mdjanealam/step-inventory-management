import { Link, createFileRoute } from '@tanstack/react-router'
import { Plus, Image as ImageIcon } from 'lucide-react'
import { z } from 'zod'
import { LinkButton } from '../../../components/Button.tsx'
import { FilterToolbar, SearchInput } from '../../../components/FilterToolbar.tsx'
import { LocationSelect } from '../../../components/LocationSelect.tsx'
import { TableCard } from '../../../components/TableCard.tsx'
import { TablePagination } from '../../../components/TablePagination.tsx'
import { VariantDisplay } from '../../../lib/display-formatters.tsx'
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
    })
  }

  function handleLocationFilter(newLocId: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        locationId: newLocId || undefined,
      }),
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
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
            placeholder="All Facilities & Stores"
            clearable
            className="w-full sm:w-64"
          />
        </FilterToolbar.Right>
      </FilterToolbar>

      {/* Transfers Table Card */}
      <TableCard>
        <TableCard.Container>
          <TableCard.Table>
            <TableCard.Header>
              <tr>
                <TableCard.Th>Date & Time</TableCard.Th>
                <TableCard.Th>Product / Variant</TableCard.Th>
                <TableCard.Th>Movement Route</TableCard.Th>
                <TableCard.Th className="text-right">Quantity</TableCard.Th>
                <TableCard.Th>Dispatched By</TableCard.Th>
                <TableCard.Th>Reference / Notes</TableCard.Th>
              </tr>
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

                  return (
                    <TableCard.Row key={t.id}>
                      <TableCard.Td className="text-xs text-neutral-500 whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCard.Td>

                      {/* Product & Variant with Image */}
                      <TableCard.Td>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-center">
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
                              <ImageIcon className="h-5 w-5 text-neutral-300" />
                            )}
                          </div>

                          <div>
                            <Link
                              to="/products/$productId"
                              params={{ productId: t.product.id }}
                              className="font-semibold text-neutral-900 hover:underline block"
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
                        <div className="flex flex-col gap-0.5">
                          <div className="truncate max-w-[200px]" title={t.sourceLocation?.name}>
                            <span className="font-medium text-neutral-400 mr-1">From:</span>
                            <span className="font-medium text-neutral-800">
                              {t.sourceLocation?.name ?? '—'}
                            </span>
                          </div>
                          <div className="truncate max-w-[200px]" title={t.destinationLocation?.name}>
                            <span className="font-semibold text-indigo-500 mr-1">To:</span>
                            <span className="font-semibold text-indigo-700">
                              {t.destinationLocation?.name ?? '—'}
                            </span>
                          </div>
                        </div>
                      </TableCard.Td>

                      {/* Quantity */}
                      <TableCard.Td className="text-right font-bold text-neutral-900 whitespace-nowrap">
                        {t.quantity}{' '}
                        <span className="text-xs font-normal text-neutral-500">
                          {t.product.unit}
                        </span>
                      </TableCard.Td>

                      {/* Dispatched By */}
                      <TableCard.Td className="text-xs text-neutral-600 whitespace-nowrap">
                        {t.user?.username ?? t.user?.role ?? 'System'}
                      </TableCard.Td>

                      {/* Notes: wraps to 2nd line if needed */}
                      <TableCard.Td className="text-xs text-neutral-600 max-w-xs break-words leading-relaxed" title={t.reason || ''}>
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
              })
            }
            onPageSizeChange={(newPageSize) =>
              navigate({
                search: (prev) => ({ ...prev, pageSize: newPageSize, page: 1 }),
              })
            }
          />
        </TableCard.Footer>
      </TableCard>
    </div>
  )
}
