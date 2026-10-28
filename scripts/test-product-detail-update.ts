import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/server/db/index.ts'
import { products, productVariants, profiles } from '../src/server/db/schema/index.ts'
import { createProductSchema } from '../src/lib/schemas/product.ts'
import {
  createProduct,
  getProductById,
  updateProduct,
} from '../src/server/services/products.ts'

const [admin] = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)
if (!admin) throw new Error('No admin profile found')

const created = await createProduct(
  createProductSchema.parse({
    name: 'Detail Test Product',
    category: 'script-test',
    discountedPrice: '29.99',
    regularPrice: '39.99',
    description: 'Initial description',
  }),
  admin.id,
)

console.log('1. Created product -> id:', created.id, 'slug:', created.slug)

// Test getProductById
const fetched = await getProductById(created.id)
console.log(
  '2. getProductById -> name:',
  fetched.name,
  'variants count:',
  fetched.variants.length,
  'default variant price:',
  fetched.variants[0]?.discountedPrice,
)

// Test updateProduct
const updated = await updateProduct({
  id: created.id,
  name: 'Detail Test Product Renamed',
  category: 'script-test-updated',
  targetConsumer: 'kids',
  description: 'Updated description',
})

console.log(
  '3. updateProduct -> name:',
  updated.name,
  'slug:',
  updated.slug,
  'category:',
  updated.category,
  'targetConsumer:',
  updated.targetConsumer,
)

// Test duplicate name/slug collision
const existingProduct = await createProduct(
  createProductSchema.parse({
    name: 'Conflict Existing Name',
    category: 'script-test',
    discountedPrice: '10',
  }),
  admin.id,
)

try {
  await updateProduct({
    id: created.id,
    name: 'Conflict Existing Name',
    category: 'script-test',
    targetConsumer: 'unisex',
  })
  console.log('4. UNEXPECTED: allowed duplicate slug/name')
} catch (err) {
  console.log('4. Duplicate slug caught as expected:', (err as Error).message)
}

// Cleanup
const ids = [created.id, existingProduct.id]
await db.delete(productVariants).where(inArray(productVariants.productId, ids))
await db.delete(products).where(inArray(products.id, ids))
console.log('5. Cleanup done')
await db.$client.end()

