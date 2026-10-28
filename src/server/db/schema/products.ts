import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { profiles } from './profiles.ts'

export const products = pgTable(
  'products',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    category: text().notNull(),
    targetConsumer: text('target_consumer', {
      enum: ['male', 'female', 'unisex', 'kids'],
    })
      .notNull()
      .default('unisex'),
    measurementType: text('measurement_type', {
      enum: ['count', 'weight', 'volume'],
    })
      .notNull()
      .default('count'),
    unit: text().notNull().default('piece'),
    images: text().array().notNull().default(sql`'{}'::text[]`),
    description: text(),
    slug: text().notNull().unique(),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => profiles.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check('products_target_consumer_valid', sql`${t.targetConsumer} in ('male', 'female', 'unisex', 'kids')`),
    check('products_measurement_type_valid', sql`${t.measurementType} in ('count', 'weight', 'volume')`),
    check('products_name_not_blank', sql`length(trim(${t.name})) > 0`),
    check('products_category_not_blank', sql`length(trim(${t.category})) > 0`),
    check('products_slug_format', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check(
      'products_unit_matches_measurement',
      sql`(${t.measurementType} = 'count' and ${t.unit} = 'piece') or (${t.measurementType} = 'weight' and ${t.unit} in ('kg', 'g')) or (${t.measurementType} = 'volume' and ${t.unit} in ('litre', 'ml'))`,
    ),
    index('products_category_idx').on(sql`lower(${t.category})`),
  ],
)