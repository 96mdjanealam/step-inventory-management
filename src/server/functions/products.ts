import { createServerFn } from '@tanstack/react-start'
import {
  archiveProductSchema,
  createProductSchema,
  getProductSchema,
  listProductsSchema,
  restoreProductSchema,
  updateProductSchema,
} from '../../lib/schemas/product.ts'
import { requireAdmin, requireUser } from '../middleware/auth.ts'
import {
  archiveProduct,
  createProduct,
  getProductById,
  listActiveProductsWithVariants,
  listProducts,
  restoreProduct,
  updateProduct,
} from '../services/products.ts'

export const createProductFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(createProductSchema)
  .handler(async ({ data, context }) => createProduct(data, context.user.id))

export const listProductsFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listProductsSchema)
  .handler(async ({ data }) => listProducts(data))

export const getProductFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(getProductSchema)
  .handler(async ({ data }) => getProductById(data.id))

export const updateProductFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(updateProductSchema)
  .handler(async ({ data, context }) => updateProduct(data, context.user.id))

export const archiveProductFn = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(archiveProductSchema)
  .handler(async ({ data, context }) => archiveProduct(data.id, context.user.id))

export const restoreProductFn = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(restoreProductSchema)
  .handler(async ({ data, context }) => restoreProduct(data.id, context.user.id))

export const listActiveProductsWithVariantsFn = createServerFn({
  method: 'GET',
})
  .middleware([requireUser])
  .handler(async () => listActiveProductsWithVariants())
