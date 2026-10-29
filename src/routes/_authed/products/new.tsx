import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { createProductSchema } from '../../../lib/schemas/product.ts'
import { createProductFn } from '../../../server/functions/products.ts'
import { ImageUploader } from '../../../components/ImageUploader.tsx'

export const Route = createFileRoute('/_authed/products/new')({
  component: NewProductPage,
})

const unitsByType = {
  count: ['piece'],
  weight: ['kg', 'g'],
  volume: ['litre', 'ml'],
} as const

type MeasurementType = keyof typeof unitsByType

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black'

interface AttributeItem {
  id: string
  key: string
  value: string
}

interface VariantFormItem {
  id: string
  sku: string
  discountedPrice: string
  regularPrice: string
  image?: string
  attributes: AttributeItem[]
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      <span>
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  )
}

function NewProductPage() {
  const createProduct = useServerFn(createProductFn)
  const navigate = useNavigate()

  // Basic Info State
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [targetConsumer, setTargetConsumer] = useState<
    'male' | 'female' | 'unisex' | 'kids'
  >('unisex')
  const [measurementType, setMeasurementType] =
    useState<MeasurementType>('count')
  const [unit, setUnit] = useState<string>('piece')
  const [description, setDescription] = useState('')
  const [productImages, setProductImages] = useState<string[]>([])

  // Variant Mode State
  const [hasVariants, setHasVariants] = useState(false)

  // Single Variant Form State
  const [singleSku, setSingleSku] = useState('')
  const [singleDiscountedPrice, setSingleDiscountedPrice] = useState('')
  const [singleRegularPrice, setSingleRegularPrice] = useState('')
  const [singleImage, setSingleImage] = useState<string | undefined>(undefined)

  // Multi-Variant Form State
  const [variants, setVariants] = useState<VariantFormItem[]>([
    {
      id: 'var-1',
      sku: '',
      discountedPrice: '',
      regularPrice: '',
      image: undefined,
      attributes: [{ id: 'attr-1', key: 'Size', value: 'Standard' }],
    },
  ])

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Add / Remove Variant
  function handleAddVariant() {
    setVariants((prev) => [
      ...prev,
      {
        id: `var-${Date.now()}`,
        sku: '',
        discountedPrice: prev[0]?.discountedPrice ?? '',
        regularPrice: prev[0]?.regularPrice ?? '',
        image: undefined,
        attributes: [{ id: `attr-${Date.now()}`, key: 'Size', value: '' }],
      },
    ])
  }

  function handleRemoveVariant(indexToRemove: number) {
    if (variants.length <= 1) return
    setVariants((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  function updateVariantField(
    index: number,
    field: keyof Omit<VariantFormItem, 'id' | 'attributes'>,
    value: string | undefined,
  ) {
    setVariants((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  // Attributes manipulation within a variant
  function handleAddAttribute(variantIndex: number) {
    setVariants((prev) => {
      const copy = [...prev]
      copy[variantIndex] = {
        ...copy[variantIndex],
        attributes: [
          ...copy[variantIndex].attributes,
          { id: `attr-${Date.now()}-${Math.random()}`, key: '', value: '' },
        ],
      }
      return copy
    })
  }

  function handleRemoveAttribute(variantIndex: number, attrIndex: number) {
    setVariants((prev) => {
      const copy = [...prev]
      copy[variantIndex] = {
        ...copy[variantIndex],
        attributes: copy[variantIndex].attributes.filter(
          (_, i) => i !== attrIndex,
        ),
      }
      return copy
    })
  }

  function handleUpdateAttribute(
    variantIndex: number,
    attrIndex: number,
    key: string,
    value: string,
  ) {
    setVariants((prev) => {
      const copy = [...prev]
      const attrs = [...copy[variantIndex].attributes]
      attrs[attrIndex] = { ...attrs[attrIndex], key, value }
      copy[variantIndex] = { ...copy[variantIndex], attributes: attrs }
      return copy
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFieldErrors({})
    setFormError(null)

    // Build payload
    let payload: any = {
      name: name.trim(),
      category: category.trim(),
      targetConsumer,
      measurementType,
      unit,
      description: description.trim() || undefined,
      images: productImages,
    }

    if (!hasVariants) {
      // Single variant mode
      payload.sku = singleSku.trim() || undefined
      payload.discountedPrice = singleDiscountedPrice.trim() || undefined
      payload.regularPrice = singleRegularPrice.trim() || undefined
      payload.image = singleImage || undefined
      payload.variants = []
    } else {
      // Multi-variant mode
      const parsedVariants = variants.map((v) => {
        const attrMap: Record<string, string> = {}
        for (const attr of v.attributes) {
          const k = attr.key.trim()
          const val = attr.value.trim()
          if (k && val) {
            attrMap[k] = val
          }
        }
        return {
          sku: v.sku.trim() || undefined,
          attributes: attrMap,
          image: v.image || undefined,
          discountedPrice: v.discountedPrice.trim(),
          regularPrice: v.regularPrice.trim() || undefined,
        }
      })

      payload.variants = parsedVariants
    }

    const parsed = createProductSchema.safeParse(payload)

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'form'
        errors[key] = issue.message
      }
      setFieldErrors(errors)
      setFormError('Please check the form for errors before saving.')
      return
    }

    setPending(true)
    try {
      await createProduct({ data: parsed.data })
      await navigate({ to: '/products' })
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Could not create the product',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Create New Product
          </h1>
          <p className="text-xs text-gray-500">
            Add a new product with images and optional variants to your inventory.
          </p>
        </div>
        <Link
          to="/products"
          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to products
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Section 1: General Information */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            1. General Information
          </h2>

          <div className="flex flex-col gap-4">
            <Field label="Product Name" error={fieldErrors.name} required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vintage Denim Jacket"
                className={inputClass}
                required
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Category" error={fieldErrors.category} required>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Apparel, Footwear, Electronics"
                  className={inputClass}
                  required
                />
              </Field>

              <Field label="Target Consumer" error={fieldErrors.targetConsumer}>
                <select
                  value={targetConsumer}
                  onChange={(e) => setTargetConsumer(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="unisex">Unisex</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="kids">Kids</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Measured By" error={fieldErrors.measurementType}>
                <select
                  value={measurementType}
                  onChange={(e) => {
                    const newType = e.target.value as MeasurementType
                    setMeasurementType(newType)
                    setUnit(unitsByType[newType][0])
                  }}
                  className={inputClass}
                >
                  <option value="count">Count (Units / Pieces)</option>
                  <option value="weight">Weight (kg / g)</option>
                  <option value="volume">Volume (litre / ml)</option>
                </select>
              </Field>

              <Field label="Inventory Unit" error={fieldErrors.unit}>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className={inputClass}
                >
                  {unitsByType[measurementType].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Description (optional)" error={fieldErrors.description}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Product description, materials, care instructions..."
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        {/* Section 2: Media / Product Images */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-gray-900">
              2. Product Images (Gallery)
            </h2>
            <p className="text-xs text-gray-500">
              Upload one or more photos. The first image will be used as the primary catalog cover.
            </p>
          </div>

          <ImageUploader
            multiple={true}
            value={productImages}
            onChange={setProductImages}
          />
        </section>

        {/* Section 3: Pricing & Variants Configuration */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                3. Pricing & Variants
              </h2>
              <p className="text-xs text-gray-500">
                Configure prices and choose whether this product comes in multiple variations.
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="mt-2 flex rounded-md bg-gray-100 p-1 sm:mt-0">
              <button
                type="button"
                onClick={() => setHasVariants(false)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  !hasVariants
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Simple Product
              </button>
              <button
                type="button"
                onClick={() => setHasVariants(true)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  hasVariants
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Multiple Variants
              </button>
            </div>
          </div>

          {/* Mode A: Simple Product (Single Variant) */}
          {!hasVariants && (
            <div className="flex flex-col gap-4 border-t pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Selling Price"
                  error={fieldErrors.discountedPrice}
                  required
                >
                  <input
                    value={singleDiscountedPrice}
                    onChange={(e) => setSingleDiscountedPrice(e.target.value)}
                    inputMode="decimal"
                    placeholder="29.99"
                    className={inputClass}
                    required
                  />
                </Field>

                <Field
                  label="Regular / Original Price (optional)"
                  error={fieldErrors.regularPrice}
                >
                  <input
                    value={singleRegularPrice}
                    onChange={(e) => setSingleRegularPrice(e.target.value)}
                    inputMode="decimal"
                    placeholder="39.99"
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="SKU (optional)" error={fieldErrors.sku}>
                  <input
                    value={singleSku}
                    onChange={(e) => setSingleSku(e.target.value)}
                    placeholder="e.g. PRD-001"
                    className={inputClass}
                  />
                </Field>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Variant Photo (optional)
                  </label>
                  <ImageUploader
                    multiple={false}
                    value={singleImage}
                    onChange={setSingleImage}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mode B: Multiple Variants List */}
          {hasVariants && (
            <div className="flex flex-col gap-5 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Configure sizes, colors, prices, and SKUs for each variant.
                </span>
                <button
                  type="button"
                  onClick={handleAddVariant}
                  className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-200"
                >
                  + Add Variant
                </button>
              </div>

              {variants.map((v, vIdx) => (
                <div
                  key={v.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4 transition-all"
                >
                  <div className="mb-3 flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-black px-2 py-0.5 text-xs font-bold text-white">
                        #{vIdx + 1}
                      </span>
                      <span className="text-xs font-semibold text-gray-800">
                        {vIdx === 0 ? 'Primary Default Variant' : `Variant ${vIdx + 1}`}
                      </span>
                    </div>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(vIdx)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Attributes builder for this variant */}
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600 uppercase">
                        Attributes (Size, Color, etc.)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddAttribute(vIdx)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        + Add Attribute
                      </button>
                    </div>

                    <div className="flex flex-col gap-2">
                      {v.attributes.map((attr, aIdx) => (
                        <div key={attr.id} className="flex items-center gap-2">
                          <input
                            placeholder="Name (e.g. Size, Color)"
                            value={attr.key}
                            onChange={(e) =>
                              handleUpdateAttribute(
                                vIdx,
                                aIdx,
                                e.target.value,
                                attr.value,
                              )
                            }
                            className="w-1/3 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs focus:border-black focus:outline-none"
                          />
                          <input
                            placeholder="Value (e.g. Medium, Red)"
                            value={attr.value}
                            onChange={(e) =>
                              handleUpdateAttribute(
                                vIdx,
                                aIdx,
                                attr.key,
                                e.target.value,
                              )
                            }
                            className="flex-1 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs focus:border-black focus:outline-none"
                          />
                          {v.attributes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveAttribute(vIdx, aIdx)}
                              className="text-gray-400 hover:text-red-600 text-xs px-1"
                              title="Delete attribute"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing, SKU & Image for this variant */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 items-end">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Selling Price *
                      </label>
                      <input
                        value={v.discountedPrice}
                        onChange={(e) =>
                          updateVariantField(vIdx, 'discountedPrice', e.target.value)
                        }
                        inputMode="decimal"
                        placeholder="29.99"
                        className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs focus:border-black focus:outline-none"
                        required
                      />
                      {fieldErrors[`variants.${vIdx}.discountedPrice`] && (
                        <span className="text-[10px] text-red-600">
                          {fieldErrors[`variants.${vIdx}.discountedPrice`]}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Regular Price
                      </label>
                      <input
                        value={v.regularPrice}
                        onChange={(e) =>
                          updateVariantField(vIdx, 'regularPrice', e.target.value)
                        }
                        inputMode="decimal"
                        placeholder="39.99"
                        className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs focus:border-black focus:outline-none"
                      />
                      {fieldErrors[`variants.${vIdx}.regularPrice`] && (
                        <span className="text-[10px] text-red-600">
                          {fieldErrors[`variants.${vIdx}.regularPrice`]}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        SKU (optional)
                      </label>
                      <input
                        value={v.sku}
                        onChange={(e) =>
                          updateVariantField(vIdx, 'sku', e.target.value)
                        }
                        placeholder="e.g. TSH-M-RED"
                        className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs focus:border-black focus:outline-none"
                      />
                      {fieldErrors[`variants.${vIdx}.sku`] && (
                        <span className="text-[10px] text-red-600">
                          {fieldErrors[`variants.${vIdx}.sku`]}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Variant Image
                      </label>
                      <ImageUploader
                        multiple={false}
                        value={v.image}
                        onChange={(url) => updateVariantField(vIdx, 'image', url)}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddVariant}
                className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 py-2.5 text-xs font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Another Variant
              </button>
            </div>
          )}
        </section>

        {formError ? (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
            {formError}
          </div>
        ) : null}

        <div className="flex justify-end gap-3 pt-2">
          <Link
            to="/products"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-black px-6 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {pending ? 'Saving Product...' : 'Create Product'}
          </button>
        </div>
      </form>
    </main>
  )
}
