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
  getDamageReportById,
  listDamageReports,
  reportDamage,
  resolveDamage,
} from '../src/server/services/damage.ts'

const [admin] = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)
if (!admin) throw new Error('No admin profile found')

const allLocs = await db.select().from(locations)
const warehouse = allLocs.find((l) => l.type === 'warehouse')
const store = allLocs.find((l) => l.type === 'store')
const damagedStock = allLocs.find((l) => l.type === 'damaged')

if (!warehouse || !store || !damagedStock) {
  throw new Error('Warehouse, store, and damaged stock locations must exist')
}

// 1. Create product & variant
const product = await createProduct(
  createProductSchema.parse({
    name: `Damage Test Product ${Date.now()}`,
    category: 'damage-test',
    measurementType: 'count',
    unit: 'piece',
    discountedPrice: '50.00',
    sku: `SKU-DAM-${Date.now()}`,
  }),
  admin.id,
)
const variant = product.variants[0]
console.log('1. Created product variant:', variant.sku)

// 2. Add 50 units to warehouse and 20 units to store
await addStock(
  {
    variantId: variant.id,
    locationId: warehouse.id,
    quantity: '50.000',
    reason: 'Initial warehouse stock for damage test',
  },
  admin.id,
)
await addStock(
  {
    variantId: variant.id,
    locationId: store.id,
    quantity: '20.000',
    reason: 'Initial store stock for damage test',
  },
  admin.id,
)
console.log('2. Seeded initial stock: Warehouse=50, Store=20')

// 3. Test: Cannot report damage from Central Damaged Stock location
let selfDamageRejected = false
try {
  await reportDamage(
    {
      sourceLocationId: damagedStock.id,
      variantId: variant.id,
      quantity: '1.000',
      reason: 'Trying to report damage from damaged location',
    },
    admin.id,
  )
} catch (e: any) {
  selfDamageRejected = true
  console.log('3. Successfully blocked damage report from damaged location:', e.message)
}
if (!selfDamageRejected) throw new Error('Should block damage report from damaged location')

// 4. Test: Cannot report damage exceeding available stock
let overDamageRejected = false
try {
  await reportDamage(
    {
      sourceLocationId: warehouse.id,
      variantId: variant.id,
      quantity: '60.000',
      reason: 'Trying to quarantine more than in warehouse',
    },
    admin.id,
  )
} catch (e: any) {
  overDamageRejected = true
  console.log('4. Successfully blocked over-damage quarantine:', e.message)
}
if (!overDamageRejected) throw new Error('Should block over-damage quarantine')

// 5. Report 10 units damaged from warehouse (quarantine)
const rep1 = await reportDamage(
  {
    sourceLocationId: warehouse.id,
    variantId: variant.id,
    quantity: '10.000',
    reason: 'Water leak damaged packaging box',
  },
  admin.id,
)
console.log('5. Reported damage 1:', rep1.damageNumber, 'Status:', rep1.status)

// Verify warehouse balance = 40.000, damaged stock = 10.000
const whRow = (await db.select().from(inventory).where(eq(inventory.variantId, variant.id))).find(r => r.locationId === warehouse.id)
const damRow = (await db.select().from(inventory).where(eq(inventory.variantId, variant.id))).find(r => r.locationId === damagedStock.id)

if (whRow?.quantity !== '40.000') {
  throw new Error(`Expected warehouse balance 40.000, got ${whRow?.quantity}`)
}
if (damRow?.quantity !== '10.000') {
  throw new Error(`Expected damaged stock balance 10.000, got ${damRow?.quantity}`)
}
console.log('5b. Verified inventory after quarantine: Warehouse=40.000, Damaged Stock=10.000')

// 6. Report 4 units damaged from store
const rep2 = await reportDamage(
  {
    sourceLocationId: store.id,
    variantId: variant.id,
    quantity: '4.000',
    reason: 'Dropped by customer in aisle',
  },
  admin.id,
)
console.log('6. Reported damage 2:', rep2.damageNumber)

// 7. Resolve rep2 via Repair (send to warehouse)
const resolvedRepair = await resolveDamage(
  {
    damageReportId: rep2.id,
    action: 'repair',
    resolutionLocationId: warehouse.id,
    notes: 'Repackaged with fresh outer carton and verified intact',
  },
  admin.id,
)
console.log('7. Resolved via repair:', resolvedRepair.damageNumber, 'Status:', resolvedRepair.status)

// Warehouse should now be 40 + 4 = 44.000
const whRowAfterRepair = (await db.select().from(inventory).where(eq(inventory.variantId, variant.id))).find(r => r.locationId === warehouse.id)
if (whRowAfterRepair?.quantity !== '44.000') {
  throw new Error(`Expected warehouse balance 44.000, got ${whRowAfterRepair?.quantity}`)
}
console.log('7b. Verified warehouse stock restored to 44.000')

// 8. Resolve rep1 via Disposal (write off 10 units)
const resolvedDisposal = await resolveDamage(
  {
    damageReportId: rep1.id,
    action: 'disposal',
    notes: 'Irreparable water damage, discarded at recycling depot',
  },
  admin.id,
)
console.log('8. Resolved via disposal:', resolvedDisposal.damageNumber, 'Status:', resolvedDisposal.status)

// Damaged stock should now be 0.000
const damRowAfterDisposal = (await db.select().from(inventory).where(eq(inventory.variantId, variant.id))).find(r => r.locationId === damagedStock.id)
if (damRowAfterDisposal?.quantity !== '0.000') {
  throw new Error(`Expected damaged stock balance 0.000, got ${damRowAfterDisposal?.quantity}`)
}
console.log('8b. Verified damaged stock decremented to 0.000')

// 9. Cannot double-resolve
let doubleResolveRejected = false
try {
  await resolveDamage(
    {
      damageReportId: rep1.id,
      action: 'disposal',
      notes: 'Trying to resolve again',
    },
    admin.id,
  )
} catch (e: any) {
  doubleResolveRejected = true
  console.log('9. Successfully blocked double-resolution:', e.message)
}
if (!doubleResolveRejected) throw new Error('Double-resolution should have failed')

// 10. List damage reports
const listRes = await listDamageReports()
if (listRes.damageReports.length < 2) {
  throw new Error('Expected at least 2 damage reports in list')
}
console.log('10. Verified listDamageReports found reports:', listRes.total)

// 11. Get damage report detail by ID
const repDetail = await getDamageReportById(rep2.id)
if (!repDetail || !repDetail.resolutionLocation || repDetail.status !== 'repaired') {
  throw new Error('Failed to fetch resolved damage report with details')
}
console.log('11. Verified getDamageReportById: resolution location is', repDetail.resolutionLocation.name)

console.log('ALL DAMAGE WORKFLOW TESTS PASSED!')
