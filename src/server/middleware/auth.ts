import { createMiddleware } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { createSupabaseServerClient } from '../auth/supabase.ts'
import { db } from '../db/index.ts'
import { profiles } from '../db/schema/index.ts'

export const requireUser = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const [profile] = await db
      .select({
        id: profiles.id,
        username: profiles.username,
        role: profiles.role,
        isActive: profiles.isActive,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1)

    if (!profile || !profile.isActive) {
      throw new Error('Forbidden')
    }

    return next({
      context: {
        user: {
          id: profile.id,
          email: user.email ?? null,
          username: profile.username,
          role: profile.role,
        },
      },
    })
  },
)

export const requireAdmin = createMiddleware({ type: 'function' })
  .middleware([requireUser])
  .server(async ({ next, context }) => {
    if (context.user.role !== 'admin') {
      throw new Error('Forbidden')
    }
    return next()
  })