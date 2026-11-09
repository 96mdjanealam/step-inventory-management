import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Plus } from 'lucide-react'
import { z } from 'zod'
import { Button } from '../../../components/Button.tsx'
import { ConfirmModal } from '../../../components/ConfirmModal.tsx'
import { Alert } from '../../../components/Alert.tsx'
import { FilterToolbar, SearchInput } from '../../../components/FilterToolbar.tsx'
import { Modal } from '../../../components/Modal.tsx'
import { Select } from '../../../components/Select.tsx'
import { TableCard } from '../../../components/TableCard.tsx'
import { TablePagination } from '../../../components/TablePagination.tsx'
import { useTableAutoRefresh } from '../../../lib/hooks/useTableAutoRefresh.ts'
import {
  createUserFn,
  listUsersFn,
  toggleUserActiveFn,
  updateUserRoleFn,
} from '../../../server/functions/users.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z.number().int().min(1).max(100).default(10).catch(10),
  search: z.string().trim().min(1).optional().catch(undefined),
  role: z.enum(['admin', 'employee']).optional().catch(undefined),
  includeInactive: z.boolean().default(false).catch(false),
})

export const Route = createFileRoute('/_authed/users/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
    search: search.search,
    role: search.role,
    includeInactive: search.includeInactive,
  }),
  loader: ({ deps }) =>
    listUsersFn({
      data: {
        page: deps.page,
        pageSize: deps.pageSize,
        search: deps.search,
        role: deps.role,
        includeInactive: deps.includeInactive,
      },
    }),
  component: UsersPage,
})

function UsersPage() {
  const { items, total, page, pageSize } = Route.useLoaderData()
  const { search, role, includeInactive } = Route.useSearch()
  const { user } = Route.useRouteContext()
  const navigate = Route.useNavigate()
  const router = useRouter()

  const createUser = useServerFn(createUserFn)
  const updateUserRole = useServerFn(updateUserRoleFn)
  const toggleUserActive = useServerFn(toggleUserActiveFn)

  // Modals & States
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createPending, setCreatePending] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [actionPendingId, setActionPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    user: (typeof items)[number]
    newRole: 'admin' | 'employee'
  } | null>(null)
  const [deactivateUserTarget, setDeactivateUserTarget] = useState<
    (typeof items)[number] | null
  >(null)

  useTableAutoRefresh({ enabled: !showCreateModal && !actionPendingId })

  const isAdmin = user.role === 'admin'

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div className="border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-700">Access Restricted</h1>
          <p className="mt-2 text-sm text-red-600">
            Only administrators are authorized to manage team member accounts.
          </p>
          <Link
            to="/products"
            className="mt-4 inline-block bg-black px-4 py-2 text-sm text-white"
          >
            Go to Products
          </Link>
        </div>
      </main>
    )
  }

  function handleSearchQuery(value: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: value || undefined,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  function handleRoleFilter(selectedRole: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        role: (selectedRole || undefined) as 'admin' | 'employee' | undefined,
      }),
      resetScroll: false,
    })
  }

  function handleToggleInactive(checked: boolean) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        includeInactive: checked || undefined,
      }),
      resetScroll: false,
    })
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '').trim()
    const username = String(form.get('username') ?? '').trim() || undefined
    const selectedRole = String(form.get('role') ?? 'employee') as
      | 'admin'
      | 'employee'

    if (!email || !password) {
      setCreateError('Email and password are required')
      return
    }

    if (password.length < 6) {
      setCreateError('Password must be at least 6 characters')
      return
    }

    setCreatePending(true)
    try {
      await createUser({
        data: {
          email,
          password,
          username,
          role: selectedRole,
        },
      })
      await router.invalidate()
      setShowCreateModal(false)
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create user',
      )
    } finally {
      setCreatePending(false)
    }
  }

  function handleRoleChange(
    targetUser: (typeof items)[number],
    newRole: 'admin' | 'employee',
  ) {
    if (targetUser.role === newRole) return
    setRoleChangeTarget({ user: targetUser, newRole })
  }

  async function confirmRoleChange() {
    if (!roleChangeTarget) return
    const { user: targetUser, newRole } = roleChangeTarget
    setActionError(null)
    setActionPendingId(targetUser.id)
    try {
      await updateUserRole({
        data: {
          id: targetUser.id,
          role: newRole,
        },
      })
      await router.invalidate()
      setRoleChangeTarget(null)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update user role',
      )
    } finally {
      setActionPendingId(null)
    }
  }

  async function handleToggleStatus(targetUser: (typeof items)[number]) {
    if (targetUser.isActive) {
      setDeactivateUserTarget(targetUser)
      return
    }

    setActionError(null)
    setActionPendingId(targetUser.id)
    try {
      await toggleUserActive({
        data: {
          id: targetUser.id,
          isActive: true,
        },
      })
      await router.invalidate()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to activate account',
      )
    } finally {
      setActionPendingId(null)
    }
  }

  async function confirmDeactivateUser() {
    if (!deactivateUserTarget) return
    setActionError(null)
    setActionPendingId(deactivateUserTarget.id)
    try {
      await toggleUserActive({
        data: {
          id: deactivateUserTarget.id,
          isActive: false,
        },
      })
      await router.invalidate()
      setDeactivateUserTarget(null)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to deactivate account',
      )
    } finally {
      setActionPendingId(null)
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">User Management</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Create and manage staff accounts and role permissions
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateError(null)
            setShowCreateModal(true)
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New User
        </Button>
      </div>

      {actionError ? (
        <Alert variant="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

      {/* Filter and Search Bar */}
      <FilterToolbar>
        <SearchInput
          defaultValue={search ?? ''}
          placeholder="Search by email or username..."
          onSearch={handleSearchQuery}
          onClear={() => handleSearchQuery('')}
        />

        <FilterToolbar.Right>
          <Select
            value={role ?? ''}
            onChange={(e) => handleRoleFilter(e.target.value)}
            className="w-full sm:w-44"
          >
            <option value="">All Roles</option>
            <option value="admin">Admins only</option>
            <option value="employee">Employees only</option>
          </Select>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600 select-none">
            <input
              type="checkbox"
              checked={Boolean(includeInactive)}
              onChange={(e) => handleToggleInactive(e.target.checked)}
              className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
            />
            Show inactive
          </label>
        </FilterToolbar.Right>
      </FilterToolbar>

      {/* Users Table */}
      <TableCard>
        <TableCard.Table>
          <TableCard.Header>
            <TableCard.Row isHeader>
              <TableCard.Head>User / Email</TableCard.Head>
              <TableCard.Head>Username</TableCard.Head>
              <TableCard.Head>Role</TableCard.Head>
              <TableCard.Head>Status</TableCard.Head>
              <TableCard.Head>Created</TableCard.Head>
              <TableCard.Head align="right">Actions</TableCard.Head>
            </TableCard.Row>
          </TableCard.Header>
          <TableCard.Body>
            {items.length === 0 ? (
              <TableCard.Empty colSpan={6} message="No users found." />
            ) : (
              items.map((u) => {
                const isSelf = u.id === user.id
                return (
                  <TableCard.Row key={u.id}>
                    <TableCard.Cell className="font-medium text-neutral-900">
                      {u.email ?? 'No email'}
                      {isSelf ? (
                        <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 font-normal">
                          You
                        </span>
                      ) : null}
                    </TableCard.Cell>
                    <TableCard.Cell className="text-neutral-600">
                      {u.username ?? '—'}
                    </TableCard.Cell>
                    <TableCard.Cell>
                      <Select
                        value={u.role}
                        disabled={actionPendingId === u.id || isSelf}
                        onChange={(e) =>
                          handleRoleChange(
                            u,
                            e.target.value as 'admin' | 'employee',
                          )
                        }
                        sizeVariant="sm"
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                      </Select>
                    </TableCard.Cell>
                    <TableCard.Cell>
                      {u.isActive ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                          Inactive
                        </span>
                      )}
                    </TableCard.Cell>
                    <TableCard.Cell className="text-xs text-neutral-500 whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCard.Cell>
                    <TableCard.Cell align="right" className="whitespace-nowrap">
                      {!isSelf ? (
                        <Button
                          size="xs"
                          variant={u.isActive ? 'dangerSoft' : 'success'}
                          disabled={actionPendingId === u.id}
                          isLoading={actionPendingId === u.id}
                          onClick={() => handleToggleStatus(u)}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </TableCard.Cell>
                  </TableCard.Row>
                )
              })
            )}
          </TableCard.Body>
        </TableCard.Table>
        <TableCard.Footer>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(newPage) =>
              navigate({
                search: (prev) => ({ ...prev, page: newPage }),
                resetScroll: false,
              })
            }
            onPageSizeChange={(newPageSize) =>
              navigate({
                search: (prev) => ({ ...prev, pageSize: newPageSize, page: 1 }),
                resetScroll: false,
              })
            }
          />
        </TableCard.Footer>
      </TableCard>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Staff Account"
        description="Add a new administrator or employee account to access the system."
        size="sm"
      >
        <form onSubmit={handleCreateUser} className="flex flex-col flex-1 min-h-0">
          <Modal.Body className="space-y-3.5">
            {createError && <Modal.Alert>{createError}</Modal.Alert>}

            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              <span>
                Email address <span className="text-red-500">*</span>
              </span>
              <input
                name="email"
                type="email"
                required
                placeholder="employee@company.com"
                className="w-full h-10 border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none bg-white"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              <span>
                Password <span className="text-red-500">*</span>
              </span>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="Minimum 6 characters"
                className="w-full h-10 border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none bg-white"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              <span>Username</span>
              <input
                name="username"
                placeholder="e.g. john_doe"
                className="w-full h-10 border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none bg-white"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Role
              <Select
                name="role"
                defaultValue="employee"
              >
                <option value="employee">Employee</option>
                <option value="admin">Administrator</option>
              </Select>
            </label>
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createPending}
            >
              Create account
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Role Change Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(roleChangeTarget)}
        onClose={() => setRoleChangeTarget(null)}
        onConfirm={confirmRoleChange}
        title="Change User Role"
        description="Permission and access update"
        message={
          <span>
            Are you sure you want to change the role for{' '}
            <strong>"{roleChangeTarget?.user.email}"</strong> to{' '}
            <span className="font-bold uppercase text-brand-primary">
              {roleChangeTarget?.newRole}
            </span>
            ? This will immediately alter their system permissions.
          </span>
        }
        confirmText="Update Role"
        variant="warning"
        isLoading={Boolean(actionPendingId)}
      />

      {/* Deactivate User Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deactivateUserTarget)}
        onClose={() => setDeactivateUserTarget(null)}
        onConfirm={confirmDeactivateUser}
        title="Deactivate Account"
        description="User access deactivation"
        message={
          <span>
            Are you sure you want to deactivate the account for{' '}
            <strong>"{deactivateUserTarget?.email}"</strong>? They will be signed out and unable to log in until reactivated.
          </span>
        }
        confirmText="Deactivate Account"
        variant="danger"
        isLoading={Boolean(actionPendingId)}
      />
    </main>
  )
}

