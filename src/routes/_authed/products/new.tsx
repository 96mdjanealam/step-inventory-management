import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Plus } from 'lucide-react'
import { Button, LinkButton } from '../../../components/Button.tsx'
import { Alert } from '../../../components/Alert.tsx'
import {
  ImageUploader,
  type UploadableImage,
  processUploadableImage,
  processUploadableImages,
} from '../../../components/ImageUploader.tsx'
import { PriceInput } from '../../../components/PriceInput.tsx'
import { Select } from '../../../components/Select.tsx'
import { createProductSchema } from '../../../lib/schemas/product.ts'
import { createProductFn } from '../../../server/functions/products.ts'
import { uploadImageFn } from '../../../server/functions/upload.ts'

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
  'w-full h-10 border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white'
const textareaClass =
  'w-full border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white resize-y'

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
  image?: UploadableImage
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
  const uploadImage = useServerFn(uploadImageFn)
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
  const [productImages, setProductImages] = useState<UploadableImage[]>([])

  // Variant Mode State
  const [hasVariants, setHasVariants] = useState(false)

  // Single Variant Form State
  const [singleSku, setSingleSku] = useState('')
  const [singleDiscountedPrice, setSingleDiscountedPrice] = useState('')
  const [singleRegularPrice, setSingleRegularPrice] = useState('')
  const [singleImage, setSingleImage] = useState<UploadableImage | undefined>(undefined)

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

    // Build provisional validation payload
    let payload: any = {
      name: name.trim(),
      category: category.trim(),
      targetConsumer,
      measurementType,
      unit,
      description: description.trim() || undefined,
      images: [], // validate basic fields before uploading files
    }

    if (!hasVariants) {
      // Single variant mode
      payload.sku = singleSku.trim() || undefined
      payload.discountedPrice = singleDiscountedPrice.trim() || undefined
      payload.regularPrice = singleRegularPrice.trim() || undefined
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
      // Upload pending product images in parallel (only uploaded on confirmed save!)
      const uploadedProductImages = await processUploadableImages(
        productImages,
        uploadImage,
      )

      let uploadedSingleImage: string | undefined = undefined
      let uploadedVariants = payload.variants

      if (!hasVariants) {
        uploadedSingleImage = await processUploadableImage(
          singleImage,
          uploadImage,
        )
      } else {
        uploadedVariants = await Promise.all(
          variants.map(async (v) => {
            const uploadedVarImg = await processUploadableImage(
              v.image,
              uploadImage,
            )
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
              image: uploadedVarImg,
              discountedPrice: v.discountedPrice.trim(),
              regularPrice: v.regularPrice.trim() || undefined,
            }
          }),
        )
      }

      const finalData = {
        ...parsed.data,
        images: uploadedProductImages,
        image: uploadedSingleImage,
        variants: hasVariants ? uploadedVariants : [],
      }

      await createProduct({ data: finalData })
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
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Create New Product
          </h1>
          <p className="text-xs text-neutral-500">
            Add a new product with images and optional variants to your inventory.
          </p>
        </div>
        <Link
          to="/products"
          className="self-start sm:self-auto border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Back to products
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Section 1: General Information */}
        <section className="border border-neutral-200 bg-white p-5 shadow-xs">
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
                <Select
                  value={targetConsumer}
                  onChange={(e) => setTargetConsumer(e.target.value as any)}
                  className="w-full"
                >
                  <option value="unisex">Unisex</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="kids">Kids</option>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Measured By" error={fieldErrors.measurementType}>
                <Select
                  value={measurementType}
                  onChange={(e) => {
                    const newType = e.target.value as MeasurementType
                    setMeasurementType(newType)
                    setUnit(unitsByType[newType][0])
                  }}
                  className="w-full"
                >
                  <option value="count">Count (Units / Pieces)</option>
                  <option value="weight">Weight (kg / g)</option>
                  <option value="volume">Volume (litre / ml)</option>
                </Select>
              </Field>

              <Field label="Inventory Unit" error={fieldErrors.unit}>
                <Select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full"
                >
                  {unitsByType[measurementType].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Description" error={fieldErrors.description}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Product description, materials, care instructions..."
                className={textareaClass}
              />
            </Field>
          </div>
        </section>

        {/* Section 2: Media / Product Images */}
        <section className="border border-neutral-200 bg-white p-5 shadow-xs">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-brand-charcoal">
              2. Product Images (Gallery)
            </h2>
            <p className="text-xs text-neutral-500">
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
        <section className="border border-neutral-200 bg-white p-5 shadow-xs">
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
            <div className="mt-2 w-full sm:w-auto flex bg-neutral-100 p-1 sm:mt-0">
              <button
                type="button"
                onClick={() => setHasVariants(false)}
                className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-medium transition-colors text-center ${
                  !hasVariants
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Simple Product
              </button>
              <button
                type="button"
                onClick={() => setHasVariants(true)}
                className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-medium transition-colors text-center ${
                  hasVariants
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Multiple Variants
              </button>
            </div>
          </div>

          {/* Mode A: Simple Product (Single Variant) */}
          {!hasVariants && (
            <div className="flex flex-col gap-4 border-t border-neutral-200 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field
                  label="Selling Price"
                  error={fieldErrors.discountedPrice}
                  required
                >
                  <PriceInput
                    value={singleDiscountedPrice}
                    onValueChange={(val) => setSingleDiscountedPrice(val)}
                    placeholder="29.99"
                    required
                  />
                </Field>

                <Field
                  label="Regular Price"
                  error={fieldErrors.regularPrice}
                >
                  <PriceInput
                    value={singleRegularPrice}
                    onValueChange={(val) => setSingleRegularPrice(val)}
                    placeholder="39.99"
                  />
                </Field>

                <Field label="SKU" error={fieldErrors.sku}>
                  <input
                    value={singleSku}
                    onChange={(e) => setSingleSku(e.target.value)}
                    placeholder="e.g. PRD-001"
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="border-t border-neutral-200/70 pt-3">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-600">
                  Variant Photo
                </label>
                <ImageUploader
                  multiple={false}
                  value={singleImage}
                  onChange={setSingleImage}
                />
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
                  className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Variant
                </button>
              </div>

              {variants.map((v, vIdx) => (
                <div
                  key={v.id}
                  className="border border-neutral-200 bg-neutral-50/60 p-4 transition-all"
                >
                  <div className="mb-3 flex items-center justify-between border-b border-neutral-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-brand-charcoal px-2 py-0.5 text-xs font-bold text-white">
                        #{vIdx + 1}
                      </span>
                      <span className="text-xs font-semibold text-brand-charcoal">
                        {vIdx === 0 ? 'Primary Default Variant' : `Variant ${vIdx + 1}`}
                      </span>
                    </div>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(vIdx)}
                        className="text-xs text-rose-600 hover:text-rose-800 underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Attributes builder for this variant */}
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                        Attributes (Size, Color, etc.)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddAttribute(vIdx)}
                        className="inline-flex items-center gap-1 text-xs text-brand-primary hover:text-brand-dark font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Attribute
                      </button>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {v.attributes.map((attr, aIdx) => (
                        <div
                          key={attr.id}
                          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 sm:p-0 bg-neutral-100/60 sm:bg-transparent border sm:border-0 border-neutral-200"
                        >
                          <div className="w-full sm:w-2/5 flex items-center gap-2">
                            <span className="text-[11px] font-medium text-neutral-500 sm:hidden w-12 shrink-0">
                              Name:
                            </span>
                            <input
                              type="text"
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
                              className="w-full border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-primary focus:outline-none"
                            />
                          </div>

                          <div className="w-full sm:flex-1 flex items-center gap-2">
                            <span className="text-[11px] font-medium text-neutral-500 sm:hidden w-12 shrink-0">
                              Value:
                            </span>
                            <input
                              type="text"
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
                              className="w-full flex-1 border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-primary focus:outline-none"
                            />
                            {v.attributes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveAttribute(vIdx, aIdx)}
                                className="text-neutral-400 hover:text-brand-primary text-xs p-1.5 hover:bg-neutral-200/60 cursor-pointer shrink-0 transition"
                                title="Delete attribute"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing & SKU for this variant */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">
                        Selling Price <span className="text-red-500">*</span>
                      </label>
                      <PriceInput
                        value={v.discountedPrice}
                        onValueChange={(val) =>
                          updateVariantField(vIdx, 'discountedPrice', val)
                        }
                        placeholder="29.99"
                        required
                      />
                      {fieldErrors[`variants.${vIdx}.discountedPrice`] && (
                        <span className="text-[10px] text-red-600">
                          {fieldErrors[`variants.${vIdx}.discountedPrice`]}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">
                        Regular Price
                      </label>
                      <PriceInput
                        value={v.regularPrice}
                        onValueChange={(val) =>
                          updateVariantField(vIdx, 'regularPrice', val)
                        }
                        placeholder="39.99"
                      />
                      {fieldErrors[`variants.${vIdx}.regularPrice`] && (
                        <span className="text-[10px] text-red-600">
                          {fieldErrors[`variants.${vIdx}.regularPrice`]}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">
                        SKU
                      </label>
                      <input
                        value={v.sku}
                        onChange={(e) =>
                          updateVariantField(vIdx, 'sku', e.target.value)
                        }
                        placeholder="e.g. TSH-M-RED"
                        className={inputClass}
                      />
                      {fieldErrors[`variants.${vIdx}.sku`] && (
                        <span className="text-[10px] text-red-600">
                          {fieldErrors[`variants.${vIdx}.sku`]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dedicated Variant Photo Section */}
                  <div className="mt-3.5 border-t border-neutral-200/70 pt-3">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-600">
                      Variant Photo
                    </label>
                    <ImageUploader
                      multiple={false}
                      value={v.image}
                      onChange={(url) => updateVariantField(vIdx, 'image', url)}
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddVariant}
                className="flex items-center justify-center gap-1.5 border-2 border-dashed border-neutral-300 bg-white py-2.5 text-xs font-semibold text-neutral-700 hover:border-brand-primary hover:text-brand-primary hover:bg-brand-bg/30 cursor-pointer transition shadow-2xs"
              >
                <Plus className="h-4 w-4" />
                Add Another Variant
              </button>
            </div>
          )}
        </section>

        {formError ? (
          <Alert variant="error" onClose={() => setFormError(null)}>
            {formError}
          </Alert>
        ) : null}

        <div className="flex justify-end gap-3 pt-2">
          <LinkButton
            to="/products"
            variant="secondary"
          >
            Cancel
          </LinkButton>
          <Button
            type="submit"
            isLoading={pending}
          >
            Create Product
          </Button>
        </div>
      </form>
    </main>
  )
}
