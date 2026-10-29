import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  archiveProductFn,
  listProductsFn,
  restoreProductFn,
} from '../../../server/functions/products.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  search: z.string().trim().min(1).optional().catch(undefined),
  includeArchived: z.boolean().default(false).catch(false),
})

export const Route = createFileRoute('/_authed/products/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    search: search.search,
    includeArchived: search.includeArchived,
  }),
  loader: ({ deps }) =>
    listProductsFn({
      data: {
        page: deps.page,
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const isAdmin = user.role === 'admin'

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = String(
      new FormData(event.currentTarget).get('search') ?? '',
    ).trim()
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: value || undefined,
      }),
    })
  }

  function handleToggleArchived(checked: boolean) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        includeArchived: checked || undefined,
      }),
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
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-gray-500">
            Manage your inventory catalog and variants
          </p>
        </div>
        <Link
          to="/products/new"
          className="rounded bg-black px-3 py-2 text-sm text-white hover:bg-gray-800"
        >
          New product
        </Link>
      </div>

      {actionError ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {actionError}
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by name"
            className="flex-1 rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-sm text-white hover:bg-gray-800"
          >
            Search
          </button>
        </form>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={Boolean(includeArchived)}
            onChange={(e) => handleToggleArchived(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show archived products
        </label>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-gray-500">No products found.</p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                {isAdmin ? (
                  <th className="px-4 py-3 text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => {
                const cover = item.images?.[0] || item.variantImage
                return (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
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
                            <svg
                              className="h-5 w-5 text-gray-300"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </div>
                        <div>
                          <Link
                            to="/products/$productId"
                            params={{ productId: item.id }}
                            className="font-semibold text-black hover:underline"
                          >
                            {item.name}
                          </Link>
                          <div className="text-xs text-gray-400">
                            {item.targetConsumer} · {item.unit}
                          </div>
                        </div>
                      </div>
                    </td>
                  <td className="px-4 py-3 text-gray-600">{item.category}</td>
                  <td className="px-4 py-3">
                    ${item.discountedPrice}
                    {item.regularPrice ? (
                      <span className="ml-2 text-xs text-gray-400 line-through">
                        ${item.regularPrice}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {item.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Archived
                      </span>
                    )}
                  </td>
                  {isAdmin ? (
                    <td className="px-4 py-3 text-right">
                      {item.isActive ? (
                        <button
                          type="button"
                          disabled={actionPendingId === item.id}
                          onClick={() => handleArchive(item.id, item.name)}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          {actionPendingId === item.id
                            ? 'Archiving...'
                            : 'Archive'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionPendingId === item.id}
                          onClick={() => handleRestore(item.id)}
                          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                        >
                          {actionPendingId === item.id
                            ? 'Restoring...'
                            : 'Restore'}
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              )
            })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {total} products · page {page} of {totalPages}
        </span>
        <div className="flex gap-3">
          {page > 1 ? (
            <Link
              to="/products"
              search={(prev) => ({ ...prev, page: page - 1 })}
              className="text-black underline"
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              to="/products"
              search={(prev) => ({ ...prev, page: page + 1 })}
              className="text-black underline"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  )
}
