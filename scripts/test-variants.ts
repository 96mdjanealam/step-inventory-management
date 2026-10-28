import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/server/db/index.ts'
import { products, productVariants, profiles } from '../src/server/db/schema/index.ts'
import { createProductSchema } from '../src/lib/schemas/product.ts'
import { createProduct } from '../src/server/services/products.ts'
import {
  createVariant,
  toggleVariantActive,
  updateVariant,
} from '../src/server/services/variants.ts'

// Initial cleanup of any previous script test
const oldProds = await db
  .select({ id: products.id })
  .from(products)
  .where(eq(products.name, 'Multi Variant Test Product'))

if (oldProds.length > 0) {
  const ids = oldProds.map((p) => p.id)
  await db.delete(productVariants).where(inArray(productVariants.productId, ids))
  await db.delete(products).where(inArray(products.id, ids))
}

const [admin] = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)
if (!admin) throw new Error('No admin profile found')

// 1. Create a base product
const product = await createProduct(
  createProductSchema.parse({
    name: 'Multi Variant Test Product',
    category: 'script-test',
    discountedPrice: '50.00',
    sku: 'TEST-DEFAULT-SKU',
  }),
  admin.id,
)

const initialVariant = product.variants[0]
console.log('1. Base product created with variant:', initialVariant.id, 'isDefault:', initialVariant.isDefault)

// 2. Add a new variant
const variant2 = await createVariant({
  productId: product.id,
  sku: 'TEST-SKU-VAR2',
  attributes: { size: 'Large', color: 'Blue' },
  discountedPrice: '60.00',
  regularPrice: '75.00',
  isDefault: false,
})
console.log('2. Second variant created:', variant2.id, 'sku:', variant2.sku, 'isDefault:', variant2.isDefault)

// 3. Test duplicate SKU rejection
try {
  await createVariant({
    productId: product.id,
    sku: 'TEST-SKU-VAR2',
    attributes: { size: 'Small' },
    discountedPrice: '40.00',
    isDefault: false,
  })
  console.log('3. UNEXPECTED: duplicate SKU was allowed')
} catch (err) {
  console.log('3. Duplicate SKU rejected properly:', (err as Error).message)
}

// 4. Test duplicate attributes on active variants rejection
try {
  await createVariant({
    productId: product.id,
    attributes: { size: 'Large', color: 'Blue' },
    discountedPrice: '65.00',
    isDefault: false,
  })
  console.log('4. UNEXPECTED: duplicate attributes allowed')
} catch (err) {
  console.log('4. Duplicate attributes rejected properly:', (err as Error).message)
}

// 5. Update variant2 to become default
const updatedV2 = await updateVariant({
  id: variant2.id,
  sku: 'TEST-SKU-VAR2-UPDATED',
  attributes: { size: 'XL', color: 'Navy' },
  discountedPrice: '59.00',
  isDefault: true,
})
console.log('5. Variant2 updated to default:', updatedV2.isDefault, 'sku:', updatedV2.sku)

// Verify initial variant is no longer default
const [v1After] = await db
  .select()
  .from(productVariants)
  .where(eq(productVariants.id, initialVariant.id))
console.log('6. Initial variant isDefault after v2 made default (expect false):', v1After.isDefault)

// 7. Deactivate variant2 (which is current default) -> should reassign default to initialVariant
await toggleVariantActive({ id: variant2.id, isActive: false })
const [v1NewDefault] = await db
  .select()
  .from(productVariants)
  .where(eq(productVariants.id, initialVariant.id))
console.log('7. After deactivating v2, v1 isDefault (expect true):', v1NewDefault.isDefault)

// 8. Prevent deactivating the last active variant
try {
  await toggleVariantActive({ id: initialVariant.id, isActive: false })
  console.log('8. UNEXPECTED: allowed deactivating the only active variant')
} catch (err) {
  console.log('8. Prevented deactivating last active variant:', (err as Error).message)
}

// Cleanup
await db.delete(productVariants).where(eq(productVariants.productId, product.id))
await db.delete(products).where(eq(products.id, product.id))
console.log('9. Cleanup complete')
await db.$client.end()
