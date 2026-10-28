import { z } from 'zod'

const quantityPattern = /^\d+(\.\d{1,3})?$/

export const createTransferSchema = z
  .object({
    variantId: z.uuid('Valid variant ID is required'),
    sourceLocationId: z.uuid('Source location is required'),
    destinationLocationId: z.uuid('Destination location is required'),
    quantity: z
      .string()
      .trim()
      .regex(quantityPattern, 'Enter a valid positive quantity (up to 3 decimal places)')
      .refine((q) => Number(q) > 0, 'Quantity must be greater than zero'),
    notes: z.string().trim().min(1).optional(),
  })
  .refine(
    (data) => data.sourceLocationId !== data.destinationLocationId,
    {
      message: 'Source and destination locations must be different',
      path: ['destinationLocationId'],
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

