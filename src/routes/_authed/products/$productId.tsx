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
import { ImageUploader } from '../../../components/ImageUploader.tsx'

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

function mapToAttributes(
  record: Record<string, string> | null | undefined,
): AttributeItem[] {
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

  // Product Images State for editing
  const [editImages, setEditImages] = useState<string[]>(product.images ?? [])
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState(0)

  // Variant Modal State
  const [showAddVariant, setShowAddVariant] = useState(false)
  const [editingVariant, setEditingVariant] = useState<
    (typeof product.variants)[number] | null
  >(null)
  const [variantPending, setVariantPending] = useState(false)
  const [variantError, setVariantError] = useState<string | null>(null)
  const [variantAttributes, setVariantAttributes] = useState<AttributeItem[]>([])
  const [variantImage, setVariantImage] = useState<string | undefined>(undefined)

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
          images: editImages,
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
    setVariantImage(undefined)
    setVariantError(null)
    setShowAddVariant(true)
  }

  function openEditVariant(v: (typeof product.variants)[number]) {
    setEditingVariant(v)
    const initialAttrs = mapToAttributes(v.attributes)
    setVariantAttributes(
      initialAttrs.length > 0 ? initialAttrs : [{ id: '1', key: '', value: '' }],
    )
    setVariantImage(v.image ?? undefined)
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
            image: variantImage,
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
            image: variantImage,
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

  const images = isEditing ? editImages : (product.images ?? [])
  const currentCover = images[selectedGalleryIndex] ?? images[0]

  return (
    <main className="mx-auto max-w-5xl p-6">
      {/* Header bar */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {product.name}
            </h1>
            {product.isActive ? (
              <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                Active
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                Archived
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">Slug: {product.slug}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/products"
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Back to products
          </Link>
          {isAdmin ? (
            <button
              type="button"
              disabled={actionPending}
              onClick={handleArchiveToggle}
              className={`rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 ${
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
            onClick={() => {
              if (isEditing) {
                setEditImages(product.images ?? [])
              }
              setIsEditing(!isEditing)
            }}
            className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
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

      {/* Main Overview Card: Left = Product Images, Right = Product Details */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Product Information & Media
        </h2>

        {isEditing ? (
          <form onSubmit={handleUpdate} className="flex flex-col gap-6">
            {formError ? (
              <p className="rounded bg-red-50 p-2 text-sm text-red-600">
                {formError}
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Image Uploader */}
              <div className="md:col-span-1">
                <ImageUploader
                  multiple={true}
                  value={editImages}
                  onChange={setEditImages}
                  label="Product Images"
                  helperText="Upload or remove photos. First image is used as the cover."
                />
              </div>

              {/* Editable Fields */}
              <div className="flex flex-col gap-4 md:col-span-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Name *
                  <input
                    name="name"
                    defaultValue={product.name}
                    required
                    className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
                  {fieldErrors.name ? (
                    <span className="text-xs text-red-600">
                      {fieldErrors.name}
                    </span>
                  ) : null}
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Category *
                    <input
                      name="category"
                      defaultValue={product.category}
                      required
                      className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    />
                    {fieldErrors.category ? (
                      <span className="text-xs text-red-600">
                        {fieldErrors.category}
                      </span>
                    ) : null}
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Target consumer
                    <select
                      name="targetConsumer"
                      defaultValue={product.targetConsumer}
                      className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    >
                      <option value="unisex">Unisex</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="kids">Kids</option>
                    </select>
                  </label>
                </div>

                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Description
                  <textarea
                    name="description"
                    defaultValue={product.description ?? ''}
                    rows={4}
                    className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
                </label>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setEditImages(product.images ?? [])
                      setIsEditing(false)
                    }}
                    className="rounded border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded bg-black px-5 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {pending ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Gallery View */}
            <div className="flex flex-col gap-3 md:col-span-1">
              <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                {currentCover ? (
                  <img
                    src={currentCover}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src =
                        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-gray-400">
                    <svg
                      className="h-10 w-10 mb-1"
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
                    <span className="text-xs">No photos uploaded</span>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedGalleryIndex(idx)}
                      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border transition-all ${
                        selectedGalleryIndex === idx
                          ? 'border-black ring-1 ring-black'
                          : 'border-gray-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details dl */}
            <div className="md:col-span-2">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Category</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    {product.category}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 uppercase">
                    Target Consumer
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900 capitalize">
                    {product.targetConsumer}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 uppercase">
                    Measurement & Unit
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    {product.measurementType} ({product.unit})
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Created At</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    {new Date(product.createdAt).toLocaleString()}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-gray-500 uppercase">Description</dt>
                  <dd className="mt-1 text-sm text-gray-700 whitespace-pre-line">
                    {product.description || (
                      <span className="italic text-gray-400">
                        No description provided.
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>

      {/* Variants Table Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Product Variants
            </h2>
            <p className="text-xs text-gray-500">
              Manage variants, photos, SKUs, dynamic attributes, and pricing.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddVariant}
            className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
          >
            + Add variant
          </button>
        </div>

        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-4 py-3 w-16">Image</th>
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
                    <td className="px-4 py-2.5">
                      <div className="h-10 w-10 overflow-hidden rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
                        {v.image ? (
                          <img
                            src={v.image}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).src =
                                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                            }}
                          />
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {v.sku || (
                        <span className="italic text-gray-400">No SKU</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {attrs.length === 0 ? (
                        <span className="text-xs text-gray-400">Standard</span>
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
                    <td className="px-4 py-3 font-medium text-gray-900">
                      ${v.discountedPrice}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {v.regularPrice ? (
                        `$${v.regularPrice}`
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {v.isDefault ? (
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
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
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleVariant(v)}
                          className={`text-xs font-medium hover:underline ${
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
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {editingVariant ? 'Edit Variant' : 'Add New Variant'}
            </h3>

            {variantError ? (
              <p className="mb-3 rounded bg-red-50 p-2 text-xs text-red-600 border border-red-200">
                {variantError}
              </p>
            ) : null}

            <form onSubmit={handleVariantSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  SKU (optional)
                  <input
                    name="sku"
                    defaultValue={editingVariant?.sku ?? ''}
                    placeholder="e.g. TSHIRT-BLU-L"
                    className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
                </label>

                <div>
                  <ImageUploader
                    multiple={false}
                    value={variantImage}
                    onChange={setVariantImage}
                    label="Variant Photo (optional)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Selling Price *
                  <input
                    name="discountedPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    defaultValue={editingVariant?.discountedPrice ?? ''}
                    placeholder="29.99"
                    className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Regular Price
                  <input
                    name="regularPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editingVariant?.regularPrice ?? ''}
                    placeholder="39.99"
                    className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
                </label>
              </div>

              {/* Attributes Section */}
              <div className="mt-1 flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700 uppercase">
                    Attributes (Size, Color, Material, etc.)
                  </span>
                  <button
                    type="button"
                    onClick={addAttributeRow}
                    className="text-xs font-medium text-blue-600 hover:underline"
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
                      className="w-1/2 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-black focus:outline-none"
                    />
                    <input
                      placeholder="Value (e.g. Medium)"
                      value={attr.value}
                      onChange={(e) =>
                        updateAttributeRow(attr.id, attr.key, e.target.value)
                      }
                      className="w-1/2 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-black focus:outline-none"
                    />
                    {variantAttributes.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeAttributeRow(attr.id)}
                        className="px-1 text-xs text-red-500 hover:text-red-700"
                        title="Remove"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="isDefault"
                  defaultChecked={editingVariant?.isDefault ?? false}
                  className="rounded border-gray-300"
                />
                Set as default variant
              </label>

              <div className="mt-4 flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddVariant(false)}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={variantPending}
                  className="rounded bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
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
