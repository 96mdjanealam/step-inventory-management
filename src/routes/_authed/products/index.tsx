import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Image as ImageIcon, Plus } from 'lucide-react'
import { z } from 'zod'
import { Button, LinkButton } from '../../../components/Button.tsx'
import { FilterToolbar, SearchInput } from '../../../components/FilterToolbar.tsx'
import { TableCard } from '../../../components/TableCard.tsx'
import { TablePagination } from '../../../components/TablePagination.tsx'
import { useTableAutoRefresh } from '../../../lib/hooks/useTableAutoRefresh.ts'
import {
  archiveProductFn,
  listProductsFn,
  restoreProductFn,
} from '../../../server/functions/products.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z.number().int().min(1).max(100).default(10).catch(10),
  search: z.string().trim().min(1).optional().catch(undefined),
  includeArchived: z.boolean().default(false).catch(false),
})

export const Route = createFileRoute('/_authed/products/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
    search: search.search,
    includeArchived: search.includeArchived,
  }),
  loader: ({ deps }) =>
    listProductsFn({
      data: {
        page: deps.page,
        pageSize: deps.pageSize,
        search: deps.search,
        includeArchived: deps.includeArchived,
      },
    }),
  component: ProductsPage,
})

function ProductsPage() {
  const { items, total, page, pageSize } = Route.useLoaderData()
  const { search, includeArchived } = Route.useSearch()
  const { user } = Route.useRouteContext()
  const navigate = Route.useNavigate()
  const router = useRouter()

  const archiveProduct = useServerFn(archiveProductFn)
  const restoreProduct = useServerFn(restoreProductFn)

  const [actionPendingId, setActionPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useTableAutoRefresh({ enabled: !actionPendingId })

  const isAdmin = user.role === 'admin'

  function handleSearchQuery(value: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: value || undefined,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  function handleToggleArchived(checked: boolean) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        includeArchived: checked || undefined,
      }),
      resetScroll: false,
    })
  }

  async function handleArchive(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to archive "${name}"?`)) return
    setActionPendingId(id)
    setActionError(null)
    try {
      await archiveProduct({ data: { id } })
      await router.invalidate()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to archive product',
      )
    } finally {
      setActionPendingId(null)
    }
  }

  async function handleRestore(id: string) {
    setActionPendingId(id)
    setActionError(null)
    try {
      await restoreProduct({ data: { id } })
      await router.invalidate()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to restore product',
      )
    } finally {
      setActionPendingId(null)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Products</h1>
          <p className="text-sm text-neutral-500">
            Manage your inventory catalog, units, categories, and variants
          </p>
        </div>
        <LinkButton
          to="/products/new"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Product
        </LinkButton>
      </div>

      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {actionError}
        </div>
      ) : null}

      <FilterToolbar>
        <SearchInput
          defaultValue={search ?? ''}
          placeholder="Search by product name..."
          onSearch={handleSearchQuery}
          onClear={() => handleSearchQuery('')}
        />

        <FilterToolbar.Right>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600 select-none">
            <input
              type="checkbox"
              checked={Boolean(includeArchived)}
              onChange={(e) => handleToggleArchived(e.target.checked)}
              className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
            />
            Show archived products
          </label>
        </FilterToolbar.Right>
      </FilterToolbar>

      <TableCard>
        <TableCard.Container>
          <TableCard.Table>
            <TableCard.Header>
              <tr>
                <TableCard.Th>Product Name</TableCard.Th>
                <TableCard.Th>Category</TableCard.Th>
                <TableCard.Th>Price</TableCard.Th>
                <TableCard.Th className="text-center">Status</TableCard.Th>
                {isAdmin ? (
                  <TableCard.Th className="text-right">Actions</TableCard.Th>
                ) : null}
              </tr>
            </TableCard.Header>
            <TableCard.Body>
              {items.length === 0 ? (
                <TableCard.Empty colSpan={isAdmin ? 5 : 4} message="No products found matching your filters." />
              ) : (
                items.map((item) => {
                  const cover = item.images?.[0] || item.variantImage
                  return (
                    <TableCard.Row key={item.id}>
                      <TableCard.Td className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-center">
                            {cover ? (
                              <img
                                src={cover}
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
                              params={{ productId: item.id }}
                              className="font-semibold text-neutral-900 hover:underline"
                            >
                              {item.name}
                            </Link>
                            <div className="text-xs text-neutral-400">
                              {item.targetConsumer} · {item.unit}
                            </div>
                          </div>
                        </div>
                      </TableCard.Td>
                      <TableCard.Td className="text-neutral-600">{item.category}</TableCard.Td>
                      <TableCard.Td className="font-medium text-neutral-900">
                        ${item.discountedPrice}
                        {item.regularPrice &&
                        item.regularPrice !== item.discountedPrice ? (
                          <span className="ml-2 text-xs text-neutral-400 line-through">
                            ${item.regularPrice}
                          </span>
                        ) : null}
                      </TableCard.Td>
                      <TableCard.Td className="text-center">
                        {item.isActive ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                            Archived
                          </span>
                        )}
                      </TableCard.Td>
                      {isAdmin ? (
                        <TableCard.Td className="text-right">
                          {item.isActive ? (
                            <Button
                              size="xs"
                              variant="dangerSoft"
                              disabled={actionPendingId === item.id}
                              isLoading={actionPendingId === item.id}
                              onClick={() => handleArchive(item.id, item.name)}
                            >
                              Archive
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="primary"
                              disabled={actionPendingId === item.id}
                              isLoading={actionPendingId === item.id}
                              onClick={() => handleRestore(item.id)}
                            >
                              Restore
                            </Button>
                          )}
                        </TableCard.Td>
                      ) : null}
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
