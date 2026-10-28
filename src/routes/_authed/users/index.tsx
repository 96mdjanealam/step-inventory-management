import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  createUserFn,
  listUsersFn,
  toggleUserActiveFn,
  updateUserRoleFn,
} from '../../../server/functions/users.ts'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  search: z.string().trim().min(1).optional().catch(undefined),
  role: z.enum(['admin', 'employee']).optional().catch(undefined),
  includeInactive: z.boolean().default(false).catch(false),
})

export const Route = createFileRoute('/_authed/users/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    search: search.search,
    role: search.role,
    includeInactive: search.includeInactive,
  }),
  loader: ({ deps }) =>
    listUsersFn({
      data: {
        page: deps.page,
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

  const isAdmin = user.role === 'admin'
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-700">Access Restricted</h1>
          <p className="mt-2 text-sm text-red-600">
            Only administrators are authorized to manage team member accounts.
          </p>
          <Link
            to="/products"
            className="mt-4 inline-block rounded bg-black px-4 py-2 text-sm text-white"
          >
            Go to Products
          </Link>
        </div>
      </main>
    )
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = String(
      new FormData(event.currentTarget).get('search') ?? '',
    ).trim()
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        search: value || undefined,
      }),
    })
  }

  function handleRoleFilter(selectedRole: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        role: (selectedRole || undefined) as 'admin' | 'employee' | undefined,
      }),
    })
  }

  function handleToggleInactive(checked: boolean) {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        includeInactive: checked || undefined,
      }),
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

  async function handleRoleChange(
    targetUser: (typeof items)[number],
    newRole: 'admin' | 'employee',
  ) {
    if (targetUser.role === newRole) return
    if (
      !window.confirm(
        `Change role for ${targetUser.email} to ${newRole.toUpperCase()}?`,
      )
    ) {
      return
    }

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
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update user role',
      )
    } finally {
      setActionPendingId(null)
    }
  }

  async function handleToggleStatus(targetUser: (typeof items)[number]) {
    const nextState = !targetUser.isActive
    if (
      !nextState &&
      !window.confirm(`Deactivate account for "${targetUser.email}"?`)
    ) {
      return
    }

    setActionError(null)
    setActionPendingId(targetUser.id)
    try {
      await toggleUserActive({
        data: {
          id: targetUser.id,
          isActive: nextState,
        },
      })
      await router.invalidate()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to change account status',
      )
    } finally {
      setActionPendingId(null)
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-gray-500">
            Create and manage staff accounts and role permissions
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateError(null)
            setShowCreateModal(true)
          }}
          className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          + New User
        </button>
      </div>

      {actionError ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {actionError}
        </div>
      ) : null}

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by email or username"
            className="flex-1 rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-sm text-white hover:bg-gray-800"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-4">
          <select
            value={role ?? ''}
            onChange={(e) => handleRoleFilter(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="">All Roles</option>
            <option value="admin">Admins only</option>
            <option value="employee">Employees only</option>
          </select>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(includeInactive)}
              onChange={(e) => handleToggleInactive(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show inactive
          </label>
        </div>
      </div>

      {/* Users Table */}
      {items.length === 0 ? (
        <p className="py-8 text-center text-gray-500">No users found.</p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-4 py-3">User / Email</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((u) => {
                const isSelf = u.id === user.id
                return (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium">
                      {u.email ?? 'No email'}
                      {isSelf ? (
                        <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700">
                          You
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {u.username ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={actionPendingId === u.id || isSelf}
                        onChange={(e) =>
                          handleRoleChange(
                            u,
                            e.target.value as 'admin' | 'employee',
                          )
                        }
                        className="rounded border bg-transparent px-2 py-1 text-xs font-medium disabled:opacity-50"
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf ? (
                        <button
                          type="button"
                          disabled={actionPendingId === u.id}
                          onClick={() => handleToggleStatus(u)}
                          className={`text-xs hover:underline disabled:opacity-50 ${
                            u.isActive ? 'text-red-600' : 'text-blue-600'
                          }`}
                        >
                          {actionPendingId === u.id
                            ? 'Processing...'
                            : u.isActive
                              ? 'Deactivate'
                              : 'Activate'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {total} users · page {page} of {totalPages}
        </span>
        <div className="flex gap-3">
          {page > 1 ? (
            <Link
              to="/users"
              search={(prev) => ({ ...prev, page: page - 1 })}
              className="text-black underline"
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              to="/users"
              search={(prev) => ({ ...prev, page: page + 1 })}
              className="text-black underline"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Create Staff Account</h3>

            {createError ? (
              <p className="mb-3 rounded bg-red-50 p-2 text-xs text-red-600">
                {createError}
              </p>
            ) : null}

            <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Email address *
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="employee@company.com"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Password *
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Username (optional)
                <input
                  name="username"
                  placeholder="e.g. john_doe"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Role
                <select
                  name="role"
                  defaultValue="employee"
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPending}
                  className="rounded bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {createPending ? 'Creating...' : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}

