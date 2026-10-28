import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createSupabaseServerClient } from '../auth/supabase.ts'
import { requireUser } from '../middleware/auth.ts'

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export const getMe = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .handler(async ({ context }) => context.user)

export const loginFn = createServerFn({ method: 'POST' })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword(data)

    if (error) {
      return { error: 'Invalid email or password' }
    }

    throw redirect({ to: '/' })
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
  throw redirect({ to: '/login' })
})
