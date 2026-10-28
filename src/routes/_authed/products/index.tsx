import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { listProductsFn } from '../../../server/functions/products.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  search: z.string().trim().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/products/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ page: search.page, search: search.search }),
  loader: ({ deps }) =>
    listProductsFn({ data: { page: deps.page, search: deps.search } }),
  component: ProductsPage,
})

function ProductsPage() {
  const { items, total, page, pageSize } = Route.useLoaderData()
  const { search } = Route.useSearch()
  const navigate = Route.useNavigate()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = String(
      new FormData(event.currentTarget).get('search') ?? '',
    ).trim()
    navigate({ search: { page: 1, search: value || undefined } })
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link
          to="/products/new"
          className="rounded bg-black px-3 py-2 text-sm text-white"
        >
          New product
        </Link>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          name="search"
          defaultValue={search ?? ''}
          placeholder="Search by name"
          className="flex-1 rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Search
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-gray-600">No products found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Name</th>
                <th>Category</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.name}</td>
                  <td>{item.category}</td>
                  <td>
                    {item.discountedPrice}
                    {item.regularPrice ? (
                      <span className="ml-2 text-gray-500 line-through">
                        {item.regularPrice}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <span>
          {total} products · page {page} of {totalPages}
        </span>
        <div className="flex gap-3">
          {page > 1 ? (
            <Link
              to="/products"
              search={(prev) => ({ ...prev, page: page - 1 })}
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              to="/products"
              search={(prev) => ({ ...prev, page: page + 1 })}
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  )
}
