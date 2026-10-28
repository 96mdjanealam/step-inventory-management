import { z } from 'zod'

export const saleItemInputSchema = z.object({
  variantId: z.string().uuid('Invalid variant ID'),
  quantity: z
    .string()
    .regex(
      /^\d+(\.\d{1,3})?$/,
      'Must be a valid positive quantity with up to 3 decimal places',
    )
    .refine((val) => Number(val) > 0, 'Quantity must be greater than 0'),
})

export const createSaleSchema = z.object({
  locationId: z.string().uuid('Invalid location ID'),
  customerName: z.string().trim().optional(),
  customerPhone: z.string().trim().optional(),
  items: z.array(saleItemInputSchema).min(1, 'Sale must include at least one item'),
  notes: z.string().trim().optional(),
})

export const cancelSaleSchema = z.object({
  saleId: z.string().uuid('Invalid sale ID'),
  reason: z
    .string()
    .trim()
    .min(3, 'Cancellation reason must be at least 3 characters')
    .max(500, 'Cancellation reason must be at most 500 characters'),
})

export const getSaleSchema = z.object({
  saleId: z.string().uuid('Invalid sale ID'),
})

export const listSalesSchema = z.object({
  locationId: z.string().uuid('Invalid location ID').optional(),
  status: z.enum(['completed', 'cancelled']).optional(),
  search: z.string().trim().optional(),
  page: z.number().int().min(1).default(1).optional(),
  pageSize: z.number().int().min(1).max(100).default(20).optional(),
})

export type SaleItemInput = z.infer<typeof saleItemInputSchema>
export type CreateSaleInput = z.infer<typeof createSaleSchema>
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>
export type GetSaleInput = z.infer<typeof getSaleSchema>
export type ListSalesInput = z.infer<typeof listSalesSchema>

