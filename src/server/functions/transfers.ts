import { createServerFn } from '@tanstack/react-start'
import {
  createTransferSchema,
  getLocationStockSchema,
  listTransfersSchema,
} from '../../lib/schemas/transfer.ts'
import { requireUser } from '../middleware/auth.ts'
import {
  createTransfer,
  getLocationStockForTransfer,
  listTransfers,
} from '../services/transfers.ts'

export const createTransferFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(createTransferSchema)
  .handler(async ({ data, context }) => createTransfer(data, context.user.id))

export const listTransfersFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listTransfersSchema)
  .handler(async ({ data }) => listTransfers(data))

export const getLocationStockForTransferFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(getLocationStockSchema)
  .handler(async ({ data }) => getLocationStockForTransfer(data.locationId))

