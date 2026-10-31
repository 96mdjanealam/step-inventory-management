import { createServerFn } from '@tanstack/react-start'
import {
  createVariantSchema,
  listProductVariantsPaginatedSchema,
  toggleVariantActiveSchema,
  updateVariantSchema,
} from '../../lib/schemas/product.ts'
import { requireUser } from '../middleware/auth.ts'
import {
  createVariant,
  listProductVariantsPaginated,
  toggleVariantActive,
  updateVariant,
} from '../services/variants.ts'

export const createVariantFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(createVariantSchema)
  .handler(async ({ data, context }) => createVariant(data, context.user.id))

export const updateVariantFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(updateVariantSchema)
  .handler(async ({ data, context }) => updateVariant(data, context.user.id))

export const toggleVariantActiveFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(toggleVariantActiveSchema)
  .handler(async ({ data, context }) =>
    toggleVariantActive(data, context.user.id),
  )

export const listProductVariantsPaginatedFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listProductVariantsPaginatedSchema)
  .handler(async ({ data }) => listProductVariantsPaginated(data))
