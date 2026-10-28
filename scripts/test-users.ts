import { eq } from 'drizzle-orm'
import { createSupabaseAdminClient } from '../src/server/auth/supabase.ts'
import { db } from '../src/server/db/index.ts'
import { profiles } from '../src/server/db/schema/index.ts'
import {
  createUser,
  listUsers,
  toggleUserActive,
  updateUserRole,
} from '../src/server/services/users.ts'

const [admin] = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.role, 'admin'))
  .limit(1)
if (!admin) throw new Error('No admin profile found')

const supabaseAdmin = createSupabaseAdminClient()
const testEmail = `test.employee.${Date.now()}@example.com`

// 1. Create a new employee
const newEmp = await createUser(
  {
    email: testEmail,
    password: 'Password123!',
    username: `emp_${Date.now()}`,
    role: 'employee',
  },
  admin.id,
)
console.log('1. User created:', newEmp.id, 'role:', newEmp.role, 'email:', newEmp.email)

// 2. List users
const list1 = await listUsers({ search: testEmail })
console.log('2. listUsers found created user count:', list1.items.length)
if (list1.items.length === 0) throw new Error('User not found in list')

// 3. Promote employee to admin
const promoted = await updateUserRole({ id: newEmp.id, role: 'admin' }, admin.id)
console.log('3. Promoted to admin -> role:', promoted.role)

// 4. Demote back to employee
const demoted = await updateUserRole({ id: newEmp.id, role: 'employee' }, admin.id)
console.log('4. Demoted to employee -> role:', demoted.role)

// 5. Test preventing demoting the only active admin
try {
  await updateUserRole({ id: admin.id, role: 'employee' }, admin.id)
  console.log('5. UNEXPECTED: allowed demoting the only active admin')
} catch (err) {
  console.log('5. Blocked demoting only admin as expected:', (err as Error).message)
}

// 6. Test preventing deactivating the only active admin
try {
  await toggleUserActive({ id: admin.id, isActive: false }, admin.id)
  console.log('6. UNEXPECTED: allowed deactivating the only active admin')
} catch (err) {
  console.log('6. Blocked deactivating only admin as expected:', (err as Error).message)
}

// 7. Deactivate the employee account
const deactivated = await toggleUserActive({ id: newEmp.id, isActive: false }, admin.id)
console.log('7. Employee deactivated -> isActive:', deactivated.isActive)

// 8. Reactivate the employee account
const reactivated = await toggleUserActive({ id: newEmp.id, isActive: true }, admin.id)
console.log('8. Employee reactivated -> isActive:', reactivated.isActive)

// Cleanup
await db.delete(profiles).where(eq(profiles.id, newEmp.id))
await supabaseAdmin.auth.admin.deleteUser(newEmp.id)
console.log('9. Test user cleaned up successfully')
await db.$client.end()

