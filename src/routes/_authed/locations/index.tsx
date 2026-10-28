import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  createStoreFn,
  listLocationsFn,
  toggleLocationActiveFn,
  updateLocationFn,
} from '../../../server/functions/locations.ts'

const searchSchema = z.object({
  search: z.string().trim().min(1).optional().catch(undefined),
  storeType: z.enum(['ownstore', 'franchise']).optional().catch(undefined),
  includeInactive: z.boolean().default(true).catch(true),
})

export const Route = createFileRoute('/_authed/locations/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    search: search.search,
    storeType: search.storeType,
    includeInactive: search.includeInactive,
  }),
  loader: ({ deps }) =>
    listLocationsFn({
      data: {
        search: deps.search,
        storeType: deps.storeType,
        includeInactive: deps.includeInactive,
      },
    }),
  component: LocationsPage,
})

function LocationsPage() {
  const locations = Route.useLoaderData()
  const { search, storeType, includeInactive } = Route.useSearch()
  const { user } = Route.useRouteContext()
  const navigate = Route.useNavigate()
  const router = useRouter()

  const createStore = useServerFn(createStoreFn)
  const updateLocation = useServerFn(updateLocationFn)
  const toggleLocationActive = useServerFn(toggleLocationActiveFn)

  const isAdmin = user.role === 'admin'

  // Modals & States
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createPending, setCreatePending] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingLocation, setEditingLocation] = useState<
    (typeof locations)[number] | null
  >(null)
  const [editPending, setEditPending] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [actionPendingId, setActionPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = String(
      new FormData(event.currentTarget).get('search') ?? '',
    ).trim()
    navigate({
      search: (prev) => ({
        ...prev,
        search: value || undefined,
      }),
    })
  }

  function handleFilterStoreType(val: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        storeType: (val || undefined) as 'ownstore' | 'franchise' | undefined,
      }),
    })
  }

  function handleToggleInactive(checked: boolean) {
    navigate({
      search: (prev) => ({
        ...prev,
        includeInactive: checked,
      }),
    })
  }

  async function handleCreateStore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const selectedStoreType = String(form.get('storeType') ?? 'ownstore') as
      | 'ownstore'
      | 'franchise'
    const address = String(form.get('address') ?? '').trim() || undefined
    const phone = String(form.get('phone') ?? '').trim() || undefined

    if (!name) {
      setCreateError('Store name is required')
      return
    }

    setCreatePending(true)
    try {
      await createStore({
        data: {
          name,
          storeType: selectedStoreType,
          address,
          phone,
        },
      })
      await router.invalidate()
      setShowCreateModal(false)
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create store',
      )
    } finally {
      setCreatePending(false)
    }
  }

  async function handleUpdateLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingLocation) return
    setEditError(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const address = String(form.get('address') ?? '').trim() || undefined
    const phone = String(form.get('phone') ?? '').trim() || undefined

    if (!name) {
      setEditError('Location name is required')
      return
    }

    setEditPending(true)
    try {
      await updateLocation({
        data: {
          id: editingLocation.id,
          name,
          address,
          phone,
        },
      })
      await router.invalidate()
      setEditingLocation(null)
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Failed to update location',
      )
    } finally {
      setEditPending(false)
    }
  }

  async function handleToggleStatus(loc: (typeof locations)[number]) {
    const nextState = !loc.isActive
    if (
      !nextState &&
      !window.confirm(`Deactivate location "${loc.name}"?`)
    ) {
      return
    }

    setActionError(null)
    setActionPendingId(loc.id)
    try {
      await toggleLocationActive({
        data: {
          id: loc.id,
          isActive: nextState,
        },
      })
      await router.invalidate()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to change location status',
      )
    } finally {
      setActionPendingId(null)
    }
  }

  const facilities = locations.filter((l) => l.type !== 'store')
  const stores = locations.filter((l) => l.type === 'store')

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locations & Stores</h1>
          <p className="text-sm text-gray-500">
            Manage your central warehouse, damaged stock, and retail branches
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => {
              setCreateError(null)
              setShowCreateModal(true)
            }}
            className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            + New Store
          </button>
        ) : null}
      </div>

      {actionError ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {actionError}
        </div>
      ) : null}

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by location name or address"
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
            value={storeType ?? ''}
            onChange={(e) => handleFilterStoreType(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="">All Store Types</option>
            <option value="ownstore">Own Stores</option>
            <option value="franchise">Franchise Stores</option>
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

      {/* Core Facilities Section */}
      <div className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-gray-800 uppercase tracking-wide">
          Core Facilities
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {facilities.map((fac) => (
            <div
              key={fac.id}
              className="rounded-lg border bg-white p-5 shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{fac.name}</h3>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      fac.type === 'warehouse'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {fac.type === 'warehouse'
                      ? 'Main Warehouse'
                      : 'Central Damaged Location'}
                  </span>
                </div>
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  Protected System Location
                </span>
              </div>
              <div className="mt-4 text-xs text-gray-500">
                <p>Address: {fac.address || 'Standard facility'}</p>
                <p>Phone: {fac.phone || '—'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stores Section */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-gray-800 uppercase tracking-wide">
          Retail & Franchise Stores ({stores.length})
        </h2>
        {stores.length === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-gray-500">
            No stores found matching your criteria.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs text-gray-700 uppercase">
                <tr>
                  <th className="px-4 py-3">Store Name</th>
                  <th className="px-4 py-3">Store Type</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  {isAdmin ? (
                    <th className="px-4 py-3 text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {stores.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {s.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.storeType === 'ownstore'
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-orange-50 text-orange-700'
                        }`}
                      >
                        {s.storeType === 'ownstore'
                          ? 'Own Store'
                          : 'Franchise'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {s.address ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {s.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {s.isActive ? (
                        <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditError(null)
                              setEditingLocation(s)
                            }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={actionPendingId === s.id}
                            onClick={() => handleToggleStatus(s)}
                            className={`text-xs hover:underline disabled:opacity-50 ${
                              s.isActive ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {actionPendingId === s.id
                              ? 'Processing...'
                              : s.isActive
                                ? 'Deactivate'
                                : 'Activate'}
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Store Modal */}
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Add New Store</h3>

            {createError ? (
              <p className="mb-3 rounded bg-red-50 p-2 text-xs text-red-600">
                {createError}
              </p>
            ) : null}

            <form onSubmit={handleCreateStore} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Store Name *
                <input
                  name="name"
                  required
                  placeholder="e.g. Westside Mall Branch"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Store Type *
                <select
                  name="storeType"
                  defaultValue="ownstore"
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="ownstore">Own Store</option>
                  <option value="franchise">Franchise Store</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Address
                <input
                  name="address"
                  placeholder="e.g. 789 West Blvd, Suite 2"
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Phone Number
                <input
                  name="phone"
                  placeholder="e.g. +1-555-0199"
                  className="rounded border px-3 py-2 text-sm"
                />
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
                  {createPending ? 'Creating...' : 'Create store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit Location Modal */}
      {editingLocation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">
              Edit Location Details
            </h3>

            {editError ? (
              <p className="mb-3 rounded bg-red-50 p-2 text-xs text-red-600">
                {editError}
              </p>
            ) : null}

            <form
              onSubmit={handleUpdateLocation}
              className="flex flex-col gap-3"
            >
              <label className="flex flex-col gap-1 text-sm font-medium">
                Location Name *
                <input
                  name="name"
                  required
                  defaultValue={editingLocation.name}
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Address
                <input
                  name="address"
                  defaultValue={editingLocation.address ?? ''}
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Phone Number
                <input
                  name="phone"
                  defaultValue={editingLocation.phone ?? ''}
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLocation(null)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editPending}
                  className="rounded bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {editPending ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}

