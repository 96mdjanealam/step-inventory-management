import { createServerFn } from '@tanstack/react-start'
import {
  createUserSchema,
  listUsersSchema,
  toggleUserActiveSchema,
  updateUserRoleSchema,
} from '../../lib/schemas/user.ts'
import { requireAdmin } from '../middleware/auth.ts'
import {
  createUser,
  listUsers,
  toggleUserActive,
  updateUserRole,
} from '../services/users.ts'

export const createUserFn = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(createUserSchema)
  .handler(async ({ data, context }) => createUser(data, context.user.id))

export const listUsersFn = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .validator(listUsersSchema)
  .handler(async ({ data }) => listUsers(data))

export const updateUserRoleFn = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(updateUserRoleSchema)
  .handler(async ({ data, context }) => updateUserRole(data, context.user.id))

export const toggleUserActiveFn = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(toggleUserActiveSchema)
  .handler(async ({ data, context }) => toggleUserActive(data, context.user.id))

