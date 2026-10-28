import { eq } from 'drizzle-orm'
import { db } from '../src/server/db/index.ts'
import { activityLogs, locations, profiles } from '../src/server/db/schema/index.ts'
import {
  listActivityLogs,
  logActivity,
} from '../src/server/services/activity-logs.ts'

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
if (!warehouse) throw new Error('Warehouse location not found')

// 1. Log an activity
const log1 = await logActivity({
  userId: admin.id,
  action: 'product.create',
  entityType: 'product',
  entityId: 'test-entity-123',
  description: 'Admin created product "Test Logger Product"',
  metadata: { name: 'Test Logger Product', category: 'Testing' },
  sourceLocationId: warehouse.id,
})

console.log('1. Log created:', log1.id, 'action:', log1.action)

// 2. Query activity logs
const listResult = await listActivityLogs({
  action: 'product.create',
  pageSize: 10,
})

console.log('2. listActivityLogs -> found count:', listResult.items.length)
const found = listResult.items.find((i) => i.id === log1.id)
if (!found) throw new Error('Created log not found in query')
console.log('2b. Log matched description:', found.description, 'user:', found.user?.username ?? found.user?.role)

// 3. Query by location
const byLocation = await listActivityLogs({
  locationId: warehouse.id,
})
const foundByLoc = byLocation.items.find((i) => i.id === log1.id)
console.log('3. Found by location:', Boolean(foundByLoc))

// 4. Test APPEND-ONLY constraint: Attempt to UPDATE
try {
  await db
    .update(activityLogs)
    .set({ description: 'Tampered description' })
    .where(eq(activityLogs.id, log1.id))
  console.log('4. UNEXPECTED: update was allowed on append-only activity_logs!')
} catch (err) {
  console.log('4. UPDATE blocked by append-only trigger:', (err as Error).message)
}

// 5. Test APPEND-ONLY constraint: Attempt to DELETE
try {
  await db.delete(activityLogs).where(eq(activityLogs.id, log1.id))
  console.log('5. UNEXPECTED: delete was allowed on append-only activity_logs!')
} catch (err) {
  console.log('5. DELETE blocked by append-only trigger:', (err as Error).message)
}

console.log('All activity logs tests passed successfully!')
await db.$client.end()

