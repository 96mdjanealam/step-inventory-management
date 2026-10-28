import { createServerFn } from '@tanstack/react-start'
import {
  getDamageReportSchema,
  listDamageReportsSchema,
  reportDamageSchema,
  resolveDamageSchema,
} from '../../lib/schemas/damage.ts'
import { requireUser } from '../middleware/auth.ts'
import {
  getDamageReportById,
  listDamageReports,
  reportDamage,
  resolveDamage,
} from '../services/damage.ts'

export const reportDamageFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(reportDamageSchema)
  .handler(async ({ data, context }) => reportDamage(data, context.user.id))

export const resolveDamageFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(resolveDamageSchema)
  .handler(async ({ data, context }) => resolveDamage(data, context.user.id))

export const listDamageReportsFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(listDamageReportsSchema)
  .handler(async ({ data }) => listDamageReports(data))

export const getDamageReportFn = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(getDamageReportSchema)
  .handler(async ({ data }) => getDamageReportById(data.damageReportId))

