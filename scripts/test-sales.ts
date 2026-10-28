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
  cancelSale,
  createSale,
  getSaleById,
  listSales,
} from '../src/server/services/sales.ts'

const [admin] = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)
if (!admin) throw new Error('No admin profile found')

const allLocs = await db.select().from(locations)
const warehouse = allLocs.find((l) => l.type === 'warehouse')
const store = allLocs.find((l) => l.type === 'store')

if (!warehouse || !store) {
  throw new Error('Warehouse and store locations must exist')
}

// 1. Create product with variant
const product = await createProduct(
  createProductSchema.parse({
    name: `Sale Test Product ${Date.now()}`,
    category: 'sale-test',
    measurementType: 'count',
    unit: 'piece',
    discountedPrice: '25.50',
    sku: `SKU-SALE-${Date.now()}`,
  }),
  admin.id,
)
const variant = product.variants[0]
console.log('1. Created product variant:', variant.sku, 'with price $25.50')

// 2. Add stock to store
await addStock(
  {
    variantId: variant.id,
    locationId: store.id,
    quantity: '20.000',
    reason: 'Initial store stock for sales test',
  },
  admin.id,
)
console.log('2. Added 20.000 units to store:', store.name)

// 3. Test: Cannot sell from warehouse
let warehouseRejected = false
try {
  await createSale(
    {
      locationId: warehouse.id,
      items: [{ variantId: variant.id, quantity: '1.000' }],
    },
    admin.id,
  )
} catch (e: any) {
  warehouseRejected = true
  console.log('3. Successfully blocked sale from warehouse:', e.message)
}
if (!warehouseRejected) throw new Error('Sale from warehouse should have failed')

// 4. Test: Cannot oversell
let oversellRejected = false
try {
  await createSale(
    {
      locationId: store.id,
      items: [{ variantId: variant.id, quantity: '25.000' }],
    },
    admin.id,
  )
} catch (e: any) {
  oversellRejected = true
  console.log('4. Successfully blocked oversell:', e.message)
}
if (!oversellRejected) throw new Error('Oversell should have failed')

// 5. Create valid sale: 5 units @ $25.50 = $127.50
const sale = await createSale(
  {
    locationId: store.id,
    customerName: 'John Doe',
    customerPhone: '+1234567890',
    items: [{ variantId: variant.id, quantity: '5.000' }],
    notes: 'Walk-in customer sale',
  },
  admin.id,
)
console.log(
  '5. Created sale successfully:',
  sale.orderNumber,
  'Total:',
  sale.totalAmount,
)

// Verify store balance is now 15.000
const [invRowAfterSale] = await db
  .select()
  .from(inventory)
  .where(eq(inventory.variantId, variant.id))
if (invRowAfterSale.quantity !== '15.000') {
  throw new Error(`Expected balance 15.000, got ${invRowAfterSale.quantity}`)
}
console.log('5b. Verified inventory decremented to 15.000')

// 6. Fetch sale details
const saleDetail = await getSaleById(sale.id)
if (!saleDetail || saleDetail.items.length !== 1) {
  throw new Error('Failed to fetch sale details with items')
}
if (saleDetail.items[0].subtotal !== '127.50') {
  throw new Error(
    `Expected subtotal 127.50, got ${saleDetail.items[0].subtotal}`,
  )
}
console.log(
  '6. Verified sale details: item price snapshot =',
  saleDetail.items[0].unitPrice,
  'subtotal =',
  saleDetail.items[0].subtotal,
)

// 7. List sales
const saleList = await listSales({ search: 'John Doe' })
if (saleList.sales.length === 0) {
  throw new Error('Failed to find sale in list by customer name')
}
console.log('7. Verified listSales found order:', saleList.sales[0].orderNumber)

// 8. Cancel sale
const cancelledSale = await cancelSale(
  {
    saleId: sale.id,
    reason: 'Customer requested refund / cancel',
  },
  admin.id,
)
console.log(
  '8. Cancelled sale:',
  cancelledSale.orderNumber,
  'Status:',
  cancelledSale.status,
)

// Verify store balance restored back to 20.000
const [invRowAfterCancel] = await db
  .select()
  .from(inventory)
  .where(eq(inventory.variantId, variant.id))
if (invRowAfterCancel.quantity !== '20.000') {
  throw new Error(`Expected restored balance 20.000, got ${invRowAfterCancel.quantity}`)
}
console.log('8b. Verified inventory restored to 20.000')

// 9. Cannot cancel already cancelled sale
let doubleCancelRejected = false
try {
  await cancelSale(
    {
      saleId: sale.id,
      reason: 'Trying to cancel again',
    },
    admin.id,
  )
} catch (e: any) {
  doubleCancelRejected = true
  console.log('9. Successfully blocked double cancellation:', e.message)
}
if (!doubleCancelRejected) {
  throw new Error('Double cancellation should have failed')
}

console.log('ALL SALES TESTS PASSED!')
