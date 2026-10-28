import { createServerFn } from '@tanstack/react-start'
import {
  createStoreSchema,
  listLocationsSchema,
  toggleLocationActiveSchema,
  updateLocationSchema,
} from '../../lib/schemas/location.ts'
import { requireAdmin, requireUser } from '../middleware/auth.ts'
import {
  createStore,
  listLocations,
  toggleLocationActive,
  updateLocation,
} from '../services/locations.ts'

export const listLocationsFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listLocationsSchema)
  .handler(async ({ data }) => listLocations(data))

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

