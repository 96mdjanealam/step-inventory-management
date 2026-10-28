import { z } from 'zod'

export const createUserSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  username: z.string().trim().min(1).optional(),
  role: z.enum(['admin', 'employee']).default('employee'),
})
export type CreateUserInput = z.output<typeof createUserSchema>

export const listUsersSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  role: z.enum(['admin', 'employee']).optional(),
  includeInactive: z.boolean().default(false),
})
export type ListUsersInput = z.input<typeof listUsersSchema>

export const updateUserRoleSchema = z.object({
  id: z.uuid(),
  role: z.enum(['admin', 'employee']),
})
export type UpdateUserRoleInput = z.output<typeof updateUserRoleSchema>

export const toggleUserActiveSchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
})
export type ToggleUserActiveInput = z.output<typeof toggleUserActiveSchema>

