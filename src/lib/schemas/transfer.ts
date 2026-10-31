import { z } from 'zod'

const quantityPattern = /^\d+(\.\d{1,3})?$/

export const transferItemInputSchema = z.object({
  variantId: z.string().uuid('Valid variant ID is required'),
  quantity: z
    .string()
    .trim()
    .regex(quantityPattern, 'Enter a valid positive quantity (up to 3 decimal places)')
    .refine((q) => Number(q) > 0, 'Quantity must be greater than zero'),
})

export type TransferItemInput = z.infer<typeof transferItemInputSchema>

export const createTransferSchema = z
  .object({
    sourceLocationId: z.string().uuid('Source location is required'),
    destinationLocationId: z.string().uuid('Destination location is required'),
    notes: z.string().trim().min(1).optional(),
    items: z.array(transferItemInputSchema).min(1).optional(),
    // Backward compatibility for single-item calls
    variantId: z.string().uuid().optional(),
    quantity: z
      .string()
      .trim()
      .regex(quantityPattern, 'Enter a valid positive quantity (up to 3 decimal places)')
      .refine((q) => Number(q) > 0, 'Quantity must be greater than zero')
      .optional(),
  })
  .refine(
    (data) => data.sourceLocationId !== data.destinationLocationId,
    {
      message: 'Source and destination locations must be different',
      path: ['destinationLocationId'],
    },
  )
  .refine(
    (data) => (data.items && data.items.length > 0) || (data.variantId && data.quantity),
    {
      message: 'At least one item must be provided for transfer',
      path: ['items'],
    },
  )

export type CreateTransferInput = z.output<typeof createTransferSchema>

export const listTransfersSchema = z.object({
  locationId: z.uuid().optional(),
  variantId: z.uuid().optional(),
  search: z.string().trim().min(1).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export type ListTransfersInput = z.input<typeof listTransfersSchema>
export type ListTransfersOutput = z.output<typeof listTransfersSchema>

export const getLocationStockSchema = z.object({
  locationId: z.string().uuid('Valid location ID is required'),
})

export type GetLocationStockInput = z.infer<typeof getLocationStockSchema>

