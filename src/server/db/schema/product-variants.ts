import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { products } from './products.ts'

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    sku: text(),
    attributes: jsonb()
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    image: text(),
    discountedPrice: numeric('discounted_price', { precision: 14, scale: 2 }).notNull(),
    regularPrice: numeric('regular_price', { precision: 14, scale: 2 }),
    isDefault: boolean('is_default').notNull().default(false),
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
    check('variants_attributes_is_object', sql`jsonb_typeof(${t.attributes}) = 'object'`),
    check('variants_discounted_price_non_negative', sql`${t.discountedPrice} >= 0`),
    check('variants_regular_price_non_negative', sql`${t.regularPrice} is null or ${t.regularPrice} >= 0`),
    check(
      'variants_regular_not_below_discounted',
      sql`${t.regularPrice} is null or ${t.regularPrice} >= ${t.discountedPrice}`,
    ),
    uniqueIndex('product_variants_sku_unique')
      .on(t.sku)
      .where(sql`${t.sku} is not null and length(trim(${t.sku})) > 0`),
    uniqueIndex('one_default_variant_per_product')
      .on(t.productId)
      .where(sql`${t.isDefault} = true`),
    uniqueIndex('product_variants_unique_attributes')
      .on(t.productId, t.attributes)
      .where(sql`${t.isActive} = true`),
    index('product_variants_product_id_idx').on(t.productId),
  ],
)