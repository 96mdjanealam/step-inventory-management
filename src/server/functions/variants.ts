import { createServerFn } from '@tanstack/react-start'
import {
  createVariantSchema,
  toggleVariantActiveSchema,
  updateVariantSchema,
} from '../../lib/schemas/product.ts'
import { requireUser } from '../middleware/auth.ts'
import {
  createVariant,
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
