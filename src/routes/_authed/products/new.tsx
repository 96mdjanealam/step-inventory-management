import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { createProductSchema } from '../../../lib/schemas/product.ts'
import { createProductFn } from '../../../server/functions/products.ts'

export const Route = createFileRoute('/_authed/products/new')({
  component: NewProductPage,
})

const unitsByType = {
  count: ['piece'],
  weight: ['kg', 'g'],
  volume: ['litre', 'ml'],
} as const

type MeasurementType = keyof typeof unitsByType

const inputClass = 'rounded border px-3 py-2'

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {children}
      {error ? <span className="text-red-600">{error}</span> : null}
    </label>
  )
}

function NewProductPage() {
  const createProduct = useServerFn(createProductFn)
  const navigate = useNavigate()
  const [measurementType, setMeasurementType] =
    useState<MeasurementType>('count')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFieldErrors({})
    setFormError(null)

    const form = new FormData(event.currentTarget)
    const required = (name: string) => String(form.get(name) ?? '').trim()
    const optional = (name: string) => required(name) || undefined

    const parsed = createProductSchema.safeParse({
      name: required('name'),
      category: required('category'),
      targetConsumer: optional('targetConsumer'),
      measurementType,
      unit: optional('unit'),
      description: optional('description'),
      sku: optional('sku'),
      discountedPrice: optional('discountedPrice'),
      regularPrice: optional('regularPrice'),
    })

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        errors[key] ??= issue.message
      }
      setFieldErrors(errors)
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
    <main className="mx-auto max-w-xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New product</h1>
        <Link to="/products" className="text-sm underline">
          Back to products
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Name" error={fieldErrors.name}>
          <input name="name" className={inputClass} />
        </Field>

        <Field label="Category" error={fieldErrors.category}>
          <input name="category" className={inputClass} />
        </Field>

        <Field label="Target consumer" error={fieldErrors.targetConsumer}>
          <select name="targetConsumer" defaultValue="unisex" className={inputClass}>
            <option value="unisex">Unisex</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="kids">Kids</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Measured by" error={fieldErrors.measurementType}>
            <select
              value={measurementType}
              onChange={(e) =>
                setMeasurementType(e.target.value as MeasurementType)
              }
              className={inputClass}
            >
              <option value="count">Count</option>
              <option value="weight">Weight</option>
              <option value="volume">Volume</option>
            </select>
          </Field>

          <Field label="Unit" error={fieldErrors.unit}>
            <select name="unit" key={measurementType} className={inputClass}>
              {unitsByType[measurementType].map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Price" error={fieldErrors.discountedPrice}>
            <input
              name="discountedPrice"
              inputMode="decimal"
              placeholder="10.50"
              className={inputClass}
            />
          </Field>

          <Field label="Regular price (optional)" error={fieldErrors.regularPrice}>
            <input
              name="regularPrice"
              inputMode="decimal"
              placeholder="12.00"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="SKU (optional)" error={fieldErrors.sku}>
          <input name="sku" className={inputClass} />
        </Field>

        <Field label="Description (optional)" error={fieldErrors.description}>
          <textarea name="description" rows={3} className={inputClass} />
        </Field>

        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? 'Saving...' : 'Create product'}
        </button>
      </form>
    </main>
  )
}