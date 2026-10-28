import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { authUsers } from 'drizzle-orm/supabase'
import { createSupabaseAdminClient } from '../auth/supabase.ts'
import { db } from '../db/index.ts'
import { profiles } from '../db/schema/index.ts'
import { logActivity } from './activity-logs.ts'
import type {
  CreateUserInput,
  ListUsersInput,
  ToggleUserActiveInput,
  UpdateUserRoleInput,
} from '../../lib/schemas/user.ts'

function uniqueViolationConstraint(error: unknown): string | undefined {
  const candidates = [error, (error as { cause?: unknown } | undefined)?.cause]
  for (const candidate of candidates) {
    const pgError = candidate as
      { code?: string; constraint?: string } | undefined
    if (pgError?.code === '23505') return pgError.constraint
  }
  return undefined
}

export async function createUser(input: CreateUserInput, adminId: string) {
  const supabaseAdmin = createSupabaseAdminClient()

  // 1. Create auth user with confirmed email
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        username: input.username || undefined,
      },
    })

  if (authError || !authData.user) {
    throw new Error(authError?.message || 'Failed to create user credentials')
  }

  const userId = authData.user.id

  // 2. Create profile row in profiles table
  try {
    const [profile] = await db
      .insert(profiles)
      .values({
        id: userId,
        username: input.username || null,
        role: input.role,
        isActive: true,
      })
      .returning()

    // 3. Log activity
    await logActivity({
      userId: adminId,
      action: 'user.create',
      entityType: 'user',
      entityId: profile.id,
      description: `Created ${profile.role} account for "${input.email}"`,
      metadata: {
        email: input.email,
        role: profile.role,
        username: profile.username,
      },
    })

    return {
      id: profile.id,
      email: input.email,
      username: profile.username,
      role: profile.role,
      isActive: profile.isActive,
      createdAt: profile.createdAt,
    }
  } catch (err) {
    // Clean up created auth user if profile insert failed
    await supabaseAdmin.auth.admin.deleteUser(userId)

    const constraint = uniqueViolationConstraint(err)
    if (constraint === 'profiles_username_lower_unique') {
      throw new Error('A user with this username already exists')
    }
    throw err
  }
}

export async function listUsers(input: ListUsersInput) {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 20
  const searchPattern = input.search?.replace(/[%_\\]/g, '\\$&')

  const conditions = [
    input.includeInactive ? undefined : eq(profiles.isActive, true),
    input.role ? eq(profiles.role, input.role) : undefined,
    searchPattern
      ? or(
          ilike(profiles.username, `%${searchPattern}%`),
          ilike(authUsers.email, `%${searchPattern}%`),
        )
      : undefined,
  ]

  const where = and(...conditions.filter(Boolean))

  const [items, total] = await Promise.all([
    db
      .select({
        id: profiles.id,
        username: profiles.username,
        role: profiles.role,
        isActive: profiles.isActive,
        email: authUsers.email,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .leftJoin(authUsers, eq(profiles.id, authUsers.id))
      .where(where)
      .orderBy(desc(profiles.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles)
      .leftJoin(authUsers, eq(profiles.id, authUsers.id))
      .where(where)
      .then((rows) => rows[0]?.count ?? 0),
  ])

  return { items, total, page, pageSize }
}

export async function updateUserRole(
  input: UpdateUserRoleInput,
  adminId: string,
) {
  const [current] = await db
    .select({ id: profiles.id, role: profiles.role, isActive: profiles.isActive })
    .from(profiles)
    .where(eq(profiles.id, input.id))
    .limit(1)

  if (!current) {
    throw new Error('User not found')
  }

  if (current.role === input.role) {
    return current
  }

  // Prevent demoting the last active administrator
  if (current.role === 'admin' && input.role !== 'admin' && current.isActive) {
    const [adminCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles)
      .where(and(eq(profiles.role, 'admin'), eq(profiles.isActive, true)))

    if ((adminCount?.count ?? 0) <= 1) {
      throw new Error('Cannot demote the only active administrator')
    }
  }

  const [updated] = await db
    .update(profiles)
    .set({ role: input.role })
    .where(eq(profiles.id, input.id))
    .returning()

  await logActivity({
    userId: adminId,
    action: 'user.role_change',
    entityType: 'user',
    entityId: updated.id,
    description: `Changed role to ${updated.role}`,
    metadata: {
      userId: updated.id,
      previousRole: current.role,
      newRole: updated.role,
    },
  })

  return updated
}

export async function toggleUserActive(
  input: ToggleUserActiveInput,
  adminId: string,
) {
  const [current] = await db
    .select({ id: profiles.id, role: profiles.role, isActive: profiles.isActive })
    .from(profiles)
    .where(eq(profiles.id, input.id))
    .limit(1)

  if (!current) {
    throw new Error('User not found')
  }

  if (current.isActive === input.isActive) {
    return current
  }

  // Prevent self-deactivation
  if (current.id === adminId && !input.isActive) {
    throw new Error('Cannot deactivate your own account')
  }

  // Prevent deactivating the only active administrator
  if (current.role === 'admin' && !input.isActive) {
    const [adminCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles)
      .where(and(eq(profiles.role, 'admin'), eq(profiles.isActive, true)))

    if ((adminCount?.count ?? 0) <= 1) {
      throw new Error('Cannot deactivate the only active administrator')
    }
  }

  const [updated] = await db
    .update(profiles)
    .set({ isActive: input.isActive })
    .where(eq(profiles.id, input.id))
    .returning()

  await logActivity({
    userId: adminId,
    action: 'user.toggle',
    entityType: 'user',
    entityId: updated.id,
    description: `${updated.isActive ? 'Activated' : 'Deactivated'} account`,
    metadata: {
      userId: updated.id,
      isActive: updated.isActive,
    },
  })

  return updated
}

