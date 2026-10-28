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

export const saleStatusEnum = ['completed', 'cancelled'] as const
export type SaleStatus = (typeof saleStatusEnum)[number]

export const sales = pgTable(
  'sales',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderNumber: text('order_number').notNull().unique(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'restrict' }),
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),
    status: text({ enum: saleStatusEnum }).notNull().default('completed'),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).notNull(),
    notes: text(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: uuid('cancelled_by').references(() => profiles.id, {
      onDelete: 'restrict',
    }),
    cancellationReason: text('cancellation_reason'),
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
    index('sales_location_idx').on(t.locationId),
    index('sales_order_number_idx').on(t.orderNumber),
    index('sales_created_at_idx').on(t.createdAt),
    index('sales_status_idx').on(t.status),
    check('sales_status_valid', sql`${t.status} in ('completed', 'cancelled')`),
    check('sales_total_amount_non_negative', sql`${t.totalAmount} >= 0`),
  ],
)

export const saleItems = pgTable(
  'sale_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 14, scale: 2 }).notNull(),
    subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [
    index('sale_items_sale_idx').on(t.saleId),
    index('sale_items_variant_idx').on(t.variantId),
    check('sale_items_quantity_positive', sql`${t.quantity} > 0`),
    check('sale_items_unit_price_non_negative', sql`${t.unitPrice} >= 0`),
    check('sale_items_subtotal_non_negative', sql`${t.subtotal} >= 0`),
  ],
)

export const salesRelations = relations(sales, ({ one, many }) => ({
  location: one(locations, {
    fields: [sales.locationId],
    references: [locations.id],
  }),
  user: one(profiles, {
    fields: [sales.userId],
    references: [profiles.id],
  }),
  cancelledByUser: one(profiles, {
    fields: [sales.cancelledBy],
    references: [profiles.id],
  }),
  items: many(saleItems),
}))

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [saleItems.variantId],
    references: [productVariants.id],
  }),
}))

export type Sale = typeof sales.$inferSelect
export type NewSale = typeof sales.$inferInsert
export type SaleItem = typeof saleItems.$inferSelect
export type NewSaleItem = typeof saleItems.$inferInsert

