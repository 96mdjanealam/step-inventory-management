import { createServerFn } from '@tanstack/react-start'
import {
  createReturnSchema,
  getReturnSchema,
  listReturnsSchema,
} from '../../lib/schemas/return.ts'
import { requireUser } from '../middleware/auth.ts'
import {
  createReturn,
  getReturnById,
  listReturns,
} from '../services/returns.ts'

export const createReturnFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(createReturnSchema)
  .handler(async ({ data, context }) => createReturn(data, context.user.id))

export const listReturnsFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listReturnsSchema)
  .handler(async ({ data }) => listReturns(data))

export const getReturnFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(getReturnSchema)
  .handler(async ({ data }) => getReturnById(data.returnId))

