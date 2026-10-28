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

export const locations = pgTable(
  'locations',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    type: text({ enum: ['warehouse', 'store', 'damaged'] }).notNull(),
    storeType: text('store_type', { enum: ['ownstore', 'franchise'] }),
    address: text(),
    phone: text(),
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
    check(
      'locations_type_valid',
      sql`${t.type} in ('warehouse', 'store', 'damaged')`,
    ),
    check(
      'locations_store_type_valid',
      sql`${t.storeType} is null or ${t.storeType} in ('ownstore', 'franchise')`,
    ),
    check('locations_name_not_blank', sql`length(trim(${t.name})) > 0`),
    check(
      'locations_store_type_matches_type',
      sql`(${t.type} = 'store' and ${t.storeType} is not null) or (${t.type} <> 'store' and ${t.storeType} is null)`,
    ),
    uniqueIndex('one_main_warehouse')
      .on(t.type)
      .where(sql`${t.type} = 'warehouse'`),
    uniqueIndex('one_central_damaged_location')
      .on(t.type)
      .where(sql`${t.type} = 'damaged'`),
    uniqueIndex('locations_name_unique').on(sql`lower(trim(${t.name}))`),
  ],
)
