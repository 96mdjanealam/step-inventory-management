import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../db/index.ts'
import {
  inventory,
  locations,
  products,
  productVariants,
  profiles,
  stockMovements,
} from '../db/schema/index.ts'
import { logActivity } from './activity-logs.ts'
import type {
  AddStockInput,
  AdjustStockInput,
  ListInventoryInput,
  ListStockMovementsInput,
} from '../../lib/schemas/inventory.ts'

function toFixed3(val: string | number): bigint {
  const [int, frac = ''] = String(val).split('.')
  const padded = (frac + '000').slice(0, 3)
  return BigInt(int) * 1000n + BigInt(padded)
}

function fromFixed3(val: bigint): string {
  const isNeg = val < 0n
  const abs = isNeg ? -val : val
  const int = abs / 1000n
  const frac = (abs % 1000n).toString().padStart(3, '0')
  return `${isNeg ? '-' : ''}${int}.${frac}`
}

export async function addStock(input: AddStockInput, userId: string) {
  return await db.transaction(async (tx) => {
    // 1. Verify variant exists and is active
    const [variant] = await tx
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        sku: productVariants.sku,
        productName: products.name,
        unit: products.unit,
        isActive: productVariants.isActive,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(productVariants.id, input.variantId))
      .limit(1)

    if (!variant || !variant.isActive) {
      throw new Error('Active product variant not found')
    }

    // 2. Verify destination location exists and is active
    const [location] = await tx
      .select({
        id: locations.id,
        name: locations.name,
        type: locations.type,
        isActive: locations.isActive,
      })
      .from(locations)
      .where(eq(locations.id, input.locationId))
      .limit(1)

    if (!location || !location.isActive) {
      throw new Error('Active location not found')
    }

    if (location.type === 'damaged') {
      throw new Error('Cannot receive standard stock directly into Damaged Stock')
    }

    // 3. Query existing inventory with row-lock (FOR UPDATE)
    const [existing] = await tx
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.variantId, input.variantId),
          eq(inventory.locationId, input.locationId),
        ),
      )
      .for('update')

    const addBig = toFixed3(input.quantity)
    const currentBig = existing ? toFixed3(existing.quantity) : 0n
    const newBig = currentBig + addBig
    const newQuantityStr = fromFixed3(newBig)

    let updatedInventoryRow
    if (existing) {
      const [row] = await tx
        .update(inventory)
        .set({ quantity: newQuantityStr })
        .where(eq(inventory.id, existing.id))
        .returning()
      updatedInventoryRow = row
    } else {
      const [row] = await tx
        .insert(inventory)
        .values({
          productId: variant.productId,
          variantId: input.variantId,
          locationId: input.locationId,
          quantity: newQuantityStr,
        })
        .returning()
      updatedInventoryRow = row
    }

    // 4. Append stock movement ledger entry
    const [movement] = await tx
      .insert(stockMovements)
      .values({
        productId: variant.productId,
        variantId: input.variantId,
        destinationLocationId: input.locationId,
        type: 'inflow',
        quantity: input.quantity,
        reason: input.reason || 'Standard stock intake',
        userId,
      })
      .returning()

    // 5. Append activity log
    await logActivity(
      {
        userId,
        action: 'stock.inflow',
        entityType: 'inventory',
        entityId: updatedInventoryRow.id,
        description: `Received ${input.quantity} ${variant.unit} of "${variant.productName}" (SKU: ${variant.sku ?? 'None'}) at ${location.name}`,
        metadata: {
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.productName,
          quantityAdded: input.quantity,
          previousQuantity: fromFixed3(currentBig),
          newQuantity: newQuantityStr,
          movementId: movement.id,
          reason: input.reason,
        },
        destinationLocationId: location.id,
      },
      tx,
    )

    return {
      inventory: updatedInventoryRow,
      movement,
    }
  })
}

export async function adjustStock(input: AdjustStockInput, userId: string) {
  return await db.transaction(async (tx) => {
    // 1. Verify variant exists
    const [variant] = await tx
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        sku: productVariants.sku,
        productName: products.name,
        unit: products.unit,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(productVariants.id, input.variantId))
      .limit(1)

    if (!variant) {
      throw new Error('Product variant not found')
    }

    // 2. Verify location exists
    const [location] = await tx
      .select({
        id: locations.id,
        name: locations.name,
        type: locations.type,
        isActive: locations.isActive,
      })
      .from(locations)
      .where(eq(locations.id, input.locationId))
      .limit(1)

    if (!location || !location.isActive) {
      throw new Error('Active location not found')
    }

    if (location.type === 'damaged') {
      throw new Error('Use the damage resolution workflow for damaged stock adjustments')
    }

    // 3. Query existing inventory with row-lock (FOR UPDATE)
    const [existing] = await tx
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.variantId, input.variantId),
          eq(inventory.locationId, input.locationId),
        ),
      )
      .for('update')

    const adjustBig = toFixed3(input.quantity)
    const currentBig = existing ? toFixed3(existing.quantity) : 0n

    let newBig: bigint
    if (input.adjustmentType === 'increase') {
      newBig = currentBig + adjustBig
    } else {
      if (currentBig < adjustBig) {
        throw new Error(
          `Insufficient stock at ${location.name}: current balance is ${fromFixed3(currentBig)} ${variant.unit}, cannot decrease by ${input.quantity}`,
        )
      }
      newBig = currentBig - adjustBig
    }

    const newQuantityStr = fromFixed3(newBig)

    let updatedInventoryRow
    if (existing) {
      const [row] = await tx
        .update(inventory)
        .set({ quantity: newQuantityStr })
        .where(eq(inventory.id, existing.id))
        .returning()
      updatedInventoryRow = row
    } else {
      const [row] = await tx
        .insert(inventory)
        .values({
          productId: variant.productId,
          variantId: input.variantId,
          locationId: input.locationId,
          quantity: newQuantityStr,
        })
        .returning()
      updatedInventoryRow = row
    }

    // 4. Record stock movement
    const [movement] = await tx
      .insert(stockMovements)
      .values({
        productId: variant.productId,
        variantId: input.variantId,
        sourceLocationId:
          input.adjustmentType === 'decrease' ? input.locationId : null,
        destinationLocationId:
          input.adjustmentType === 'increase' ? input.locationId : null,
        type: 'adjustment',
        quantity: input.quantity,
        reason: input.reason,
        userId,
      })
      .returning()

    // 5. Append activity log
    await logActivity(
      {
        userId,
        action: 'stock.adjustment',
        entityType: 'inventory',
        entityId: updatedInventoryRow.id,
        description: `Manual adjustment at ${location.name}: ${input.adjustmentType} by ${input.quantity} ${variant.unit} for "${variant.productName}" (Reason: ${input.reason})`,
        metadata: {
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.productName,
          adjustmentType: input.adjustmentType,
          quantityAdjusted: input.quantity,
          previousQuantity: fromFixed3(currentBig),
          newQuantity: newQuantityStr,
          movementId: movement.id,
          reason: input.reason,
        },
        sourceLocationId:
          input.adjustmentType === 'decrease' ? location.id : undefined,
        destinationLocationId:
          input.adjustmentType === 'increase' ? location.id : undefined,
      },
      tx,
    )

    return {
      inventory: updatedInventoryRow,
      movement,
    }
  })
}

export async function listInventory(input: ListInventoryInput = {}) {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 20
  const searchPattern = input.search?.replace(/[%_\\]/g, '\\$&')

  const conditions = [
    input.locationId ? eq(inventory.locationId, input.locationId) : undefined,
    input.productId ? eq(inventory.productId, input.productId) : undefined,
    searchPattern
      ? or(
          ilike(products.name, `%${searchPattern}%`),
          ilike(productVariants.sku, `%${searchPattern}%`),
        )
      : undefined,
  ]

  const where = and(...conditions.filter(Boolean))

  const [items, total] = await Promise.all([
    db
      .select({
        id: inventory.id,
        productId: inventory.productId,
        variantId: inventory.variantId,
        locationId: inventory.locationId,
        quantity: inventory.quantity,
        updatedAt: inventory.updatedAt,
        product: {
          id: products.id,
          name: products.name,
          category: products.category,
          measurementType: products.measurementType,
          unit: products.unit,
        },
        variant: {
          id: productVariants.id,
          sku: productVariants.sku,
          attributes: productVariants.attributes,
          discountedPrice: productVariants.discountedPrice,
          regularPrice: productVariants.regularPrice,
          isDefault: productVariants.isDefault,
        },
        location: {
          id: locations.id,
          name: locations.name,
          type: locations.type,
          storeType: locations.storeType,
        },
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(productVariants, eq(inventory.variantId, productVariants.id))
      .innerJoin(locations, eq(inventory.locationId, locations.id))
      .where(where)
      .orderBy(products.name, productVariants.sku, locations.name)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(productVariants, eq(inventory.variantId, productVariants.id))
      .where(where)
      .then((rows) => rows[0]?.count ?? 0),
  ])

  return { items, total, page, pageSize }
}

export async function listStockMovements(input: ListStockMovementsInput = {}) {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 20
  const searchPattern = input.search?.replace(/[%_\\]/g, '\\$&')

  const sourceLocation = alias(locations, 'source_location')
  const destLocation = alias(locations, 'dest_location')

  const conditions = [
    input.type ? eq(stockMovements.type, input.type) : undefined,
    input.locationId
      ? or(
          eq(stockMovements.sourceLocationId, input.locationId),
          eq(stockMovements.destinationLocationId, input.locationId),
        )
      : undefined,
    input.productId ? eq(stockMovements.productId, input.productId) : undefined,
    input.variantId ? eq(stockMovements.variantId, input.variantId) : undefined,
    searchPattern
      ? or(
          ilike(products.name, `%${searchPattern}%`),
          ilike(productVariants.sku, `%${searchPattern}%`),
          ilike(stockMovements.reason, `%${searchPattern}%`),
          ilike(stockMovements.referenceId, `%${searchPattern}%`),
        )
      : undefined,
  ]

  const where = and(...conditions.filter(Boolean))

  const [items, total] = await Promise.all([
    db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        referenceType: stockMovements.referenceType,
        referenceId: stockMovements.referenceId,
        reason: stockMovements.reason,
        createdAt: stockMovements.createdAt,
        product: {
          id: products.id,
          name: products.name,
          unit: products.unit,
        },
        variant: {
          id: productVariants.id,
          sku: productVariants.sku,
          attributes: productVariants.attributes,
        },
        sourceLocation: {
          id: sourceLocation.id,
          name: sourceLocation.name,
          type: sourceLocation.type,
        },
        destinationLocation: {
          id: destLocation.id,
          name: destLocation.name,
          type: destLocation.type,
        },
        user: {
          id: profiles.id,
          username: profiles.username,
          role: profiles.role,
        },
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(
        productVariants,
        eq(stockMovements.variantId, productVariants.id),
      )
      .leftJoin(
        sourceLocation,
        eq(stockMovements.sourceLocationId, sourceLocation.id),
      )
      .leftJoin(
        destLocation,
        eq(stockMovements.destinationLocationId, destLocation.id),
      )
      .leftJoin(profiles, eq(stockMovements.userId, profiles.id))
      .where(where)
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(
        productVariants,
        eq(stockMovements.variantId, productVariants.id),
      )
      .where(where)
      .then((rows) => rows[0]?.count ?? 0),
  ])

  return { items, total, page, pageSize }
}
