import { sql } from 'drizzle-orm'
import {
  check,
  index,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { locations } from './locations.ts'
import { products } from './products.ts'
import { productVariants } from './product-variants.ts'

export const inventory = pgTable(
  'inventory',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 14, scale: 3 })
      .notNull()
      .default('0'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check('inventory_quantity_non_negative', sql`${t.quantity} >= 0`),
    uniqueIndex('inventory_variant_location_unique').on(t.variantId, t.locationId),
    index('inventory_product_id_idx').on(t.productId),
    index('inventory_variant_id_idx').on(t.variantId),
    index('inventory_location_id_idx').on(t.locationId),
  ],
)

