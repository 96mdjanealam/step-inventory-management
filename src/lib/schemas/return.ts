import { z } from 'zod'

export const returnItemInputSchema = z.object({
  saleItemId: z.string().uuid('Invalid sale item ID'),
  quantity: z
    .string()
    .regex(
      /^\d+(\.\d{1,3})?$/,
      'Must be a valid positive quantity with up to 3 decimal places',
    )
    .refine((val) => Number(val) > 0, 'Quantity must be greater than 0'),
})

export const createReturnSchema = z.object({
  saleId: z.string().uuid('Invalid sale ID'),
  reason: z
    .string()
    .trim()
    .min(3, 'Return reason must be at least 3 characters')
    .max(500, 'Return reason must be at most 500 characters'),
  items: z
    .array(returnItemInputSchema)
    .min(1, 'Return must include at least one item'),
})

export const getReturnSchema = z.object({
  returnId: z.string().uuid('Invalid return ID'),
})

export const listReturnsSchema = z.object({
  saleId: z.string().uuid('Invalid sale ID').optional(),
  locationId: z.string().uuid('Invalid location ID').optional(),
  search: z.string().trim().optional(),
  page: z.number().int().min(1).default(1).optional(),
  pageSize: z.number().int().min(1).max(100).default(20).optional(),
})

export type ReturnItemInput = z.infer<typeof returnItemInputSchema>
export type CreateReturnInput = z.infer<typeof createReturnSchema>
export type GetReturnInput = z.infer<typeof getReturnSchema>
export type ListReturnsInput = z.infer<typeof listReturnsSchema>

