import { createServerFn } from '@tanstack/react-start'
import {
  archiveProductSchema,
  createProductSchema,
  listProductsSchema,
} from '../../lib/schemas/product.ts'
import { requireAdmin, requireUser } from '../middleware/auth.ts'
import {
  archiveProduct,
  createProduct,
  listProducts,
} from '../services/products.ts'

export const createProductFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(createProductSchema)
  .handler(async ({ data, context }) => createProduct(data, context.user.id))

export const listProductsFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listProductsSchema)
  .handler(async ({ data }) => listProducts(data))

export const archiveProductFn = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(archiveProductSchema)
  .handler(async ({ data }) => archiveProduct(data.id))
