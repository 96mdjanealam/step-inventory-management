import { and, eq, ilike, or } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { locations } from '../db/schema/index.ts'
import { logActivity } from './activity-logs.ts'
import type {
  CreateStoreInput,
  ListLocationsInput,
  ToggleLocationActiveInput,
  UpdateLocationInput,
} from '../../lib/schemas/location.ts'

function uniqueViolationConstraint(error: unknown): string | undefined {
  const candidates = [error, (error as { cause?: unknown } | undefined)?.cause]
  for (const candidate of candidates) {
    const pgError = candidate as
      { code?: string; constraint?: string } | undefined
    if (pgError?.code === '23505') return pgError.constraint
  }
  return undefined
}

export async function createStore(input: CreateStoreInput, userId: string) {
  try {
    return await db.transaction(async (tx) => {
      const [store] = await tx
        .insert(locations)
        .values({
          name: input.name,
          type: 'store',
          storeType: input.storeType,
          address: input.address || null,
          phone: input.phone || null,
          isActive: true,
        })
        .returning()

      await logActivity(
        {
          userId,
          action: 'location.create',
          entityType: 'location',
          entityId: store.id,
          description: `Created ${store.storeType === 'ownstore' ? 'own store' : 'franchise store'} "${store.name}"`,
          metadata: {
            name: store.name,
            type: store.type,
            storeType: store.storeType,
            address: store.address,
            phone: store.phone,
          },
          destinationLocationId: store.id,
        },
        tx,
      )

      return store
    })
  } catch (err) {
    const constraint = uniqueViolationConstraint(err)
    if (constraint === 'locations_name_unique') {
      throw new Error('A location with this name already exists')
    }
    throw err
  }
}

export async function updateLocation(
  input: UpdateLocationInput,
  userId: string,
) {
  const [current] = await db
    .select()
    .from(locations)
    .where(eq(locations.id, input.id))
    .limit(1)

  if (!current) {
    throw new Error('Location not found')
  }

  try {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(locations)
        .set({
          name: input.name,
          address: input.address || null,
          phone: input.phone || null,
        })
        .where(eq(locations.id, input.id))
        .returning()

      await logActivity(
        {
          userId,
          action: 'location.update',
          entityType: 'location',
          entityId: updated.id,
          description: `Updated location details for "${updated.name}"`,
          metadata: {
            previousName: current.name,
            newName: updated.name,
            previousAddress: current.address,
            newAddress: updated.address,
          },
          destinationLocationId: updated.id,
        },
        tx,
      )

      return updated
    })
  } catch (err) {
    const constraint = uniqueViolationConstraint(err)
    if (constraint === 'locations_name_unique') {
      throw new Error('A location with this name already exists')
    }
    throw err
  }
}

export async function listLocations(input: ListLocationsInput = {}) {
  const searchPattern = input.search?.replace(/[%_\\]/g, '\\$&')

  const conditions = [
    input.includeInactive ? undefined : eq(locations.isActive, true),
    input.type ? eq(locations.type, input.type) : undefined,
    input.storeType ? eq(locations.storeType, input.storeType) : undefined,
    searchPattern
      ? or(
          ilike(locations.name, `%${searchPattern}%`),
          ilike(locations.address, `%${searchPattern}%`),
        )
      : undefined,
  ]

  const where = and(...conditions.filter(Boolean))

  const items = await db
    .select()
    .from(locations)
    .where(where)
    .orderBy(locations.type, locations.name)

  return items
}

export async function toggleLocationActive(
  input: ToggleLocationActiveInput,
  userId: string,
) {
  const [current] = await db
    .select()
    .from(locations)
    .where(eq(locations.id, input.id))
    .limit(1)

  if (!current) {
    throw new Error('Location not found')
  }

  if (current.type === 'warehouse' || current.type === 'damaged') {
    throw new Error(
      'Cannot deactivate the Main Warehouse or Central Damaged location',
    )
  }

  if (current.isActive === input.isActive) {
    return current
  }

  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(locations)
      .set({ isActive: input.isActive })
      .where(eq(locations.id, input.id))
      .returning()

    await logActivity(
      {
        userId,
        action: 'location.toggle',
        entityType: 'location',
        entityId: updated.id,
        description: `${updated.isActive ? 'Activated' : 'Deactivated'} location "${updated.name}"`,
        metadata: {
          locationId: updated.id,
          name: updated.name,
          isActive: updated.isActive,
        },
        destinationLocationId: updated.id,
      },
      tx,
    )

    return updated
  })
}
