import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/server/db/index.ts'
import { products, productVariants, profiles } from '../src/server/db/schema/index.ts'
import { createProductSchema, listProductsSchema } from '../src/lib/schemas/product.ts'
import { archiveProduct, createProduct, listProducts, restoreProduct } from '../src/server/services/products.ts'

const [admin] = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)
if (!admin) throw new Error('No admin profile found')

const make = (name: string) =>
  createProduct(
    createProductSchema.parse({ name, category: 'script-test', discountedPrice: '5' }),
    admin.id,
  )
const list = (input: object) => listProducts(listProductsSchema.parse(input))

const p1 = await make('Script List Alpha')
const p2 = await make('Script List Beta')

const l1 = await list({ category: 'script-test' })
console.log('1. by category -> total:', l1.total, 'items:', l1.items.length, 'price:', l1.items[0].discountedPrice)

const l2 = await list({ category: 'script-test', search: 'alpha' })
console.log('2. search "alpha" ->', l2.items.map((i) => i.name))

const l3 = await list({ category: 'script-test', pageSize: 1, page: 2 })
console.log('3. page 2, size 1 -> items:', l3.items.length, 'total:', l3.total)

await archiveProduct(p1.id)
const l4 = await list({ category: 'script-test' })
console.log('4. after archive -> total (expect 1):', l4.total)

const l5 = await list({ category: 'script-test', includeArchived: true })
console.log('5. with archived -> total (expect 2):', l5.total)

try {
  await archiveProduct(p1.id)
  console.log('6. UNEXPECTED: archived twice')
} catch {
  console.log('6. second archive rejected, as expected')
}

// Test restoring
const restored = await restoreProduct(p1.id)
console.log('7. restored -> id:', restored.id, 'isActive:', restored.isActive)

const l6 = await list({ category: 'script-test' })
console.log('8. after restore -> total (expect 2):', l6.total)

try {
  await restoreProduct(p1.id)
  console.log('9. UNEXPECTED: restored twice')
} catch {
  console.log('9. second restore rejected, as expected')
}

const ids = [p1.id, p2.id]
await db.delete(productVariants).where(inArray(productVariants.productId, ids))
await db.delete(products).where(inArray(products.id, ids))
console.log('cleanup done')
await db.$client.end()
