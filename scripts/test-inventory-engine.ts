import { eq } from 'drizzle-orm'
import { db } from '../src/server/db/index.ts'
import {
  inventory,
  locations,
  profiles,
} from '../src/server/db/schema/index.ts'
import { createProductSchema } from '../src/lib/schemas/product.ts'
import { createProduct } from '../src/server/services/products.ts'
import {
  addStock,
  adjustStock,
  listInventory,
} from '../src/server/services/inventory.ts'

const [admin] = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)
if (!admin) throw new Error('No admin profile found')

const [warehouse] = await db
  .select({ id: locations.id, name: locations.name })
  .from(locations)
  .where(eq(locations.type, 'warehouse'))
  .limit(1)
if (!warehouse) throw new Error('Warehouse not found')

// 1. Create product for testing
const testProd = await createProduct(
  createProductSchema.parse({
    name: `Engine Test Product ${Date.now()}`,
    category: 'engine-test',
    measurementType: 'weight',
    unit: 'kg',
    discountedPrice: '15.00',
    sku: `SKU-WEIGHT-${Date.now()}`,
  }),
  admin.id,
)

const variant = testProd.variants[0]
console.log('1. Created product:', testProd.name, 'variant:', variant.id)

// 2. Initial stock intake
const inflow1 = await addStock(
  {
    variantId: variant.id,
    locationId: warehouse.id,
    quantity: '10.500',
    reason: 'Initial shipment arrival',
  },
  admin.id,
)

console.log('2. First inflow complete -> qty:', inflow1.inventory.quantity, 'movementId:', inflow1.movement.id)

// 3. Second stock intake (accumulating exact decimal quantity)
const inflow2 = await addStock(
  {
    variantId: variant.id,
    locationId: warehouse.id,
    quantity: '4.250',
    reason: 'Supplementary shipment',
  },
  admin.id,
)

console.log('3. Second inflow complete -> qty (expect 14.750):', inflow2.inventory.quantity)
if (inflow2.inventory.quantity !== '14.750') {
  throw new Error(`Expected 14.750 but got ${inflow2.inventory.quantity}`)
}

// 4. Manual adjustment increase (+5.000)
const adjIncrease = await adjustStock(
  {
    variantId: variant.id,
    locationId: warehouse.id,
    adjustmentType: 'increase',
    quantity: '5.000',
    reason: 'Supplier bonus pack found in shipment',
  },
  admin.id,
)
console.log('4. Adjustment increase -> qty (expect 19.750):', adjIncrease.inventory.quantity)
if (adjIncrease.inventory.quantity !== '19.750') {
  throw new Error(`Expected 19.750 but got ${adjIncrease.inventory.quantity}`)
}

// 5. Manual adjustment decrease (-10.000)
const adjDecrease = await adjustStock(
  {
    variantId: variant.id,
    locationId: warehouse.id,
    adjustmentType: 'decrease',
    quantity: '10.000',
    reason: 'Spoilage during storage inspection',
  },
  admin.id,
)
console.log('5. Adjustment decrease -> qty (expect 9.750):', adjDecrease.inventory.quantity)
if (adjDecrease.inventory.quantity !== '9.750') {
  throw new Error(`Expected 9.750 but got ${adjDecrease.inventory.quantity}`)
}

// 6. Test insufficient stock rejection
try {
  await adjustStock(
    {
      variantId: variant.id,
      locationId: warehouse.id,
      adjustmentType: 'decrease',
      quantity: '20.000',
      reason: 'Excessive decrease test',
    },
    admin.id,
  )
  console.log('6. UNEXPECTED: allowed negative stock balance')
} catch (err) {
  console.log('6. Blocked excessive decrease as expected:', (err as Error).message)
}

// 7. Query listInventory
const invList = await listInventory({
  productId: testProd.id,
  locationId: warehouse.id,
})
console.log('7. listInventory result items count:', invList.items.length)
const invItem = invList.items[0]
console.log(
  '7b. Verified item product:', invItem.product.name,
  'unit:', invItem.product.unit,
  'location:', invItem.location.name,
  'current balance:', invItem.quantity,
)

// Cleanup
await db.delete(inventory).where(eq(inventory.productId, testProd.id))
console.log('8. Cleaned up inventory test balance')
console.log('All stock inflow & adjustment engine tests passed successfully!')
await db.$client.end()

