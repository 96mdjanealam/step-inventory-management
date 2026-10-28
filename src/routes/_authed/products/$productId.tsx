import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  archiveProductFn,
  getProductFn,
  restoreProductFn,
  updateProductFn,
} from '../../../server/functions/products.ts'
import {
  createVariantFn,
  toggleVariantActiveFn,
  updateVariantFn,
} from '../../../server/functions/variants.ts'

export const Route = createFileRoute('/_authed/products/$productId')({
  loader: ({ params }) => getProductFn({ data: { id: params.productId } }),
  component: ProductDetailPage,
})

interface AttributeItem {
  id: string
  key: string
  value: string
}

function attributesToMap(items: AttributeItem[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const item of items) {
    const k = item.key.trim()
    const v = item.value.trim()
    if (k && v) {
      result[k] = v
    }
  }
  return result
}

function mapToAttributes(record: Record<string, string> | null | undefined): AttributeItem[] {
  if (!record || typeof record !== 'object') return []
  return Object.entries(record).map(([k, v], index) => ({
    id: `${index}-${k}`,
    key: k,
    value: String(v),
  }))
}

function ProductDetailPage() {
  const product = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()

  const updateProduct = useServerFn(updateProductFn)
  const archiveProduct = useServerFn(archiveProductFn)
  const restoreProduct = useServerFn(restoreProductFn)

  const createVariant = useServerFn(createVariantFn)
  const updateVariant = useServerFn(updateVariantFn)
  const toggleVariantActive = useServerFn(toggleVariantActiveFn)

  const [isEditing, setIsEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Variant Modal State
  const [showAddVariant, setShowAddVariant] = useState(false)
  const [editingVariant, setEditingVariant] = useState<
    (typeof product.variants)[number] | null
  >(null)
  const [variantPending, setVariantPending] = useState(false)
  const [variantError, setVariantError] = useState<string | null>(null)
  const [variantAttributes, setVariantAttributes] = useState<AttributeItem[]>([])

  const isAdmin = user.role === 'admin'

  async function handleArchiveToggle() {
    setActionError(null)
    setActionPending(true)
    try {
      if (product.isActive) {
        if (!window.confirm(`Archive "${product.name}"?`)) {
          setActionPending(false)
          return
        }
        await archiveProduct({ data: { id: product.id } })
      } else {
        await restoreProduct({ data: { id: product.id } })
      }
      await router.invalidate()
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Failed to update product archive status',
      )
    } finally {
      setActionPending(false)
    }
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFieldErrors({})
    setFormError(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const category = String(form.get('category') ?? '').trim()
    const targetConsumer = String(form.get('targetConsumer') ?? '') as
      | 'male'
      | 'female'
      | 'unisex'
      | 'kids'
    const description = String(form.get('description') ?? '').trim()

    const errors: Record<string, string> = {}
    if (!name) errors.name = 'Name is required'
    if (!category) errors.category = 'Category is required'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setPending(true)
    try {
      await updateProduct({
        data: {
          id: product.id,
          name,
          category,
          targetConsumer,
          description: description || undefined,
        },
      })
      await router.invalidate()
      setIsEditing(false)
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to update product',
      )
    } finally {
      setPending(false)
    }
  }

  function openAddVariant() {
    setEditingVariant(null)
    setVariantAttributes([{ id: '1', key: '', value: '' }])
    setVariantError(null)
    setShowAddVariant(true)
  }

  function openEditVariant(v: (typeof product.variants)[number]) {
    setEditingVariant(v)
    const initialAttrs = mapToAttributes(v.attributes)
    setVariantAttributes(
      initialAttrs.length > 0 ? initialAttrs : [{ id: '1', key: '', value: '' }],
    )
    setVariantError(null)
    setShowAddVariant(true)
  }

  function addAttributeRow() {
    setVariantAttributes((prev) => [
      ...prev,
      { id: String(Date.now()), key: '', value: '' },
    ])
  }

  function updateAttributeRow(id: string, key: string, value: string) {
    setVariantAttributes((prev) =>
      prev.map((a) => (a.id === id ? { ...a, key, value } : a)),
    )
  }

  function removeAttributeRow(id: string) {
    setVariantAttributes((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleVariantSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setVariantError(null)

    const form = new FormData(event.currentTarget)
    const sku = String(form.get('sku') ?? '').trim() || undefined
    const discountedPrice = String(form.get('discountedPrice') ?? '').trim()
    const regularPrice =
      String(form.get('regularPrice') ?? '').trim() || undefined
    const isDefault = form.get('isDefault') === 'on'

    if (!discountedPrice) {
      setVariantError('Selling price is required')
      return
    }

    if (regularPrice && Number(regularPrice) < Number(discountedPrice)) {
      setVariantError('Regular price cannot be less than selling price')
      return
    }

    const attributes = attributesToMap(variantAttributes)

    setVariantPending(true)
    try {
      if (editingVariant) {
        await updateVariant({
          data: {
            id: editingVariant.id,
            sku,
            discountedPrice,
            regularPrice,
            attributes,
            isDefault,
          },
        })
      } else {
        await createVariant({
          data: {
            productId: product.id,
            sku,
            discountedPrice,
            regularPrice,
            attributes,
            isDefault,
          },
        })
      }

      await router.invalidate()
      setShowAddVariant(false)
    } catch (err) {
      setVariantError(
        err instanceof Error ? err.message : 'Failed to save variant',
      )
    } finally {
      setVariantPending(false)
    }
  }

  async function handleToggleVariant(
    v: (typeof product.variants)[number],
  ) {
    const nextState = !v.isActive
    if (!nextState && !window.confirm(`Deactivate variant "${v.sku || 'Default'}"?`)) {
      return
    }
    setActionError(null)
    try {
      await toggleVariantActive({
        data: {
          id: v.id,
          isActive: nextState,
        },
      })
      await router.invalidate()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update variant status',
      )
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{product.name}</h1>
            {product.isActive ? (
              <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Active
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                Archived
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">Slug: {product.slug}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/products"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ← Back to products
          </Link>
          {isAdmin ? (
            <button
              type="button"
              disabled={actionPending}
              onClick={handleArchiveToggle}
              className={`rounded px-3 py-1.5 text-sm text-white disabled:opacity-50 ${
                product.isActive
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {actionPending
                ? 'Processing...'
                : product.isActive
                  ? 'Archive'
                  : 'Restore'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="rounded bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
          >
            {isEditing ? 'Cancel edit' : 'Edit details'}
          </button>
        </div>
      </div>

      {actionError ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {actionError}
        </div>
      ) : null}

      {/* Product Details / Edit Card */}
      <div className="mb-8 rounded-lg border bg-white p-6 shadow-xs">
        <h2 className="mb-4 text-lg font-semibold">General Information</h2>

        {isEditing ? (
          <form onSubmit={handleUpdate} className="flex flex-col gap-4">
            {formError ? (
              <p className="rounded bg-red-50 p-2 text-sm text-red-600">
                {formError}
              </p>
            ) : null}

            <label className="flex flex-col gap-1 text-sm font-medium">
              Name
              <input
                name="name"
                defaultValue={product.name}
                required
                className="rounded border px-3 py-2 text-sm"
              />
              {fieldErrors.name ? (
                <span className="text-xs text-red-600">{fieldErrors.name}</span>
              ) : null}
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Category
                <input
                  name="category"
                  defaultValue={product.category}
                  required
                  className="rounded border px-3 py-2 text-sm"
                />
                {fieldErrors.category ? (
                  <span className="text-xs text-red-600">
                    {fieldErrors.category}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Target consumer
                <select
                  name="targetConsumer"
                  defaultValue={product.targetConsumer}
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="unisex">Unisex</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="kids">Kids</option>
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Description
              <textarea
                name="description"
                defaultValue={product.description ?? ''}
                rows={3}
                className="rounded border px-3 py-2 text-sm"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {pending ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500 uppercase">Category</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {product.category}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 uppercase">
                Target Consumer
              </dt>
              <dd className="mt-1 text-sm font-medium text-gray-900 capitalize">
                {product.targetConsumer}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 uppercase">
                Measurement & Unit
              </dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {product.measurementType} ({product.unit})
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 uppercase">Created At</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {new Date(product.createdAt).toLocaleString()}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-gray-500 uppercase">Description</dt>
              <dd className="mt-1 text-sm text-gray-700">
                {product.description || (
                  <span className="italic text-gray-400">
                    No description provided.
                  </span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {/* Variants Table Card */}
      <div className="rounded-lg border bg-white p-6 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Product Variants</h2>
            <p className="text-xs text-gray-500">
              Manage SKUs, dynamic attributes, and pricing
            </p>
          </div>
          <button
            type="button"
            onClick={openAddVariant}
            className="rounded bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
          >
            + Add variant
          </button>
        </div>

        <div className="overflow-x-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-4 py-3">Variant / SKU</th>
                <th className="px-4 py-3">Attributes</th>
                <th className="px-4 py-3">Selling Price</th>
                <th className="px-4 py-3">Regular Price</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {product.variants.map((v) => {
                const attrs =
                  v.attributes && typeof v.attributes === 'object'
                    ? Object.entries(v.attributes)
                    : []
                return (
                  <tr key={v.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium">
                      {v.sku || (
                        <span className="italic text-gray-400">No SKU</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {attrs.length === 0 ? (
                        <span className="text-xs text-gray-400">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {attrs.map(([key, val]) => (
                            <span
                              key={key}
                              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                            >
                              {key}: {String(val)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      ${v.discountedPrice}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {v.regularPrice ? (
                        `${v.regularPrice}`
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {v.isDefault ? (
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Default
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {v.isActive ? (
                        <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditVariant(v)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleVariant(v)}
                          className={`text-xs hover:underline ${
                            v.isActive ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {v.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Variant Modal */}
      {showAddVariant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">
              {editingVariant ? 'Edit Variant' : 'Add New Variant'}
            </h3>

            {variantError ? (
              <p className="mb-3 rounded bg-red-50 p-2 text-xs text-red-600">
                {variantError}
              </p>
            ) : null}

            <form onSubmit={handleVariantSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                SKU (optional)
                <input
                  name="sku"
                  defaultValue={editingVariant?.sku ?? ''}
                  placeholder="e.g. TSHIRT-BLU-L"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Selling Price *
                  <input
                    name="discountedPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    defaultValue={editingVariant?.discountedPrice ?? ''}
                    placeholder="29.99"
                    className="rounded border px-3 py-2 text-sm"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium">
                  Regular Price
                  <input
                    name="regularPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editingVariant?.regularPrice ?? ''}
                    placeholder="39.99"
                    className="rounded border px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {/* Attributes Section */}
              <div className="mt-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700 uppercase">
                    Attributes (Size, Color, etc.)
                  </span>
                  <button
                    type="button"
                    onClick={addAttributeRow}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    + Add attribute
                  </button>
                </div>

                {variantAttributes.map((attr) => (
                  <div key={attr.id} className="flex gap-2">
                    <input
                      placeholder="Name (e.g. Size)"
                      value={attr.key}
                      onChange={(e) =>
                        updateAttributeRow(attr.id, e.target.value, attr.value)
                      }
                      className="w-1/2 rounded border px-2 py-1.5 text-xs"
                    />
                    <input
                      placeholder="Value (e.g. M)"
                      value={attr.value}
                      onChange={(e) =>
                        updateAttributeRow(attr.id, attr.key, e.target.value)
                      }
                      className="w-1/2 rounded border px-2 py-1.5 text-xs"
                    />
                    {variantAttributes.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeAttributeRow(attr.id)}
                        className="px-1 text-xs text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="isDefault"
                  defaultChecked={editingVariant?.isDefault ?? false}
                  className="rounded border-gray-300"
                />
                Set as default variant
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddVariant(false)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={variantPending}
                  className="rounded bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {variantPending ? 'Saving...' : 'Save variant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}
