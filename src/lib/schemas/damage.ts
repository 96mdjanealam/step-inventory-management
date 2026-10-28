import { z } from 'zod'

export const reportDamageSchema = z.object({
  sourceLocationId: z.string().uuid('Invalid source location ID'),
  variantId: z.string().uuid('Invalid variant ID'),
  quantity: z
    .string()
    .regex(
      /^\d+(\.\d{1,3})?$/,
      'Must be a valid positive quantity with up to 3 decimal places',
    )
    .refine((val) => Number(val) > 0, 'Quantity must be greater than 0'),
  reason: z
    .string()
    .trim()
    .min(3, 'Damage reason must be at least 3 characters')
    .max(500, 'Damage reason must be at most 500 characters'),
})

export const resolveDamageSchema = z
  .object({
    damageReportId: z.string().uuid('Invalid damage report ID'),
    action: z.enum(['repair', 'disposal']),
    resolutionLocationId: z.string().uuid('Invalid resolution target location ID').optional(),
    notes: z
      .string()
      .trim()
      .min(3, 'Resolution notes must be at least 3 characters')
      .max(500, 'Resolution notes must be at most 500 characters'),
  })
  .refine(
    (data) => {
      if (data.action === 'repair' && !data.resolutionLocationId) {
        return false
      }
      return true
    },
    {
      message: 'A target location is required when repairing damaged stock',
      path: ['resolutionLocationId'],
    },
  )

export const getDamageReportSchema = z.object({
  damageReportId: z.string().uuid('Invalid damage report ID'),
})

export const listDamageReportsSchema = z.object({
  locationId: z.string().uuid('Invalid location ID').optional(),
  status: z.enum(['quarantined', 'repaired', 'disposed']).optional(),
  search: z.string().trim().optional(),
  page: z.number().int().min(1).default(1).optional(),
  pageSize: z.number().int().min(1).max(100).default(20).optional(),
})

export type ReportDamageInput = z.infer<typeof reportDamageSchema>
export type ResolveDamageInput = z.infer<typeof resolveDamageSchema>
export type GetDamageReportInput = z.infer<typeof getDamageReportSchema>
export type ListDamageReportsInput = z.infer<typeof listDamageReportsSchema>

