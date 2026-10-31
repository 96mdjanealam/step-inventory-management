import { createServerFn } from '@tanstack/react-start'
import {
  createStoreSchema,
  listLocationsPaginatedSchema,
  listLocationsSchema,
  toggleLocationActiveSchema,
  updateLocationSchema,
} from '../../lib/schemas/location.ts'
import { requireAdmin, requireUser } from '../middleware/auth.ts'
import {
  createStore,
  listLocations,
  listLocationsPaginated,
  listLocationsWithStock,
  toggleLocationActive,
  updateLocation,
} from '../services/locations.ts'

export const listLocationsFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listLocationsSchema)
  .handler(async ({ data }) => listLocations(data))

export const listLocationsPaginatedFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listLocationsPaginatedSchema)
  .handler(async ({ data }) => listLocationsPaginated(data))

export const listLocationsWithStockFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listLocationsSchema)
  .handler(async ({ data }) => listLocationsWithStock(data))

export const createStoreFn = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(createStoreSchema)
  .handler(async ({ data, context }) => createStore(data, context.user.id))

export const updateLocationFn = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(updateLocationSchema)
  .handler(async ({ data, context }) => updateLocation(data, context.user.id))

export const toggleLocationActiveFn = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(toggleLocationActiveSchema)
  .handler(async ({ data, context }) =>
    toggleLocationActive(data, context.user.id),
  )

