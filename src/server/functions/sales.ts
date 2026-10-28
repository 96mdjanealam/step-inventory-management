import { createServerFn } from '@tanstack/react-start'
import {
  cancelSaleSchema,
  createSaleSchema,
  getSaleSchema,
  listSalesSchema,
} from '../../lib/schemas/sale.ts'
import { requireUser } from '../middleware/auth.ts'
import {
  cancelSale,
  createSale,
  getSaleById,
  listSales,
} from '../services/sales.ts'

export const createSaleFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(createSaleSchema)
  .handler(async ({ data, context }) => createSale(data, context.user.id))

export const cancelSaleFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(cancelSaleSchema)
  .handler(async ({ data, context }) => cancelSale(data, context.user.id))

export const listSalesFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listSalesSchema)
  .handler(async ({ data }) => listSales(data))

export const getSaleFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(getSaleSchema)
  .handler(async ({ data }) => getSaleById(data.saleId))

