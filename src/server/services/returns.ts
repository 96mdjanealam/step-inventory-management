import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '../db/index.ts'
import {
  inventory,
  locations,
  products,
  productVariants,
  profiles,
  returnItems,
  returns,
  saleItems,
  sales,
  stockMovements,
} from '../db/schema/index.ts'
import { logActivity } from './activity-logs.ts'
import {
  calcSubtotal,
  fromCents,
  fromFixed3,
  toCents,
  toFixed3,
} from './sales.ts'
import type {
  CreateReturnInput,
  ListReturnsInput,
} from '../../lib/schemas/return.ts'

export async function createReturn(input: CreateReturnInput, userId: string) {
  return await db.transaction(async (tx) => {
    // 1. Fetch sale
    const [sale] = await tx
      .select({
        id: sales.id,
        orderNumber: sales.orderNumber,
        locationId: sales.locationId,
        status: sales.status,
      })
      .from(sales)
      .where(eq(sales.id, input.saleId))
      .limit(1)

    if (!sale) {
      throw new Error('Sale not found')
    }

    if (sale.status === 'cancelled') {
      throw new Error(
        `Cannot process returns for cancelled sale "${sale.orderNumber}"`,
      )
    }

    // 2. Fetch sale items
    const saleItemRows = await tx
      .select({
        id: saleItems.id,
        saleId: saleItems.saleId,
        productId: saleItems.productId,
        variantId: saleItems.variantId,
        quantity: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        productName: products.name,
        measurementType: products.measurementType,
        sku: productVariants.sku,
        unit: products.unit,
      })
      .from(saleItems)
      .innerJoin(products, eq(saleItems.productId, products.id))
      .innerJoin(productVariants, eq(saleItems.variantId, productVariants.id))
      .where(eq(saleItems.saleId, sale.id))

    const saleItemMap = new Map(saleItemRows.map((si) => [si.id, si]))

    // 3. Fetch all previously returned quantities for this sale
    const existingReturnRows = await tx
      .select({
        saleItemId: returnItems.saleItemId,
        quantity: returnItems.quantity,
      })
      .from(returnItems)
      .innerJoin(returns, eq(returnItems.returnId, returns.id))
      .where(eq(returns.saleId, sale.id))

    const previouslyReturnedMap = new Map<string, bigint>()
    for (const retItem of existingReturnRows) {
      const prev = previouslyReturnedMap.get(retItem.saleItemId) || 0n
      previouslyReturnedMap.set(
        retItem.saleItemId,
        prev + toFixed3(retItem.quantity),
      )
    }

    // 4. Validate quantities and calculate refund subtotals
    let totalRefundCents = 0n
    const preparedReturnItems: Array<{
      saleItemId: string
      productId: string
      variantId: string
      quantity: string
      unitRefundPrice: string
      subtotal: string
      productName: string
      sku: string
      unit: string
    }> = []

    for (const item of input.items) {
      const saleItem = saleItemMap.get(item.saleItemId)
      if (!saleItem) {
        throw new Error(
          `Sale item with ID "${item.saleItemId}" does not belong to sale "${sale.orderNumber}"`,
        )
      }

      if (saleItem.measurementType === 'count' || saleItem.unit === 'piece') {
        if (!Number.isInteger(Number(item.quantity))) {
          throw new Error(`Quantity for ${saleItem.unit} items must be a whole number`)
        }
      }

      const returnQtyFixed3 = toFixed3(item.quantity)
      const soldQtyFixed3 = toFixed3(saleItem.quantity)
      const alreadyReturnedFixed3 =
        previouslyReturnedMap.get(item.saleItemId) || 0n
      const maxReturnableFixed3 = soldQtyFixed3 - alreadyReturnedFixed3

      if (returnQtyFixed3 > maxReturnableFixed3) {
        throw new Error(
          `Cannot return ${fromFixed3(returnQtyFixed3)} ${saleItem.unit} of "${saleItem.productName}". Maximum returnable quantity is ${fromFixed3(maxReturnableFixed3)} ${saleItem.unit}`,
        )
      }

      // Update map in case user passed same saleItemId multiple times
      previouslyReturnedMap.set(
        item.saleItemId,
        alreadyReturnedFixed3 + returnQtyFixed3,
      )

      const unitPriceCents = toCents(saleItem.unitPrice)
      const subtotalCents = calcSubtotal(returnQtyFixed3, unitPriceCents)
      totalRefundCents += subtotalCents

      preparedReturnItems.push({
        saleItemId: saleItem.id,
        productId: saleItem.productId,
        variantId: saleItem.variantId,
        quantity: fromFixed3(returnQtyFixed3),
        unitRefundPrice: saleItem.unitPrice,
        subtotal: fromCents(subtotalCents),
        productName: saleItem.productName,
        sku: saleItem.sku || '',
        unit: saleItem.unit,
      })
    }

    // 5. Generate return number from sequence
    const seqResult = (await tx.execute(
      sql`SELECT nextval('return_number_seq') AS seq`,
    )) as unknown as { rows: Array<{ seq: string | number }> }
    const seq = seqResult.rows[0]?.seq
    const returnNumber = `RET-${seq}`

    // 6. Insert return record
    const [returnRecord] = await tx
      .insert(returns)
      .values({
        returnNumber,
        saleId: sale.id,
        locationId: sale.locationId,
        reason: input.reason,
        totalRefundAmount: fromCents(totalRefundCents),
        status: 'completed',
        userId,
      })
      .returning()

    // 7. Insert return items
    await tx.insert(returnItems).values(
      preparedReturnItems.map((item) => ({
        returnId: returnRecord.id,
        saleItemId: item.saleItemId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitRefundPrice: item.unitRefundPrice,
        subtotal: item.subtotal,
      })),
    )

    // 8. Lock inventory rows at sale location and restore quantities
    const variantIds = Array.from(
      new Set(preparedReturnItems.map((i) => i.variantId)),
    ).sort()

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

    for (const item of preparedReturnItems) {
      const invRow = inventoryMap.get(item.variantId)
      const currentQtyFixed3 = invRow ? toFixed3(invRow.quantity) : 0n
      const addedQtyFixed3 = toFixed3(item.quantity)
      const newQtyStr = fromFixed3(currentQtyFixed3 + addedQtyFixed3)

      if (invRow) {
        await tx
          .update(inventory)
          .set({
            quantity: newQtyStr,
            updatedAt: new Date(),
          })
          .where(eq(inventory.id, invRow.id))
      } else {
        await tx.insert(inventory).values({
          productId: item.productId,
          variantId: item.variantId,
          locationId: sale.locationId,
          quantity: newQtyStr,
        })
      }

      // 9. Append stock movement
      await tx.insert(stockMovements).values({
        productId: item.productId,
        variantId: item.variantId,
        sourceLocationId: null,
        destinationLocationId: sale.locationId,
        type: 'return',
        quantity: item.quantity,
        referenceType: 'return',
        referenceId: returnRecord.returnNumber,
        reason: `Customer return ${returnRecord.returnNumber}: ${input.reason}`,
        userId,
      })
    }

    // 10. Audit log
    await logActivity(
      {
        userId,
        action: 'return.created',
        entityType: 'return',
        entityId: returnRecord.id,
        destinationLocationId: sale.locationId,
        description: `Customer return ${returnRecord.returnNumber} processed for sale ${sale.orderNumber}`,
        metadata: {
          returnNumber: returnRecord.returnNumber,
          saleOrderNumber: sale.orderNumber,
          totalRefundAmount: returnRecord.totalRefundAmount,
          itemCount: preparedReturnItems.length,
          reason: input.reason,
        },
      },
      tx,
    )

    return returnRecord
  })
}

export async function listReturns(input: ListReturnsInput = {}) {
  const page = input.page || 1
  const pageSize = input.pageSize || 20
  const offset = (page - 1) * pageSize

  const conditions = []

  if (input.saleId) {
    conditions.push(eq(returns.saleId, input.saleId))
  }

  if (input.locationId) {
    conditions.push(eq(returns.locationId, input.locationId))
  }

  if (input.search) {
    const pattern = `%${input.search}%`
    conditions.push(
      or(
        ilike(returns.returnNumber, pattern),
        ilike(sales.orderNumber, pattern),
        ilike(returns.reason, pattern),
      ),
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [totalCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(returns)
    .innerJoin(sales, eq(returns.saleId, sales.id))
    .where(whereClause)

  const rows = await db
    .select({
      id: returns.id,
      returnNumber: returns.returnNumber,
      saleId: returns.saleId,
      saleOrderNumber: sales.orderNumber,
      locationId: returns.locationId,
      locationName: locations.name,
      reason: returns.reason,
      totalRefundAmount: returns.totalRefundAmount,
      status: returns.status,
      userId: returns.userId,
      processedByUsername: profiles.username,
      createdAt: returns.createdAt,
      updatedAt: returns.updatedAt,
    })
    .from(returns)
    .innerJoin(sales, eq(returns.saleId, sales.id))
    .innerJoin(locations, eq(returns.locationId, locations.id))
    .leftJoin(profiles, eq(returns.userId, profiles.id))
    .where(whereClause)
    .orderBy(desc(returns.createdAt))
    .limit(pageSize)
    .offset(offset)

  const returnIds = rows.map((r) => r.id)
  const itemsByReturnId = new Map<
    string,
    Array<{
      productName: string
      sku: string | null
      attributes: Record<string, string>
      quantity: string
      unit: string
    }>
  >()

  if (returnIds.length > 0) {
    const itemRows = await db
      .select({
        returnId: returnItems.returnId,
        productName: products.name,
        sku: productVariants.sku,
        attributes: productVariants.attributes,
        quantity: returnItems.quantity,
        unit: products.unit,
      })
      .from(returnItems)
      .innerJoin(products, eq(returnItems.productId, products.id))
      .innerJoin(productVariants, eq(returnItems.variantId, productVariants.id))
      .where(inArray(returnItems.returnId, returnIds))

    for (const item of itemRows) {
      const list = itemsByReturnId.get(item.returnId) ?? []
      list.push({
        productName: item.productName,
        sku: item.sku,
        attributes: (item.attributes as Record<string, string>) || {},
        quantity: item.quantity,
        unit: item.unit,
      })
      itemsByReturnId.set(item.returnId, list)
    }
  }

  const returnsWithItems = rows.map((r) => ({
    ...r,
    items: itemsByReturnId.get(r.id) ?? [],
  }))

  return {
    returns: returnsWithItems,
    total: totalCountResult?.count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((totalCountResult?.count || 0) / pageSize),
  }
}

export async function getReturnById(returnId: string) {
  const [returnRecord] = await db
    .select({
      id: returns.id,
      returnNumber: returns.returnNumber,
      saleId: returns.saleId,
      saleOrderNumber: sales.orderNumber,
      locationId: returns.locationId,
      locationName: locations.name,
      reason: returns.reason,
      totalRefundAmount: returns.totalRefundAmount,
      status: returns.status,
      userId: returns.userId,
      createdAt: returns.createdAt,
      updatedAt: returns.updatedAt,
    })
    .from(returns)
    .innerJoin(sales, eq(returns.saleId, sales.id))
    .innerJoin(locations, eq(returns.locationId, locations.id))
    .where(eq(returns.id, returnId))
    .limit(1)

  if (!returnRecord) {
    return null
  }

  const [processor] = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.id, returnRecord.userId))
    .limit(1)

  const items = await db
    .select({
      id: returnItems.id,
      returnId: returnItems.returnId,
      saleItemId: returnItems.saleItemId,
      productId: returnItems.productId,
      productName: products.name,
      unit: products.unit,
      variantId: returnItems.variantId,
      sku: productVariants.sku,
      attributes: productVariants.attributes,
      quantity: returnItems.quantity,
      unitRefundPrice: returnItems.unitRefundPrice,
      subtotal: returnItems.subtotal,
    })
    .from(returnItems)
    .innerJoin(products, eq(returnItems.productId, products.id))
    .innerJoin(productVariants, eq(returnItems.variantId, productVariants.id))
    .where(eq(returnItems.returnId, returnRecord.id))

  return {
    ...returnRecord,
    processor,
    items,
  }
}

