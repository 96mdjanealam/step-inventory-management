import { z } from 'zod'

export const createStoreSchema = z.object({
  name: z.string().trim().min(1, 'Location name is required'),
  storeType: z.enum(['ownstore', 'franchise']),
  address: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
})
export type CreateStoreInput = z.output<typeof createStoreSchema>

export const updateLocationSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, 'Location name is required'),
  address: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
})
export type UpdateLocationInput = z.output<typeof updateLocationSchema>

export const listLocationsSchema = z.object({
  type: z.enum(['warehouse', 'store', 'damaged']).optional(),
  storeType: z.enum(['ownstore', 'franchise']).optional(),
  includeInactive: z.boolean().default(false),
  search: z.string().trim().min(1).optional(),
})
export type ListLocationsInput = z.input<typeof listLocationsSchema>

export const toggleLocationActiveSchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
})
export type ToggleLocationActiveInput = z.output<
  typeof toggleLocationActiveSchema
>

