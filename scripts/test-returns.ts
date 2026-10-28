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
import { createSale, getSaleById } from '../src/server/services/sales.ts'
import {
  createReturn,
  getReturnById,
  listReturns,
} from '../src/server/services/returns.ts'

const [admin] = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)
if (!admin) throw new Error('No admin profile found')

const allLocs = await db.select().from(locations)
const store = allLocs.find((l) => l.type === 'store')
if (!store) throw new Error('Store location must exist')

// 1. Create product & variant
const product = await createProduct(
  createProductSchema.parse({
    name: `Return Test Product ${Date.now()}`,
    category: 'return-test',
    measurementType: 'count',
    unit: 'piece',
    discountedPrice: '40.00',
    sku: `SKU-RET-${Date.now()}`,
  }),
  admin.id,
)
const variant = product.variants[0]
console.log('1. Created product variant:', variant.sku, 'Price $40.00')

// 2. Add 20 units to store
await addStock(
  {
    variantId: variant.id,
    locationId: store.id,
    quantity: '20.000',
    reason: 'Initial stock for return test',
  },
  admin.id,
)
console.log('2. Added 20.000 units to store:', store.name)

// 3. Make a sale of 10 units (balance drops to 10.000)
const sale = await createSale(
  {
    locationId: store.id,
    customerName: 'Alice Customer',
    customerPhone: '+1987654321',
    items: [{ variantId: variant.id, quantity: '10.000' }],
    notes: 'Sale to be tested for returns',
  },
  admin.id,
)
console.log(
  '3. Created sale order:',
  sale.orderNumber,
  'Total:',
  sale.totalAmount,
)

// Check sale item ID
const saleFull = await getSaleById(sale.id)
if (!saleFull || saleFull.items.length === 0) {
  throw new Error('Sale item not found')
}
const saleItemId = saleFull.items[0].id
console.log('Sale Item ID:', saleItemId)

// 4. Return 3 units (first partial return)
const return1 = await createReturn(
  {
    saleId: sale.id,
    reason: 'Wrong size / model',
    items: [{ saleItemId, quantity: '3.000' }],
  },
  admin.id,
)
console.log(
  '4. Created return 1:',
  return1.returnNumber,
  'Refund:',
  return1.totalRefundAmount,
)

if (return1.totalRefundAmount !== '120.00') {
  throw new Error(
    `Expected refund 120.00 (3 * $40.00), got ${return1.totalRefundAmount}`,
  )
}

// Verify store balance is now 10 + 3 = 13.000
const [invAfterRet1] = await db
  .select()
  .from(inventory)
  .where(eq(inventory.variantId, variant.id))
if (invAfterRet1.quantity !== '13.000') {
  throw new Error(`Expected balance 13.000, got ${invAfterRet1.quantity}`)
}
console.log('4b. Verified stock balance restored to 13.000')

// 5. Test over-return rejection (trying to return 8 more when only 7 remain returnable)
let overReturnRejected = false
try {
  await createReturn(
    {
      saleId: sale.id,
      reason: 'Trying to return too many',
      items: [{ saleItemId, quantity: '8.000' }],
    },
    admin.id,
  )
} catch (e: any) {
  overReturnRejected = true
  console.log('5. Successfully blocked over-return:', e.message)
}
if (!overReturnRejected) throw new Error('Over-return should have failed')

// 6. Return the remaining 7 units
const return2 = await createReturn(
  {
    saleId: sale.id,
    reason: 'Returning remaining units',
    items: [{ saleItemId, quantity: '7.000' }],
  },
  admin.id,
)
console.log(
  '6. Created return 2:',
  return2.returnNumber,
  'Refund:',
  return2.totalRefundAmount,
)

// Verify store balance is restored back to 20.000
const [invAfterRet2] = await db
  .select()
  .from(inventory)
  .where(eq(inventory.variantId, variant.id))
if (invAfterRet2.quantity !== '20.000') {
  throw new Error(`Expected balance 20.000, got ${invAfterRet2.quantity}`)
}
console.log('6b. Verified stock balance fully restored to 20.000')

// 7. Verify zero remaining returnable units
let zeroReturnRejected = false
try {
  await createReturn(
    {
      saleId: sale.id,
      reason: 'Returning after full return',
      items: [{ saleItemId, quantity: '1.000' }],
    },
    admin.id,
  )
} catch (e: any) {
  zeroReturnRejected = true
  console.log('7. Successfully blocked return beyond 100%:', e.message)
}
if (!zeroReturnRejected) throw new Error('Return beyond 100% should have failed')

// 8. List returns
const returnList = await listReturns({ saleId: sale.id })
if (returnList.returns.length !== 2) {
  throw new Error(
    `Expected 2 returns for this sale, got ${returnList.returns.length}`,
  )
}
console.log(
  '8. Verified listReturns found both returns:',
  returnList.returns.map((r) => r.returnNumber).join(', '),
)

// 9. Get return by ID
const returnDetail = await getReturnById(return1.id)
if (!returnDetail || returnDetail.items.length !== 1) {
  throw new Error('Failed to fetch return detail')
}
console.log(
  '9. Verified getReturnById:',
  returnDetail.returnNumber,
  'item:',
  returnDetail.items[0].productName,
  'quantity:',
  returnDetail.items[0].quantity,
)

console.log('ALL RETURNS TESTS PASSED!')
