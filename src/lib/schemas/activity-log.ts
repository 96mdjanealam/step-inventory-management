import { z } from 'zod'

export const logActivitySchema = z.object({
  userId: z.uuid().optional(),
  action: z.string().trim().min(1),
  entityType: z.string().trim().min(1),
  entityId: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1),
  metadata: z.record(z.string(), z.any()).default({}),
  sourceLocationId: z.uuid().optional(),
  destinationLocationId: z.uuid().optional(),
})

export type LogActivityInput = z.input<typeof logActivitySchema>

export const listActivityLogsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  action: z.string().trim().min(1).optional(),
  entityType: z.string().trim().min(1).optional(),
  userId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export type ListActivityLogsInput = z.input<typeof listActivityLogsSchema>
export type ListActivityLogsOutput = z.output<typeof listActivityLogsSchema>
