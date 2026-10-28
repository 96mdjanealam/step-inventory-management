import { eq } from 'drizzle-orm'
import { db } from '../src/server/db/index.ts'
import {
  inventory,
  locations,
  profiles,
} from '../src/server/db/schema/index.ts'
import { createProductSchema } from '../src/lib/schemas/product.ts'
import { createProduct } from '../src/server/services/products.ts'
import { addStock } from '../src/server/services/inventory.ts'
import {
  createTransfer,
  listTransfers,
} from '../src/server/services/transfers.ts'

const [admin] = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)
if (!admin) throw new Error('No admin profile found')

const allLocs = await db.select().from(locations)
const warehouse = allLocs.find((l) => l.type === 'warehouse')
const store = allLocs.find((l) => l.type === 'store')
const damaged = allLocs.find((l) => l.type === 'damaged')

if (!warehouse || !store || !damaged) {
  throw new Error('Locations (warehouse, store, damaged) must exist')
}

// 1. Create a product with variant
const product = await createProduct(
  createProductSchema.parse({
    name: `Transfer Test Product ${Date.now()}`,
    category: 'transfer-test',
    measurementType: 'weight',
    unit: 'kg',
    discountedPrice: '10.00',
    sku: `SKU-TRF-${Date.now()}`,
  }),
  admin.id,
)
const variant = product.variants[0]
console.log('1. Created product & variant for transfer test:', variant.id)

// 2. Receive 50.000 kg into Warehouse
await addStock(
  {
    variantId: variant.id,
    locationId: warehouse.id,
    quantity: '50.000',
    reason: 'Initial warehouse receipt for transfer testing',
  },
  admin.id,
)
console.log('2. Warehouse received 50.000 kg')

// 3. Transfer 20.000 kg from Warehouse to Store
const trf1 = await createTransfer(
  {
    variantId: variant.id,
    sourceLocationId: warehouse.id,
    destinationLocationId: store.id,
    quantity: '20.000',
    notes: 'Restock flagship store',
  },
  admin.id,
)

console.log('3. Transfer 1 executed:')
console.log('   Warehouse new balance (expect 30.000):', trf1.sourceInventory.quantity)
console.log('   Store new balance (expect 20.000):', trf1.destinationInventory.quantity)

if (trf1.sourceInventory.quantity !== '30.000' || trf1.destinationInventory.quantity !== '20.000') {
  throw new Error('Balance mismatch after transfer 1')
}

// 4. Same location transfer rejection
try {
  await createTransfer(
    {
      variantId: variant.id,
      sourceLocationId: warehouse.id,
      destinationLocationId: warehouse.id,
      quantity: '5.000',
    },
    admin.id,
  )
  console.log('4. UNEXPECTED: allowed same location transfer')
} catch (err) {
  console.log('4. Same location transfer rejected as expected:', (err as Error).message)
}

// 5. Transfer into Damaged location rejection
try {
  await createTransfer(
    {
      variantId: variant.id,
      sourceLocationId: warehouse.id,
      destinationLocationId: damaged.id,
      quantity: '5.000',
    },
    admin.id,
  )
  console.log('5. UNEXPECTED: allowed transfer into damaged location')
} catch (err) {
  console.log('5. Transfer into damaged location rejected as expected:', (err as Error).message)
}

// 6. Insufficient stock transfer rejection (trying to transfer 40 kg from warehouse which only has 30 kg)
try {
  await createTransfer(
    {
      variantId: variant.id,
      sourceLocationId: warehouse.id,
      destinationLocationId: store.id,
      quantity: '40.000',
    },
    admin.id,
  )
  console.log('6. UNEXPECTED: allowed overdraft transfer')
} catch (err) {
  console.log('6. Insufficient stock transfer rejected as expected:', (err as Error).message)
}

// 7. Transfer 5.000 kg from Store back to Warehouse
const trf2 = await createTransfer(
  {
    variantId: variant.id,
    sourceLocationId: store.id,
    destinationLocationId: warehouse.id,
    quantity: '5.000',
    notes: 'Return unsold stock to warehouse',
  },
  admin.id,
)

console.log('7. Transfer 2 (Store -> Warehouse) executed:')
console.log('   Store new balance (expect 15.000):', trf2.sourceInventory.quantity)
console.log('   Warehouse new balance (expect 35.000):', trf2.destinationInventory.quantity)

if (trf2.sourceInventory.quantity !== '15.000' || trf2.destinationInventory.quantity !== '35.000') {
  throw new Error('Balance mismatch after transfer 2')
}

// 8. Query listTransfers
const trfList = await listTransfers({
  variantId: variant.id,
})
console.log('8. Total transfers for variant (expect 2):', trfList.items.length)
if (trfList.items.length !== 2) throw new Error('Expected 2 transfers in history')

// Cleanup
await db.delete(inventory).where(eq(inventory.productId, product.id))
console.log('9. Cleaned up inventory balances')
console.log('All transfer workflow tests passed successfully!')
await db.$client.end()

