import { z } from 'zod'

const unitsByType = {
  count: ['piece'],
  weight: ['kg', 'g'],
  volume: ['litre', 'ml'],
} as const

const price = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Use a price like 10 or 10.50')

export const variantInputSchema = z
  .object({
    sku: z.string().trim().min(1).optional(),
    attributes: z.record(z.string(), z.string()).default({}),
    image: z.string().trim().min(1).optional(),
    discountedPrice: price,
    regularPrice: price.optional(),
  })
  .refine(
    (v) =>
      v.regularPrice === undefined ||
      Number(v.regularPrice) >= Number(v.discountedPrice),
    {
      message: 'Regular price cannot be below the discounted price',
      path: ['regularPrice'],
    },
  )

export const createProductSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    category: z.string().trim().min(1, 'Category is required'),
    targetConsumer: z.enum(['male', 'female', 'unisex', 'kids']).default('unisex'),
    measurementType: z.enum(['count', 'weight', 'volume']).default('count'),
    unit: z.enum(['piece', 'kg', 'g', 'litre', 'ml']).default('piece'),
    description: z.string().trim().min(1).optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes')
      .optional(),
    // Custom variants. If empty, one default variant is created from the fields below.
    variants: z.array(variantInputSchema).default([]),
    sku: z.string().trim().min(1).optional(),
    discountedPrice: price.optional(),
    regularPrice: price.optional(),
  })
  .refine(
    (p) => (unitsByType[p.measurementType] as readonly string[]).includes(p.unit),
    { message: 'Unit does not match the measurement type', path: ['unit'] },
  )
  .refine((p) => p.variants.length > 0 || p.discountedPrice !== undefined, {
    message: 'A price is required when no variants are given',
    path: ['discountedPrice'],
  })
  .refine(
    (p) =>
      p.regularPrice === undefined ||
      p.discountedPrice === undefined ||
      Number(p.regularPrice) >= Number(p.discountedPrice),
    {
      message: 'Regular price cannot be below the discounted price',
      path: ['regularPrice'],
    },
  )

export type CreateProductInput = z.output<typeof createProductSchema>

export const listProductsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  includeArchived: z.boolean().default(false),
})

export const archiveProductSchema = z.object({
  id: z.uuid(),
})

export type ListProductsInput = z.output<typeof listProductsSchema>