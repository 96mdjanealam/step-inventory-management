import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { inventory, locations, products } from '../db/schema/index.ts'
import { logActivity } from './activity-logs.ts'
import type {
  CreateStoreInput,
  ListLocationsInput,
  ListLocationsPaginatedInput,
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

export async function listLocationsPaginated(input: ListLocationsPaginatedInput) {
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

  const [items, total] = await Promise.all([
    db
      .select()
      .from(locations)
      .where(where)
      .orderBy(locations.type, locations.name)
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db.$count(locations, where),
  ])

  return { items, total, page: input.page, pageSize: input.pageSize }
}

export interface UnitQuantity {
  unit: string
  quantity: string
}

export async function listLocationsWithStock(input: ListLocationsInput = {}) {
  const items = await listLocations(input)
  if (items.length === 0) return []

  const locationIds = items.map((l) => l.id)

  const [stockSummary, stockByUnit] = await Promise.all([
    db
      .select({
        locationId: inventory.locationId,
        totalQuantity: sql<string>`coalesce(sum(${inventory.quantity}), 0)::text`,
        itemCount: sql<number>`count(case when ${inventory.quantity} > 0 then 1 else null end)::int`,
      })
      .from(inventory)
      .where(inArray(inventory.locationId, locationIds))
      .groupBy(inventory.locationId),
    db
      .select({
        locationId: inventory.locationId,
        unit: products.unit,
        totalQuantity: sql<string>`coalesce(sum(${inventory.quantity}), 0)::text`,
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(
        and(
          inArray(inventory.locationId, locationIds),
          sql`${inventory.quantity} > 0`,
        ),
      )
      .groupBy(inventory.locationId, products.unit)
      .orderBy(products.unit),
  ])

  const summaryMap = new Map<
    string,
    { totalQuantity: string; itemCount: number }
  >()
  for (const s of stockSummary) {
    const num = Number(s.totalQuantity)
    summaryMap.set(s.locationId, {
      totalQuantity: num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }),
      itemCount: s.itemCount,
    })
  }

  const unitsMap = new Map<string, UnitQuantity[]>()
  for (const u of stockByUnit) {
    const list = unitsMap.get(u.locationId) || []
    const num = Number(u.totalQuantity)
    list.push({
      unit: u.unit,
      quantity: num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }),
    })
    unitsMap.set(u.locationId, list)
  }

  return items.map((loc) => {
    const summary = summaryMap.get(loc.id) ?? {
      totalQuantity: '0',
      itemCount: 0,
    }
    const units = unitsMap.get(loc.id) ?? []
    return {
      ...loc,
      totalQuantity: summary.totalQuantity,
      itemCount: summary.itemCount,
      units,
    }
  })
}

export async function listLocationsWithStockPaginated(
  input: ListLocationsPaginatedInput,
) {
  const { items, total, page, pageSize } = await listLocationsPaginated(input)
  if (items.length === 0) {
    return { items: [], total: 0, page, pageSize }
  }

  const locationIds = items.map((l) => l.id)

  const [stockSummary, stockByUnit] = await Promise.all([
    db
      .select({
        locationId: inventory.locationId,
        totalQuantity: sql<string>`coalesce(sum(${inventory.quantity}), 0)::text`,
        itemCount: sql<number>`count(case when ${inventory.quantity} > 0 then 1 else null end)::int`,
      })
      .from(inventory)
      .where(inArray(inventory.locationId, locationIds))
      .groupBy(inventory.locationId),
    db
      .select({
        locationId: inventory.locationId,
        unit: products.unit,
        totalQuantity: sql<string>`coalesce(sum(${inventory.quantity}), 0)::text`,
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(
        and(
          inArray(inventory.locationId, locationIds),
          sql`${inventory.quantity} > 0`,
        ),
      )
      .groupBy(inventory.locationId, products.unit)
      .orderBy(products.unit),
  ])

  const summaryMap = new Map<
    string,
    { totalQuantity: string; itemCount: number }
  >()
  for (const s of stockSummary) {
    const num = Number(s.totalQuantity)
    summaryMap.set(s.locationId, {
      totalQuantity: num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }),
      itemCount: s.itemCount,
    })
  }

  const unitsMap = new Map<string, UnitQuantity[]>()
  for (const u of stockByUnit) {
    const list = unitsMap.get(u.locationId) || []
    const num = Number(u.totalQuantity)
    list.push({
      unit: u.unit,
      quantity: num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }),
    })
    unitsMap.set(u.locationId, list)
  }

  const enrichedItems = items.map((loc) => {
    const summary = summaryMap.get(loc.id) ?? {
      totalQuantity: '0',
      itemCount: 0,
    }
    const units = unitsMap.get(loc.id) ?? []
    return {
      ...loc,
      totalQuantity: summary.totalQuantity,
      itemCount: summary.itemCount,
      units,
    }
  })

  return { items: enrichedItems, total, page, pageSize }
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
