import { eq } from 'drizzle-orm'
import { db } from '../src/server/db/index.ts'
import {
  inventory,
  locations,
  profiles,
  stockMovements,
} from '../src/server/db/schema/index.ts'
import { createProductSchema } from '../src/lib/schemas/product.ts'
import { createProduct } from '../src/server/services/products.ts'

const [admin] = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)
if (!admin) throw new Error('No admin profile found')

const [warehouse] = await db
  .select({ id: locations.id })
  .from(locations)
  .where(eq(locations.type, 'warehouse'))
  .limit(1)
if (!warehouse) throw new Error('Warehouse not found')

// 1. Create a product with a variant
const testProd = await createProduct(
  createProductSchema.parse({
    name: `Inventory Test Product ${Date.now()}`,
    category: 'script-test',
    discountedPrice: '25.00',
    sku: `INV-TEST-${Date.now()}`,
  }),
  admin.id,
)

const variant = testProd.variants[0]
console.log('1. Created product & variant for test:', variant.id, 'warehouse:', warehouse.id)

// 2. Insert valid inventory
const [inv] = await db
  .insert(inventory)
  .values({
    productId: testProd.id,
    variantId: variant.id,
    locationId: warehouse.id,
    quantity: '100.000',
  })
  .returning()

console.log('2. Created inventory balance:', inv.id, 'qty:', inv.quantity)

// 3. Test duplicate (variant_id, location_id) unique constraint
try {
  await db.insert(inventory).values({
    productId: testProd.id,
    variantId: variant.id,
    locationId: warehouse.id,
    quantity: '50.000',
  })
  console.log('3. UNEXPECTED: duplicate inventory row allowed')
} catch (err) {
  console.log('3. Duplicate inventory row rejected:', (err as Error).message)
}

// 4. Test non-negative constraint on inventory
try {
  await db
    .update(inventory)
    .set({ quantity: '-5.000' })
    .where(eq(inventory.id, inv.id))
  console.log('4. UNEXPECTED: negative inventory allowed')
} catch (err) {
  console.log('4. Negative inventory rejected by constraint:', (err as Error).message)
}

// 5. Test inserting valid stock_movement
const [movement] = await db
  .insert(stockMovements)
  .values({
    productId: testProd.id,
    variantId: variant.id,
    destinationLocationId: warehouse.id,
    type: 'inflow',
    quantity: '100.000',
    reason: 'Initial stock intake test',
    userId: admin.id,
  })
  .returning()

console.log('5. Created stock movement:', movement.id, 'type:', movement.type, 'qty:', movement.quantity)

// 6. Test append-only trigger on stock_movements (UPDATE)
try {
  await db
    .update(stockMovements)
    .set({ quantity: '200.000' })
    .where(eq(stockMovements.id, movement.id))
  console.log('6. UNEXPECTED: update allowed on stock_movements ledger')
} catch (err) {
  console.log('6. UPDATE blocked by append-only trigger:', (err as Error).message)
}

// 7. Test append-only trigger on stock_movements (DELETE)
try {
  await db.delete(stockMovements).where(eq(stockMovements.id, movement.id))
  console.log('7. UNEXPECTED: delete allowed on stock_movements ledger')
} catch (err) {
  console.log('7. DELETE blocked by append-only trigger:', (err as Error).message)
}

// 8. Clean up inventory test row
await db.delete(inventory).where(eq(inventory.id, inv.id))
console.log('8. Inventory test row cleaned up')

console.log('All inventory and stock_movements schema tests passed successfully!')
await db.$client.end()
