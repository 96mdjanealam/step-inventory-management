import { createServerFn } from '@tanstack/react-start'
import { listActivityLogsSchema } from '../../lib/schemas/activity-log.ts'
import { requireUser } from '../middleware/auth.ts'
import { listActivityLogs } from '../services/activity-logs.ts'

export const listActivityLogsFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listActivityLogsSchema)
  .handler(async ({ data }) => listActivityLogs(data))

