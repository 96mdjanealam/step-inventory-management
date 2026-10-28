import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/server/db/index.ts'
import { products, productVariants, profiles } from '../src/server/db/schema/index.ts'
import { createProductSchema } from '../src/lib/schemas/product.ts'
import { createProduct } from '../src/server/services/products.ts'

const [admin] = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)
if (!admin) throw new Error('No admin profile found')

const a = await createProduct(
  createProductSchema.parse({ name: 'Script Test Soap', category: 'care', discountedPrice: '4.50' }),
  admin.id,
)
console.log('1. default variant -> count:', a.variants.length, 'isDefault:', a.variants[0].isDefault)

const b = await createProduct(
  createProductSchema.parse({
    name: 'Script Test Shirt',
    category: 'clothing',
    variants: [
      { attributes: { size: 'M' }, discountedPrice: '10' },
      { attributes: { size: 'L' }, discountedPrice: '10' },
    ],
  }),
  admin.id,
)
console.log('2. custom variants -> count:', b.variants.length, 'isDefault:', b.variants.map((v) => v.isDefault))

try {
  await createProduct(
    createProductSchema.parse({
      name: 'Script Test Broken',
      category: 'x',
      variants: [
        { attributes: { size: 'M' }, discountedPrice: '1' },
        { attributes: { size: 'M' }, discountedPrice: '1' },
      ],
    }),
    admin.id,
  )
  console.log('3. UNEXPECTED: duplicate variants were accepted')
} catch {
  console.log('3. duplicate variants rejected, as expected')
}
const leftover = await db.select().from(products).where(eq(products.slug, 'script-test-broken'))
console.log('3. leftover product rows (expect 0):', leftover.length)

const ids = [a.id, b.id]
await db.delete(productVariants).where(inArray(productVariants.productId, ids))
await db.delete(products).where(inArray(products.id, ids))
console.log('cleanup done')
await db.$client.end()