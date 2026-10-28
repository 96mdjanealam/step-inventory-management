import { createServerFn } from '@tanstack/react-start'
import {
  addStockSchema,
  adjustStockSchema,
  listInventorySchema,
  listStockMovementsSchema,
} from '../../lib/schemas/inventory.ts'
import { requireUser } from '../middleware/auth.ts'
import {
  addStock,
  adjustStock,
  listInventory,
  listStockMovements,
} from '../services/inventory.ts'

export const listInventoryFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listInventorySchema)
  .handler(async ({ data }) => listInventory(data))

export const addStockFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(addStockSchema)
  .handler(async ({ data, context }) => addStock(data, context.user.id))

export const adjustStockFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(adjustStockSchema)
  .handler(async ({ data, context }) => adjustStock(data, context.user.id))

export const listStockMovementsFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listStockMovementsSchema)
  .handler(async ({ data }) => listStockMovements(data))

