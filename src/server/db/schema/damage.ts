import { relations, sql } from 'drizzle-orm'
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { locations } from './locations.ts'
import { products } from './products.ts'
import { productVariants } from './product-variants.ts'
import { profiles } from './profiles.ts'

export const damageStatusEnum = ['quarantined', 'repaired', 'disposed'] as const
export type DamageStatus = (typeof damageStatusEnum)[number]

export const damageReports = pgTable(
  'damage_reports',
  {
    id: uuid().primaryKey().defaultRandom(),
    damageNumber: text('damage_number').notNull().unique(),
    sourceLocationId: uuid('source_location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'restrict' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    reason: text().notNull(),
    status: text({ enum: damageStatusEnum }).notNull().default('quarantined'),
    resolutionNotes: text('resolution_notes'),
    resolutionLocationId: uuid('resolution_location_id').references(
      () => locations.id,
      { onDelete: 'restrict' },
    ),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => profiles.id, {
      onDelete: 'restrict',
    }),
    reportedBy: uuid('reported_by')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('damage_reports_source_idx').on(t.sourceLocationId),
    index('damage_reports_variant_idx').on(t.variantId),
    index('damage_reports_status_idx').on(t.status),
    index('damage_reports_created_at_idx').on(t.createdAt),
    check('damage_reports_quantity_positive', sql`${t.quantity} > 0`),
    check('damage_reports_reason_not_blank', sql`length(trim(${t.reason})) > 0`),
    check(
      'damage_reports_status_valid',
      sql`${t.status} in ('quarantined', 'repaired', 'disposed')`,
    ),
  ],
)

export const damageReportsRelations = relations(damageReports, ({ one }) => ({
  sourceLocation: one(locations, {
    fields: [damageReports.sourceLocationId],
    references: [locations.id],
  }),
  resolutionLocation: one(locations, {
    fields: [damageReports.resolutionLocationId],
    references: [locations.id],
  }),
  product: one(products, {
    fields: [damageReports.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [damageReports.variantId],
    references: [productVariants.id],
  }),
  reporter: one(profiles, {
    fields: [damageReports.reportedBy],
    references: [profiles.id],
  }),
  resolver: one(profiles, {
    fields: [damageReports.resolvedBy],
    references: [profiles.id],
  }),
}))

export type DamageReport = typeof damageReports.$inferSelect
export type NewDamageReport = typeof damageReports.$inferInsert

