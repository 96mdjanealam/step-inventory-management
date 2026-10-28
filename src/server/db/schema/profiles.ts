import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { authUsers } from 'drizzle-orm/supabase'

export const profiles = pgTable(
  'profiles',
  {
    id: uuid()
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'restrict' }),
    username: text(),
    role: text({ enum: ['admin', 'employee'] }).notNull().default('employee'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check('profiles_role_valid', sql`${t.role} in ('admin', 'employee')`),
    check('profiles_username_not_blank', sql`${t.username} is null or length(trim(${t.username})) > 0`),
    uniqueIndex('profiles_username_lower_unique')
      .on(sql`lower(${t.username})`)
      .where(sql`${t.username} is not null`),
  ],
)