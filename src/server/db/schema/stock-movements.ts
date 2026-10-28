import { sql } from 'drizzle-orm'
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

export const stockMovementTypeEnum = [
  'inflow',
  'transfer',
  'sale',
  'return',
  'adjustment',
  'damage',
  'repair',
  'disposal',
] as const

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    sourceLocationId: uuid('source_location_id').references(
      () => locations.id,
      { onDelete: 'restrict' },
    ),
    destinationLocationId: uuid('destination_location_id').references(
      () => locations.id,
      { onDelete: 'restrict' },
    ),
    type: text({ enum: stockMovementTypeEnum }).notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    reason: text(),
    userId: uuid('user_id').references(() => profiles.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('stock_movements_quantity_positive', sql`${t.quantity} > 0`),
    check(
      'stock_movements_has_location',
      sql`${t.sourceLocationId} is not null or ${t.destinationLocationId} is not null`,
    ),
    check(
      'stock_movements_locations_differ',
      sql`${t.sourceLocationId} is null or ${t.destinationLocationId} is null or ${t.sourceLocationId} <> ${t.destinationLocationId}`,
    ),
    check(
      'stock_movements_type_valid',
      sql`${t.type} in ('inflow', 'transfer', 'sale', 'return', 'adjustment', 'damage', 'repair', 'disposal')`,
    ),
    index('stock_movements_product_id_idx').on(t.productId),
    index('stock_movements_variant_id_idx').on(t.variantId),
    index('stock_movements_source_loc_idx').on(t.sourceLocationId),
    index('stock_movements_dest_loc_idx').on(t.destinationLocationId),
    index('stock_movements_created_at_idx').on(t.createdAt),
    index('stock_movements_type_idx').on(t.type),
    index('stock_movements_ref_idx').on(t.referenceType, t.referenceId),
  ],
)

