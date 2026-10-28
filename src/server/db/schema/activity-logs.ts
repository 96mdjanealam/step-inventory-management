import { sql } from 'drizzle-orm'
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { locations } from './locations.ts'
import { profiles } from './profiles.ts'

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => profiles.id, {
      onDelete: 'restrict',
    }),
    action: text().notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    description: text().notNull(),
    metadata: jsonb()
      .$type<Record<string, any>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    sourceLocationId: uuid('source_location_id').references(
      () => locations.id,
      { onDelete: 'restrict' },
    ),
    destinationLocationId: uuid('destination_location_id').references(
      () => locations.id,
      { onDelete: 'restrict' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('activity_logs_action_not_blank', sql`length(trim(${t.action})) > 0`),
    check(
      'activity_logs_description_not_blank',
      sql`length(trim(${t.description})) > 0`,
    ),
    check(
      'activity_logs_metadata_is_object',
      sql`jsonb_typeof(${t.metadata}) = 'object'`,
    ),
    index('activity_logs_created_at_idx').on(t.createdAt),
    index('activity_logs_user_id_idx').on(t.userId),
    index('activity_logs_action_idx').on(t.action),
    index('activity_logs_source_location_idx').on(t.sourceLocationId),
    index('activity_logs_dest_location_idx').on(t.destinationLocationId),
    index('activity_logs_entity_idx').on(t.entityType, t.entityId),
  ],
)
