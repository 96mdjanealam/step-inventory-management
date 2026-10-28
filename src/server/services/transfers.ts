import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
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
  CreateTransferInput,
  ListTransfersInput,
} from '../../lib/schemas/transfer.ts'

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

export async function createTransfer(input: CreateTransferInput, userId: string) {
  if (input.sourceLocationId === input.destinationLocationId) {
    throw new Error('Source and destination locations must be different')
  }

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

    // 2. Verify source & destination locations exist, are active, and not damaged
    const [sourceLocation] = await tx
      .select()
      .from(locations)
      .where(eq(locations.id, input.sourceLocationId))
      .limit(1)

    if (!sourceLocation || !sourceLocation.isActive) {
      throw new Error('Active source location not found')
    }
    if (sourceLocation.type === 'damaged') {
      throw new Error('Cannot transfer stock out of Central Damaged location via standard transfer')
    }

    const [destinationLocation] = await tx
      .select()
      .from(locations)
      .where(eq(locations.id, input.destinationLocationId))
      .limit(1)

    if (!destinationLocation || !destinationLocation.isActive) {
      throw new Error('Active destination location not found')
    }
    if (destinationLocation.type === 'damaged') {
      throw new Error('Cannot transfer stock into Central Damaged location via standard transfer (use damage report workflow)')
    }

    // 3. Deadlock-free row-locking: query both source & destination rows in a single statement
    const lockedRows = await tx
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.variantId, input.variantId),
          inArray(inventory.locationId, [
            input.sourceLocationId,
            input.destinationLocationId,
          ]),
        ),
      )
      .for('update')

    const sourceRow = lockedRows.find(
      (r) => r.locationId === input.sourceLocationId,
    )
    const destRow = lockedRows.find(
      (r) => r.locationId === input.destinationLocationId,
    )

    const transferBig = toFixed3(input.quantity)
    const sourceBig = sourceRow ? toFixed3(sourceRow.quantity) : 0n

    if (!sourceRow || sourceBig < transferBig) {
      throw new Error(
        `Insufficient stock at ${sourceLocation.name}: current balance is ${fromFixed3(sourceBig)} ${variant.unit}, cannot transfer ${input.quantity}`,
      )
    }

    const destBig = destRow ? toFixed3(destRow.quantity) : 0n

    const newSourceBig = sourceBig - transferBig
    const newDestBig = destBig + transferBig

    const newSourceStr = fromFixed3(newSourceBig)
    const newDestStr = fromFixed3(newDestBig)

    // 4. Update source inventory
    const [updatedSource] = await tx
      .update(inventory)
      .set({ quantity: newSourceStr })
      .where(eq(inventory.id, sourceRow.id))
      .returning()

    // 5. Update or Insert destination inventory
    let updatedDest
    if (destRow) {
      const [row] = await tx
        .update(inventory)
        .set({ quantity: newDestStr })
        .where(eq(inventory.id, destRow.id))
        .returning()
      updatedDest = row
    } else {
      const [row] = await tx
        .insert(inventory)
        .values({
          productId: variant.productId,
          variantId: input.variantId,
          locationId: input.destinationLocationId,
          quantity: newDestStr,
        })
        .returning()
      updatedDest = row
    }

    // 6. Record stock movement ledger entry
    const [movement] = await tx
      .insert(stockMovements)
      .values({
        productId: variant.productId,
        variantId: input.variantId,
        sourceLocationId: input.sourceLocationId,
        destinationLocationId: input.destinationLocationId,
        type: 'transfer',
        quantity: input.quantity,
        referenceType: 'transfer',
        reason: input.notes || 'Inter-location transfer',
        userId,
      })
      .returning()

    // 7. Append activity log referencing both locations
    await logActivity(
      {
        userId,
        action: 'stock.transfer',
        entityType: 'stock_movement',
        entityId: movement.id,
        description: `Transferred ${input.quantity} ${variant.unit} of "${variant.productName}" from ${sourceLocation.name} to ${destinationLocation.name}`,
        metadata: {
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.productName,
          quantity: input.quantity,
          previousSourceBalance: fromFixed3(sourceBig),
          newSourceBalance: newSourceStr,
          previousDestBalance: fromFixed3(destBig),
          newDestBalance: newDestStr,
          movementId: movement.id,
          notes: input.notes,
        },
        sourceLocationId: sourceLocation.id,
        destinationLocationId: destinationLocation.id,
      },
      tx,
    )

    return {
      movement,
      sourceInventory: updatedSource,
      destinationInventory: updatedDest,
    }
  })
}

export async function listTransfers(input: ListTransfersInput = {}) {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 20
  const searchPattern = input.search?.replace(/[%_\\]/g, '\\$&')

  const sourceLoc = alias(locations, 'source_loc')
  const destLoc = alias(locations, 'dest_loc')

  const conditions = [
    eq(stockMovements.type, 'transfer'),
    input.variantId ? eq(stockMovements.variantId, input.variantId) : undefined,
    input.locationId
      ? or(
          eq(stockMovements.sourceLocationId, input.locationId),
          eq(stockMovements.destinationLocationId, input.locationId),
        )
      : undefined,
    searchPattern
      ? or(
          ilike(products.name, `%${searchPattern}%`),
          ilike(productVariants.sku, `%${searchPattern}%`),
          ilike(sourceLoc.name, `%${searchPattern}%`),
          ilike(destLoc.name, `%${searchPattern}%`),
        )
      : undefined,
  ]

  const where = and(...conditions.filter(Boolean))

  const [items, total] = await Promise.all([
    db
      .select({
        id: stockMovements.id,
        quantity: stockMovements.quantity,
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
          discountedPrice: productVariants.discountedPrice,
        },
        sourceLocation: {
          id: sourceLoc.id,
          name: sourceLoc.name,
          type: sourceLoc.type,
          storeType: sourceLoc.storeType,
        },
        destinationLocation: {
          id: destLoc.id,
          name: destLoc.name,
          type: destLoc.type,
          storeType: destLoc.storeType,
        },
        user: {
          id: profiles.id,
          username: profiles.username,
          role: profiles.role,
        },
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(productVariants, eq(stockMovements.variantId, productVariants.id))
      .leftJoin(sourceLoc, eq(stockMovements.sourceLocationId, sourceLoc.id))
      .leftJoin(destLoc, eq(stockMovements.destinationLocationId, destLoc.id))
      .leftJoin(profiles, eq(stockMovements.userId, profiles.id))
      .where(where)
      .orderBy(desc(stockMovements.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(productVariants, eq(stockMovements.variantId, productVariants.id))
      .leftJoin(sourceLoc, eq(stockMovements.sourceLocationId, sourceLoc.id))
      .leftJoin(destLoc, eq(stockMovements.destinationLocationId, destLoc.id))
      .where(where)
      .then((rows) => rows[0]?.count ?? 0),
  ])

  return { items, total, page, pageSize }
}

