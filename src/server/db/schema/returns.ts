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
import { sales, saleItems } from './sales.ts'

export const returnStatusEnum = ['completed'] as const
export type ReturnStatus = (typeof returnStatusEnum)[number]

export const returns = pgTable(
  'returns',
  {
    id: uuid().primaryKey().defaultRandom(),
    returnNumber: text('return_number').notNull().unique(),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'restrict' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'restrict' }),
    reason: text().notNull(),
    totalRefundAmount: numeric('total_refund_amount', {
      precision: 14,
      scale: 2,
    }).notNull(),
    status: text({ enum: returnStatusEnum }).notNull().default('completed'),
    userId: uuid('user_id')
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
    index('returns_sale_idx').on(t.saleId),
    index('returns_location_idx').on(t.locationId),
    index('returns_return_number_idx').on(t.returnNumber),
    index('returns_created_at_idx').on(t.createdAt),
    check(
      'returns_total_refund_non_negative',
      sql`${t.totalRefundAmount} >= 0`,
    ),
    check('returns_reason_not_blank', sql`length(trim(${t.reason})) > 0`),
  ],
)

export const returnItems = pgTable(
  'return_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    returnId: uuid('return_id')
      .notNull()
      .references(() => returns.id, { onDelete: 'cascade' }),
    saleItemId: uuid('sale_item_id')
      .notNull()
      .references(() => saleItems.id, { onDelete: 'restrict' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    unitRefundPrice: numeric('unit_refund_price', {
      precision: 14,
      scale: 2,
    }).notNull(),
    subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [
    index('return_items_return_idx').on(t.returnId),
    index('return_items_sale_item_idx').on(t.saleItemId),
    index('return_items_variant_idx').on(t.variantId),
    check('return_items_quantity_positive', sql`${t.quantity} > 0`),
    check(
      'return_items_unit_refund_price_non_negative',
      sql`${t.unitRefundPrice} >= 0`,
    ),
    check('return_items_subtotal_non_negative', sql`${t.subtotal} >= 0`),
  ],
)

export const returnsRelations = relations(returns, ({ one, many }) => ({
  sale: one(sales, {
    fields: [returns.saleId],
    references: [sales.id],
  }),
  location: one(locations, {
    fields: [returns.locationId],
    references: [locations.id],
  }),
  user: one(profiles, {
    fields: [returns.userId],
    references: [profiles.id],
  }),
  items: many(returnItems),
}))

export const returnItemsRelations = relations(returnItems, ({ one }) => ({
  return: one(returns, {
    fields: [returnItems.returnId],
    references: [returns.id],
  }),
  saleItem: one(saleItems, {
    fields: [returnItems.saleItemId],
    references: [saleItems.id],
  }),
  product: one(products, {
    fields: [returnItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [returnItems.variantId],
    references: [productVariants.id],
  }),
}))

export type Return = typeof returns.$inferSelect
export type NewReturn = typeof returns.$inferInsert
export type ReturnItem = typeof returnItems.$inferSelect
export type NewReturnItem = typeof returnItems.$inferInsert

