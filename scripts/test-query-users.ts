import { eq } from 'drizzle-orm'
import { authUsers } from 'drizzle-orm/supabase'
import { db } from '../src/server/db/index.ts'
import { profiles } from '../src/server/db/schema/index.ts'

const res = await db
  .select({
    id: profiles.id,
    role: profiles.role,
    username: profiles.username,
    isActive: profiles.isActive,
    email: authUsers.email,
  })
  .from(profiles)
  .leftJoin(authUsers, eq(profiles.id, authUsers.id))

console.log('Query result:', res)
await db.$client.end()

