import { createServerFn } from '@tanstack/react-start'
import { dashboardFilterSchema } from '../../lib/schemas/dashboard.ts'
import { requireUser } from '../middleware/auth.ts'
import { getDashboardData } from '../services/dashboard.ts'

export const getDashboardDataFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(dashboardFilterSchema)
  .handler(async ({ data }) => getDashboardData(data))

