import { eq, sql } from 'drizzle-orm'
import { db } from '../src/server/db/index.ts'
import {
  inventory,
  locations,
  profiles,
} from '../src/server/db/schema/index.ts'
import { createProductSchema } from '../src/lib/schemas/product.ts'
import { createProduct } from '../src/server/services/products.ts'
import { addStock } from '../src/server/services/inventory.ts'
import { createTransfer } from '../src/server/services/transfers.ts'
import { createSale, getSaleById } from '../src/server/services/sales.ts'
import { createReturn } from '../src/server/services/returns.ts'
import { reportDamage, resolveDamage } from '../src/server/services/damage.ts'

console.log('========================================================')
console.log('   FULL SYSTEM LIFECYCLE INTEGRATION TEST')
console.log('========================================================\n')

// 0. Environment & Admin Verification
const [admin] = await db
  .select({ id: profiles.id, role: profiles.role })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)

if (!admin) throw new Error('Admin profile not found in database')

const allLocs = await db.select().from(locations)
const warehouse = allLocs.find((l) => l.type === 'warehouse')
const store = allLocs.find((l) => l.type === 'store' && l.storeType === 'ownstore')
  || allLocs.find((l) => l.type === 'store')
const damagedStock = allLocs.find((l) => l.type === 'damaged')

if (!warehouse || !store || !damagedStock) {
  throw new Error('Required locations (warehouse, store, damaged) must exist')
}

console.log(`[Setup] Locations:`)
console.log(`  - Warehouse: ${warehouse.name} (${warehouse.id})`)
console.log(`  - Store: ${store.name} (${store.id})`)
console.log(`  - Central Damaged: ${damagedStock.name} (${damagedStock.id})\n`)

// ---------------------------------------------------------
// STEP 1: Product Creation
// ---------------------------------------------------------
console.log('--- Step 1: Product Creation ---')
const testSku = `LIFECYCLE-SKU-${Date.now()}`
const product = await createProduct(
  createProductSchema.parse({
    name: `Premium Eco Kettle ${Date.now()}`,
    category: 'appliances',
    measurementType: 'count',
    unit: 'piece',
    discountedPrice: '75.00',
    regularPrice: '90.00',
    sku: testSku,
  }),
  admin.id,
)
const variant = product.variants[0]
console.log(`✓ Product created: "${product.name}"`)
console.log(`✓ Default Variant: SKU ${variant.sku}, Price $${variant.discountedPrice}\n`)

// ---------------------------------------------------------
// STEP 2: Inflow Stock to Warehouse
// ---------------------------------------------------------
console.log('--- Step 2: Stock Inflow ---')
await addStock(
  {
    variantId: variant.id,
    locationId: warehouse.id,
    quantity: '100.000',
    reason: 'Initial shipment arrival from manufacturer',
  },
  admin.id,
)

const [whStock1] = await db
  .select()
  .from(inventory)
  .where(sql`${inventory.variantId} = ${variant.id} AND ${inventory.locationId} = ${warehouse.id}`)

if (whStock1?.quantity !== '100.000') {
  throw new Error(`Expected warehouse balance 100.000, got ${whStock1?.quantity}`)
}
console.log(`✓ Warehouse received 100.000 units (Balance: 100.000)\n`)

// ---------------------------------------------------------
// STEP 3: Stock Transfer: Warehouse -> Store
// ---------------------------------------------------------
console.log('--- Step 3: Inter-Location Transfer ---')
await createTransfer(
  {
    variantId: variant.id,
    sourceLocationId: warehouse.id,
    destinationLocationId: store.id,
    quantity: '40.000',
    notes: 'Restock retail branch for weekend sale',
  },
  admin.id,
)

const [whStock2] = await db
  .select()
  .from(inventory)
  .where(sql`${inventory.variantId} = ${variant.id} AND ${inventory.locationId} = ${warehouse.id}`)
const [storeStock1] = await db
  .select()
  .from(inventory)
  .where(sql`${inventory.variantId} = ${variant.id} AND ${inventory.locationId} = ${store.id}`)

if (whStock2?.quantity !== '60.000' || storeStock1?.quantity !== '40.000') {
  throw new Error(`Transfer balances incorrect: WH=${whStock2?.quantity}, Store=${storeStock1?.quantity}`)
}
console.log(`✓ Transferred 40.000 units from Warehouse to ${store.name}`)
console.log(`  - Warehouse Balance: ${whStock2?.quantity}`)
console.log(`  - Store Balance: ${storeStock1?.quantity}\n`)

// ---------------------------------------------------------
// STEP 4: Retail POS Sale
// ---------------------------------------------------------
console.log('--- Step 4: Point-of-Sale Customer Order ---')
const sale = await createSale(
  {
    locationId: store.id,
    customerName: 'Robert Langdon',
    customerPhone: '+1 415-555-0123',
    items: [{ variantId: variant.id, quantity: '15.000' }],
    notes: 'Walk-in cash sale',
  },
  admin.id,
)

const saleFull = await getSaleById(sale.id)
if (!saleFull || saleFull.items[0].subtotal !== '1125.00') {
  throw new Error(`Expected subtotal 1125.00 (15 * $75.00), got ${saleFull?.items[0].subtotal}`)
}

const [storeStock2] = await db
  .select()
  .from(inventory)
  .where(sql`${inventory.variantId} = ${variant.id} AND ${inventory.locationId} = ${store.id}`)

if (storeStock2?.quantity !== '25.000') {
  throw new Error(`Expected store balance 25.000, got ${storeStock2?.quantity}`)
}
console.log(`✓ Sale created: ${sale.orderNumber}`)
console.log(`  - Total Amount: $${sale.totalAmount} (15 units @ $75.00)`)
console.log(`  - Store Stock Decremented: 40.000 -> ${storeStock2?.quantity}\n`)

// ---------------------------------------------------------
// STEP 5: Customer Return & Restock
// ---------------------------------------------------------
console.log('--- Step 5: Customer Return & Refund ---')
const saleItemId = saleFull.items[0].id
const returnReceipt = await createReturn(
  {
    saleId: sale.id,
    reason: 'Customer bought 5 units as gifts, kept 10, returned 5 unopened',
    items: [{ saleItemId, quantity: '5.000' }],
  },
  admin.id,
)

const [storeStock3] = await db
  .select()
  .from(inventory)
  .where(sql`${inventory.variantId} = ${variant.id} AND ${inventory.locationId} = ${store.id}`)

if (storeStock3?.quantity !== '30.000') {
  throw new Error(`Expected store balance 30.000 (25 + 5), got ${storeStock3?.quantity}`)
}
console.log(`✓ Return processed: ${returnReceipt.returnNumber}`)
console.log(`  - Refund Amount: $${returnReceipt.totalRefundAmount} (5 units @ $75.00)`)
console.log(`  - Store Stock Restored: 25.000 -> ${storeStock3?.quantity}\n`)

// ---------------------------------------------------------
// STEP 6: Damage Quarantine into Central Damaged Stock
// ---------------------------------------------------------
console.log('--- Step 6: Damaged Stock Quarantine ---')
const damageReport = await reportDamage(
  {
    sourceLocationId: store.id,
    variantId: variant.id,
    quantity: '6.000',
    reason: 'Shelf collapsed during restocking; 6 units dented',
  },
  admin.id,
)

const [storeStock4] = await db
  .select()
  .from(inventory)
  .where(sql`${inventory.variantId} = ${variant.id} AND ${inventory.locationId} = ${store.id}`)
const [damagedStock1] = await db
  .select()
  .from(inventory)
  .where(sql`${inventory.variantId} = ${variant.id} AND ${inventory.locationId} = ${damagedStock.id}`)

if (storeStock4?.quantity !== '24.000' || damagedStock1?.quantity !== '6.000') {
  throw new Error(`Balances incorrect after quarantine: Store=${storeStock4?.quantity}, Damaged=${damagedStock1?.quantity}`)
}
console.log(`✓ Quarantined 6 units into Central Damaged Stock: ${damageReport.damageNumber}`)
console.log(`  - Store Stock: 30.000 -> ${storeStock4?.quantity}`)
console.log(`  - Central Damaged Stock: 0.000 -> ${damagedStock1?.quantity}\n`)

// ---------------------------------------------------------
// STEP 7: Damaged Stock Resolution (Repair & Restock)
// ---------------------------------------------------------
console.log('--- Step 7: Damage Resolution (Repair) ---')
const resolvedReport = await resolveDamage(
  {
    damageReportId: damageReport.id,
    action: 'repair',
    resolutionLocationId: warehouse.id,
    notes: 'Technician repaired and buffed out dented kettles; passed QC',
  },
  admin.id,
)

const [whStock3] = await db
  .select()
  .from(inventory)
  .where(sql`${inventory.variantId} = ${variant.id} AND ${inventory.locationId} = ${warehouse.id}`)
const [damagedStock2] = await db
  .select()
  .from(inventory)
  .where(sql`${inventory.variantId} = ${variant.id} AND ${inventory.locationId} = ${damagedStock.id}`)

if (whStock3?.quantity !== '66.000' || damagedStock2?.quantity !== '0.000') {
  throw new Error(`Balances incorrect after repair: WH=${whStock3?.quantity}, Damaged=${damagedStock2?.quantity}`)
}
console.log(`✓ Resolved ${resolvedReport.damageNumber} via Repair`)
console.log(`  - Central Damaged Stock: 6.000 -> ${damagedStock2?.quantity}`)
console.log(`  - Warehouse Balance: 60.000 -> ${whStock3?.quantity}\n`)

// ---------------------------------------------------------
// STEP 8: Immutability & Constraint Enforcement Checks
// ---------------------------------------------------------
console.log('--- Step 8: Security & Constraint Verification ---')

// 8a. Check DB trigger blocks modification of stock_movements
let triggerProtected = false
try {
  await db.execute(sql`DELETE FROM stock_movements WHERE reference_id = ${sale.orderNumber}`)
} catch (e: any) {
  triggerProtected = true
  console.log(`✓ Database trigger blocked DELETE on stock_movements: "${e.message?.split('\n')[0]}"`)
}
if (!triggerProtected) throw new Error('stock_movements trigger failed to protect immutable ledger!')

// 8b. Check DB trigger blocks modification of activity_logs
let activityTriggerProtected = false
try {
  await db.execute(sql`UPDATE activity_logs SET description = 'Hacked' WHERE entity_id = ${sale.id}`)
} catch (e: any) {
  activityTriggerProtected = true
  console.log(`✓ Database trigger blocked UPDATE on activity_logs: "${e.message?.split('\n')[0]}"`)
}
if (!activityTriggerProtected) throw new Error('activity_logs trigger failed to protect immutable ledger!')

// 8c. Check oversell protection
let oversellBlocked = false
try {
  await createSale(
    {
      locationId: store.id,
      items: [{ variantId: variant.id, quantity: '999.000' }],
    },
    admin.id,
  )
} catch (e: any) {
  oversellBlocked = true
  console.log(`✓ Oversell successfully rejected: "${e.message}"`)
}
if (!oversellBlocked) throw new Error('Oversell should have been rejected!')

// 8d. Check over-return protection (max returnable was 15 - 5 = 10; trying to return 11)
let overReturnBlocked = false
try {
  await createReturn(
    {
      saleId: sale.id,
      reason: 'Trying to return more than purchased',
      items: [{ saleItemId, quantity: '11.000' }],
    },
    admin.id,
  )
} catch (e: any) {
  overReturnBlocked = true
  console.log(`✓ Over-return successfully rejected: "${e.message}"`)
}
if (!overReturnBlocked) throw new Error('Over-return should have been rejected!')

// 8e. Mathematical Balance Re-verification
// Total units in system: 100 received - 10 sold net (15 bought - 5 returned) = 90 total units remaining in system.
// WH: 60 remaining + 6 repaired = 66
// Store: 40 transferred - 15 sold + 5 returned - 6 damaged = 24
// Total: 66 + 24 = 90! Exact mathematical match!
const currentWH = whStock3?.quantity
const currentStore = storeStock4?.quantity
console.log(`\n--- Step 9: Mathematical Balance Reconciliation ---`)
console.log(`✓ Warehouse Stock: ${currentWH}`)
console.log(`✓ Store Stock:     ${currentStore}`)
console.log(`✓ Total In-Stock:  ${Number(currentWH) + Number(currentStore)} (Exact match with net ledger: 100 in - 10 sold)\n`)

console.log('========================================================')
console.log('   CONGRATULATIONS: ALL SYSTEM LIFECYCLE TESTS PASSED!  ')
console.log('========================================================')
