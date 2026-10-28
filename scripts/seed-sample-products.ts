import { eq } from 'drizzle-orm'
import { db } from '../src/server/db/index.ts'
import { profiles } from '../src/server/db/schema/index.ts'
import { createProductSchema } from '../src/lib/schemas/product.ts'
import { createProduct } from '../src/server/services/products.ts'

const [admin] = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)
if (!admin) throw new Error('No admin profile found')

for (let i = 1; i <= 25; i++) {
  const n = String(i).padStart(2, '0')
  await createProduct(
    createProductSchema.parse({
      name: `Sample Product ${n}`,
      category: 'sample',
      discountedPrice: `${i}.50`,
    }),
    admin.id,
  )
}

console.log('Created 25 sample products')
await db.$client.end()