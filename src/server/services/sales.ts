import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '../db/index.ts'
import {
  inventory,
  locations,
  products,
  productVariants,
  saleItems,
  sales,
  stockMovements,
  profiles,
  returns,
  returnItems,
} from '../db/schema/index.ts'
import { logActivity } from './activity-logs.ts'
import type {
  CancelSaleInput,
  CreateSaleInput,
  ListSalesInput,
} from '../../lib/schemas/sale.ts'

export function toFixed3(val: string | number): bigint {
  const [int, frac = ''] = String(val).split('.')
  const padded = (frac + '000').slice(0, 3)
  return BigInt(int) * 1000n + BigInt(padded)
}

export function fromFixed3(val: bigint): string {
  const isNeg = val < 0n
  const abs = isNeg ? -val : val
  const int = abs / 1000n
  const frac = (abs % 1000n).toString().padStart(3, '0')
  return `${isNeg ? '-' : ''}${int}.${frac}`
}

export function toCents(val: string | number): bigint {
  const [int, frac = ''] = String(val).split('.')
  const padded = (frac + '00').slice(0, 2)
  return BigInt(int) * 100n + BigInt(padded)
}

export function fromCents(val: bigint): string {
  const isNeg = val < 0n
  const abs = isNeg ? -val : val
  const int = abs / 100n
  const frac = (abs % 100n).toString().padStart(2, '0')
  return `${isNeg ? '-' : ''}${int}.${frac}`
}

export function calcSubtotal(qtyFixed3: bigint, unitPriceCents: bigint): bigint {
  return (qtyFixed3 * unitPriceCents + 500n) / 1000n
}

export async function createSale(input: CreateSaleInput, userId: string) {
  return await db.transaction(async (tx) => {
    // 1. Verify location exists, is active, and is a store
    const [location] = await tx
      .select()
      .from(locations)
      .where(eq(locations.id, input.locationId))
      .limit(1)

    if (!location) {
      throw new Error('Location not found')
    }

    if (!location.isActive) {
      throw new Error(`Location "${location.name}" is inactive`)
    }

    if (location.type !== 'store') {
      throw new Error(
        `Sales can only be recorded at store locations, but "${location.name}" is a ${location.type}`,
      )
    }

    // 2. Aggregate quantities by variantId
    const aggregatedItems = new Map<string, bigint>()
    for (const item of input.items) {
      const current = aggregatedItems.get(item.variantId) || 0n
      aggregatedItems.set(item.variantId, current + toFixed3(item.quantity))
    }

    const variantIds = Array.from(aggregatedItems.keys()).sort()
    // 3. Fetch all variants and products
    const variantRows = await tx
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        sku: productVariants.sku,
        sellingPrice: productVariants.discountedPrice,
        variantActive: productVariants.isActive,
        productName: products.name,
        productActive: products.isActive,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(inArray(productVariants.id, variantIds))

    if (variantRows.length !== variantIds.length) {
      throw new Error('One or more selected variants could not be found')
    }

    for (const variant of variantRows) {
      if (!variant.variantActive) {
        throw new Error(`Variant "${variant.sku}" is inactive`)
      }
      if (!variant.productActive) {
        throw new Error(
          `Product "${variant.productName}" is inactive/archived and cannot be sold`,
        )
      }
    }

    const variantMap = new Map(variantRows.map((v) => [v.id, v]))

    // 4. Lock existing inventory rows for this location
    const inventoryRows = await tx
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.locationId, input.locationId),
          inArray(inventory.variantId, variantIds),
        ),
      )
      .for('update')

    const inventoryMap = new Map(inventoryRows.map((r) => [r.variantId, r]))

    // 5. Verify sufficient stock and build prepared item records
    let totalCents = 0n
    const preparedItems: Array<{
      productId: string
      variantId: string
      quantity: string
      unitPrice: string
      subtotal: string
      newStockQty: string
    }> = []

    for (const variantId of variantIds) {
      const neededQtyFixed3 = aggregatedItems.get(variantId)!
      const variant = variantMap.get(variantId)!
      const invRow = inventoryMap.get(variantId)

      const availableQtyFixed3 = invRow ? toFixed3(invRow.quantity) : 0n

      if (availableQtyFixed3 < neededQtyFixed3) {
        throw new Error(
          `Insufficient stock for "${variant.productName} (${variant.sku})" at ${location.name}. Available: ${fromFixed3(availableQtyFixed3)}, Requested: ${fromFixed3(neededQtyFixed3)}`,
        )
      }

      const unitPriceCents = toCents(variant.sellingPrice)
      const subtotalCents = calcSubtotal(neededQtyFixed3, unitPriceCents)
      totalCents += subtotalCents

      const newStockQtyFixed3 = availableQtyFixed3 - neededQtyFixed3

      preparedItems.push({
        productId: variant.productId,
        variantId,
        quantity: fromFixed3(neededQtyFixed3),
        unitPrice: variant.sellingPrice,
        subtotal: fromCents(subtotalCents),
        newStockQty: fromFixed3(newStockQtyFixed3),
      })
    }

    // 6. Generate order number from sequence
    const seqResult = (await tx.execute(
      sql`SELECT nextval('order_number_seq') AS seq`,
    )) as unknown as { rows: Array<{ seq: string | number }> }
    const seq = seqResult.rows[0]?.seq
    const orderNumber = `ORD-${seq}`

    // 7. Insert sale
    const [sale] = await tx
      .insert(sales)
      .values({
        orderNumber,
        locationId: input.locationId,
        customerName: input.customerName || null,
        customerPhone: input.customerPhone || null,
        status: 'completed',
        totalAmount: fromCents(totalCents),
        notes: input.notes || null,
        userId,
      })
      .returning()

    // 8. Insert sale items
    await tx.insert(saleItems).values(
      preparedItems.map((item) => ({
        saleId: sale.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
    )

    // 9. Decrement inventory balances & create stock movement records
    for (const item of preparedItems) {
      await tx
        .update(inventory)
        .set({
          quantity: item.newStockQty,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventory.locationId, input.locationId),
            eq(inventory.variantId, item.variantId),
          ),
        )

      await tx.insert(stockMovements).values({
        productId: item.productId,
        variantId: item.variantId,
        sourceLocationId: input.locationId,
        destinationLocationId: null,
        type: 'sale',
        quantity: item.quantity,
        referenceType: 'sale',
        referenceId: sale.orderNumber,
        reason: `Sale ${sale.orderNumber}`,
        userId,
      })
    }

    // 10. Audit log
    await logActivity(
      {
        userId,
        action: 'sale.created',
        entityType: 'sale',
        entityId: sale.id,
        sourceLocationId: input.locationId,
        description: `Sale ${sale.orderNumber} created`,
        metadata: {
          orderNumber: sale.orderNumber,
          totalAmount: sale.totalAmount,
          itemCount: preparedItems.length,
          customerName: sale.customerName,
        },
      },
      tx,
    )

    return sale
  })
}

export async function cancelSale(input: CancelSaleInput, userId: string) {
  return await db.transaction(async (tx) => {
    // 1. Fetch sale
    const [sale] = await tx
      .select()
      .from(sales)
      .where(eq(sales.id, input.saleId))
      .limit(1)

    if (!sale) {
      throw new Error('Sale not found')
    }

    if (sale.status === 'cancelled') {
      throw new Error(`Sale ${sale.orderNumber} has already been cancelled`)
    }

    // 2. Fetch sale items
    const items = await tx
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, sale.id))

    if (items.length === 0) {
      throw new Error('No items found for this sale')
    }

    const variantIds = items.map((i) => i.variantId).sort()

    // 3. Lock inventory rows at sale location
    const inventoryRows = await tx
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.locationId, sale.locationId),
          inArray(inventory.variantId, variantIds),
        ),
      )
      .for('update')

    const inventoryMap = new Map(inventoryRows.map((r) => [r.variantId, r]))

    // 4. Update sale record to cancelled
    const [updatedSale] = await tx
      .update(sales)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancellationReason: input.reason,
        updatedAt: new Date(),
      })
      .where(eq(sales.id, sale.id))
      .returning()

    // 5. Restore inventory and record reversal stock movements
    for (const item of items) {
      const invRow = inventoryMap.get(item.variantId)
      const currentStockFixed3 = invRow ? toFixed3(invRow.quantity) : 0n
      const itemQtyFixed3 = toFixed3(item.quantity)
      const newStockQty = fromFixed3(currentStockFixed3 + itemQtyFixed3)

      if (invRow) {
        await tx
          .update(inventory)
          .set({
            quantity: newStockQty,
            updatedAt: new Date(),
          })
          .where(eq(inventory.id, invRow.id))
      } else {
        await tx.insert(inventory).values({
          productId: item.productId,
          variantId: item.variantId,
          locationId: sale.locationId,
          quantity: newStockQty,
        })
      }

      await tx.insert(stockMovements).values({
        productId: item.productId,
        variantId: item.variantId,
        sourceLocationId: null,
        destinationLocationId: sale.locationId,
        type: 'return',
        quantity: item.quantity,
        referenceType: 'sale_cancellation',
        referenceId: sale.orderNumber,
        reason: `Sale ${sale.orderNumber} cancelled: ${input.reason}`,
        userId,
      })
    }

    // 6. Audit log
    await logActivity(
      {
        userId,
        action: 'sale.cancelled',
        entityType: 'sale',
        entityId: sale.id,
        destinationLocationId: sale.locationId,
        description: `Sale ${sale.orderNumber} cancelled: ${input.reason}`,
        metadata: {
          orderNumber: sale.orderNumber,
          cancellationReason: input.reason,
        },
      },
      tx,
    )

    return updatedSale
  })
}

export async function listSales(input: ListSalesInput = {}) {
  const page = input.page || 1
  const pageSize = input.pageSize || 20
  const offset = (page - 1) * pageSize

  const conditions = []

  if (input.locationId) {
    conditions.push(eq(sales.locationId, input.locationId))
  }

  if (input.status) {
    conditions.push(eq(sales.status, input.status))
  }

  if (input.search) {
    const pattern = `%${input.search}%`
    conditions.push(
      or(
        ilike(sales.orderNumber, pattern),
        ilike(sales.customerName, pattern),
        ilike(sales.customerPhone, pattern),
      ),
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [totalCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sales)
    .where(whereClause)

  const rows = await db
    .select({
      id: sales.id,
      orderNumber: sales.orderNumber,
      locationId: sales.locationId,
      locationName: locations.name,
      locationType: locations.type,
      customerName: sales.customerName,
      customerPhone: sales.customerPhone,
      status: sales.status,
      totalAmount: sales.totalAmount,
      notes: sales.notes,
      cancelledAt: sales.cancelledAt,
      cancelledBy: sales.cancelledBy,
      cancelledByUsername: profiles.username,
      cancellationReason: sales.cancellationReason,
      userId: sales.userId,
      createdAt: sales.createdAt,
      updatedAt: sales.updatedAt,
    })
    .from(sales)
    .innerJoin(locations, eq(sales.locationId, locations.id))
    .leftJoin(profiles, eq(sales.cancelledBy, profiles.id))
    .where(whereClause)
    .orderBy(desc(sales.createdAt))
    .limit(pageSize)
    .offset(offset)

  return {
    sales: rows,
    total: totalCountResult?.count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((totalCountResult?.count || 0) / pageSize),
  }
}

export async function getSaleById(saleId: string) {
  const [sale] = await db
    .select({
      id: sales.id,
      orderNumber: sales.orderNumber,
      locationId: sales.locationId,
      locationName: locations.name,
      customerName: sales.customerName,
      customerPhone: sales.customerPhone,
      status: sales.status,
      totalAmount: sales.totalAmount,
      notes: sales.notes,
      cancelledAt: sales.cancelledAt,
      cancelledBy: sales.cancelledBy,
      cancellationReason: sales.cancellationReason,
      userId: sales.userId,
      createdAt: sales.createdAt,
      updatedAt: sales.updatedAt,
    })
    .from(sales)
    .innerJoin(locations, eq(sales.locationId, locations.id))
    .where(eq(sales.id, saleId))
    .limit(1)

  if (!sale) {
    return null
  }

  // Get user details
  const [seller] = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.id, sale.userId))
    .limit(1)

  let cancelledByUser = null
  if (sale.cancelledBy) {
    const [canceller] = await db
      .select({
        id: profiles.id,
        username: profiles.username,
        role: profiles.role,
      })
      .from(profiles)
      .where(eq(profiles.id, sale.cancelledBy))
      .limit(1)
    cancelledByUser = canceller || null
  }

  // Get items
  const items = await db
    .select({
      id: saleItems.id,
      saleId: saleItems.saleId,
      productId: saleItems.productId,
      productName: products.name,
      unit: products.unit,
      variantId: saleItems.variantId,
      sku: productVariants.sku,
      attributes: productVariants.attributes,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      subtotal: saleItems.subtotal,
    })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .innerJoin(productVariants, eq(saleItems.variantId, productVariants.id))
    .where(eq(saleItems.saleId, sale.id))

  // Get returns for this sale
  const saleReturns = await db
    .select({
      id: returns.id,
      returnNumber: returns.returnNumber,
      totalRefundAmount: returns.totalRefundAmount,
      reason: returns.reason,
      createdAt: returns.createdAt,
    })
    .from(returns)
    .where(eq(returns.saleId, sale.id))
    .orderBy(desc(returns.createdAt))

  const returnItemRows = await db
    .select({
      saleItemId: returnItems.saleItemId,
      quantity: returnItems.quantity,
    })
    .from(returnItems)
    .innerJoin(returns, eq(returnItems.returnId, returns.id))
    .where(eq(returns.saleId, sale.id))

  const returnedQuantityBySaleItemId: Record<string, string> = {}
  for (const row of returnItemRows) {
    const cur = toFixed3(returnedQuantityBySaleItemId[row.saleItemId] || '0')
    const added = toFixed3(row.quantity)
    returnedQuantityBySaleItemId[row.saleItemId] = fromFixed3(cur + added)
  }

  const enrichedItems = items.map((item) => ({
    ...item,
    returnedQuantity: returnedQuantityBySaleItemId[item.id] || '0.000',
  }))

  return {
    ...sale,
    seller,
    cancelledByUser,
    items: enrichedItems,
    returns: saleReturns,
  }
}
