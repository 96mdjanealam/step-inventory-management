import { z } from 'zod'

const quantityPattern = /^\d+(\.\d{1,3})?$/

export const addStockSchema = z.object({
  variantId: z.uuid(),
  locationId: z.uuid(),
  quantity: z
    .string()
    .trim()
    .regex(quantityPattern, 'Enter a valid positive quantity (up to 3 decimal places)')
    .refine((q) => Number(q) > 0, 'Quantity must be greater than zero'),
  reason: z.string().trim().min(1).optional(),
})
export type AddStockInput = z.output<typeof addStockSchema>

export const adjustStockSchema = z.object({
  variantId: z.uuid(),
  locationId: z.uuid(),
  adjustmentType: z.enum(['increase', 'decrease']),
  quantity: z
    .string()
    .trim()
    .regex(quantityPattern, 'Enter a valid positive quantity (up to 3 decimal places)')
    .refine((q) => Number(q) > 0, 'Quantity must be greater than zero'),
  reason: z
    .string()
    .trim()
    .min(3, 'A clear reason is required for inventory adjustments'),
})
export type AdjustStockInput = z.output<typeof adjustStockSchema>

export const listInventorySchema = z.object({
  locationId: z.uuid().optional(),
  productId: z.uuid().optional(),
  search: z.string().trim().min(1).optional(),
  includeZeroQuantity: z.boolean().default(false).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})
export type ListInventoryInput = z.input<typeof listInventorySchema>
export type ListInventoryOutput = z.output<typeof listInventorySchema>

export const listStockMovementsSchema = z.object({
  type: z
    .enum([
      'inflow',
      'transfer',
      'sale',
      'return',
      'adjustment',
      'damage',
      'repair',
      'disposal',
    ])
    .optional(),
  locationId: z.uuid().optional(),
  productId: z.uuid().optional(),
  variantId: z.uuid().optional(),
  search: z.string().trim().min(1).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})
export type ListStockMovementsInput = z.input<typeof listStockMovementsSchema>
export type ListStockMovementsOutput = z.output<typeof listStockMovementsSchema>


