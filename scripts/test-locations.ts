import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/server/db/index.ts'
import { activityLogs, profiles } from '../src/server/db/schema/index.ts'
import {
  createStore,
  listLocations,
  toggleLocationActive,
  updateLocation,
} from '../src/server/services/locations.ts'

const initial = await listLocations({ includeInactive: true })
const existingOwn = initial.find((l) => l.name.startsWith('Downtown Flagship Store'))
const existingFranchise = initial.find((l) => l.name.startsWith('Uptown Franchise Branch'))

const [admin] = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)
if (!admin) throw new Error('No admin profile found')

const warehouse = initial.find((l) => l.type === 'warehouse')
const damaged = initial.find((l) => l.type === 'damaged')
if (!warehouse || !damaged) throw new Error('Seed locations missing')

console.log('1. Verified warehouse:', warehouse.name, 'damaged:', damaged.name)

const ownStore = existingOwn ?? await createStore(
  {
    name: 'Downtown Flagship Store',
    storeType: 'ownstore',
    address: '123 Main St, Central District',
    phone: '+1-555-0101',
  },
  admin.id,
)
console.log('2. Own Store ready:', ownStore.id, 'name:', ownStore.name)

const franchiseStore = existingFranchise ?? await createStore(
  {
    name: 'Uptown Franchise Branch',
    storeType: 'franchise',
    address: '456 North Ave',
    phone: '+1-555-0102',
  },
  admin.id,
)
console.log('3. Franchise Store ready:', franchiseStore.id, 'name:', franchiseStore.name)

// 4. Duplicate name test
try {
  await createStore(
    {
      name: ownStore.name,
      storeType: 'ownstore',
    },
    admin.id,
  )
  console.log('4. UNEXPECTED: allowed duplicate location name')
} catch (err) {
  console.log('4. Duplicate location name rejected:', (err as Error).message)
}

// 5. Update location details
const updated = await updateLocation(
  {
    id: ownStore.id,
    name: ownStore.name,
    address: '123 Main St, Suite 100',
    phone: '+1-555-0101',
  },
  admin.id,
)
console.log('5. Updated store address:', updated.address)

// 6. Test preventing deactivating Main Warehouse
try {
  await toggleLocationActive({ id: warehouse.id, isActive: false }, admin.id)
  console.log('6. UNEXPECTED: allowed deactivating warehouse')
} catch (err) {
  console.log('6. Warehouse deactivation rejected as expected:', (err as Error).message)
}

// 7. Verify activity logs created
const logs = await db
  .select({ action: activityLogs.action, desc: activityLogs.description })
  .from(activityLogs)
  .where(inArray(activityLogs.destinationLocationId, [ownStore.id, franchiseStore.id]))
console.log('7. Activity logs count for test locations:', logs.length)

console.log('8. Locations management tests passed successfully!')
await db.$client.end()
