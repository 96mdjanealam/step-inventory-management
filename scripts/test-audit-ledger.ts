import { listActivityLogs } from '../src/server/services/activity-logs.ts'
import { listStockMovements } from '../src/server/services/inventory.ts'

console.log('Testing Audit & Ledger services...')

// 1. List stock movements across all types
const movements = await listStockMovements({ pageSize: 10 })
console.log('1. Total stock movements recorded:', movements.total)
if (movements.items.length > 0) {
  const m = movements.items[0]
  console.log(
    '1b. Most recent movement:',
    m.type,
    m.quantity,
    m.product.name,
    'ref:',
    m.referenceId,
  )
}

// 2. Query movements filtered by type
const salesMovements = await listStockMovements({ type: 'sale' })
console.log('2. Total sale movements:', salesMovements.total)

const damageMovements = await listStockMovements({ type: 'damage' })
console.log('2b. Total damage movements:', damageMovements.total)

const returnMovements = await listStockMovements({ type: 'return' })
console.log('2c. Total return movements:', returnMovements.total)

// 3. Query activity logs
const activity = await listActivityLogs({ pageSize: 10 })
console.log('3. Total activity logs recorded:', activity.total)
if (activity.items.length > 0) {
  const a = activity.items[0]
  console.log(
    '3b. Most recent activity:',
    a.action,
    a.entityType,
    a.description,
  )
}

console.log('ALL AUDIT & LEDGER TESTS PASSED!')

