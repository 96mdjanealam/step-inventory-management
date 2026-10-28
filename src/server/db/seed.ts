import { db } from './index.ts'
import { locations } from './schema/index.ts'

await db
  .insert(locations)
  .values([
    { name: 'Main Warehouse', type: 'warehouse' },
    { name: 'Damaged Stock', type: 'damaged' },
  ])
  .onConflictDoNothing()

console.log('Seed complete')
await db.$client.end()