import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '../db/index.ts'
import {
  damageReports,
  inventory,
  locations,
  products,
  productVariants,
  profiles,
  stockMovements,
} from '../db/schema/index.ts'
import { logActivity } from './activity-logs.ts'
import { fromFixed3, toFixed3 } from './sales.ts'
import type {
  ListDamageReportsInput,
  ReportDamageInput,
  ResolveDamageInput,
} from '../../lib/schemas/damage.ts'

export async function reportDamage(input: ReportDamageInput, userId: string) {
  return await db.transaction(async (tx) => {
    // 1. Fetch Central Damaged Stock singleton
    const [damagedLocation] = await tx
      .select()
      .from(locations)
      .where(eq(locations.type, 'damaged'))
      .limit(1)

    if (!damagedLocation) {
      throw new Error('Central Damaged Stock location not found')
    }

    if (!damagedLocation.isActive) {
      throw new Error('Central Damaged Stock location is inactive')
    }

    // 2. Fetch source location
    const [sourceLocation] = await tx
      .select()
      .from(locations)
      .where(eq(locations.id, input.sourceLocationId))
      .limit(1)

    if (!sourceLocation) {
      throw new Error('Source location not found')
    }

    if (!sourceLocation.isActive) {
      throw new Error(`Location "${sourceLocation.name}" is inactive`)
    }

    if (sourceLocation.type === 'damaged') {
      throw new Error(
        'Cannot report damage from Central Damaged Stock location itself',
      )
    }

    // 3. Fetch variant and product
    const [variant] = await tx
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        sku: productVariants.sku,
        variantActive: productVariants.isActive,
        productName: products.name,
        productActive: products.isActive,
        unit: products.unit,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(productVariants.id, input.variantId))
      .limit(1)

    if (!variant || !variant.variantActive || !variant.productActive) {
      throw new Error('Active product variant not found')
    }

    // 4. Lock inventory rows at source location and central damaged location
    const locIds = [sourceLocation.id, damagedLocation.id].sort()
    const lockedRows = await tx
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.variantId, variant.id),
          inArray(inventory.locationId, locIds),
        ),
      )
      .for('update')

    const sourceRow = lockedRows.find((r) => r.locationId === sourceLocation.id)
    const damagedRow = lockedRows.find(
      (r) => r.locationId === damagedLocation.id,
    )

    const damageQtyFixed3 = toFixed3(input.quantity)
    const sourceQtyFixed3 = sourceRow ? toFixed3(sourceRow.quantity) : 0n

    if (!sourceRow || sourceQtyFixed3 < damageQtyFixed3) {
      throw new Error(
        `Insufficient stock for "${variant.productName} (${variant.sku || 'No SKU'})" at ${sourceLocation.name}. Available: ${fromFixed3(sourceQtyFixed3)} ${variant.unit}, requested to quarantine: ${input.quantity} ${variant.unit}`,
      )
    }

    // 5. Decrement source inventory
    const newSourceQty = fromFixed3(sourceQtyFixed3 - damageQtyFixed3)
    await tx
      .update(inventory)
      .set({
        quantity: newSourceQty,
        updatedAt: new Date(),
      })
      .where(eq(inventory.id, sourceRow.id))

    // 6. Increment Central Damaged inventory
    const damagedQtyFixed3 = damagedRow ? toFixed3(damagedRow.quantity) : 0n
    const newDamagedQty = fromFixed3(damagedQtyFixed3 + damageQtyFixed3)

    if (damagedRow) {
      await tx
        .update(inventory)
        .set({
          quantity: newDamagedQty,
          updatedAt: new Date(),
        })
        .where(eq(inventory.id, damagedRow.id))
    } else {
      await tx.insert(inventory).values({
        productId: variant.productId,
        variantId: variant.id,
        locationId: damagedLocation.id,
        quantity: newDamagedQty,
      })
    }

    // 7. Generate sequence number
    const seqResult = (await tx.execute(
      sql`SELECT nextval('damage_number_seq') AS seq`,
    )) as unknown as { rows: Array<{ seq: string | number }> }
    const seq = seqResult.rows[0]?.seq
    const damageNumber = `DAM-${seq}`

    // 8. Insert damage report
    const [report] = await tx
      .insert(damageReports)
      .values({
        damageNumber,
        sourceLocationId: sourceLocation.id,
        productId: variant.productId,
        variantId: variant.id,
        quantity: input.quantity,
        reason: input.reason,
        status: 'quarantined',
        reportedBy: userId,
      })
      .returning()

    // 9. Append stock movement (type: 'damage')
    await tx.insert(stockMovements).values({
      productId: variant.productId,
      variantId: variant.id,
      sourceLocationId: sourceLocation.id,
      destinationLocationId: damagedLocation.id,
      type: 'damage',
      quantity: input.quantity,
      referenceType: 'damage_report',
      referenceId: report.damageNumber,
      reason: `Damaged stock quarantined: ${input.reason}`,
      userId,
    })

    // 10. Audit log
    await logActivity(
      {
        userId,
        action: 'damage.reported',
        entityType: 'damage_report',
        entityId: report.id,
        sourceLocationId: sourceLocation.id,
        destinationLocationId: damagedLocation.id,
        description: `Damage report ${report.damageNumber} created: quarantined ${input.quantity} ${variant.unit} of "${variant.productName}" from ${sourceLocation.name}`,
        metadata: {
          damageNumber: report.damageNumber,
          sourceLocationName: sourceLocation.name,
          productName: variant.productName,
          sku: variant.sku,
          quantity: input.quantity,
          reason: input.reason,
        },
      },
      tx,
    )

    return report
  })
}

export async function resolveDamage(input: ResolveDamageInput, userId: string) {
  return await db.transaction(async (tx) => {
    // 1. Fetch damage report
    const [report] = await tx
      .select()
      .from(damageReports)
      .where(eq(damageReports.id, input.damageReportId))
      .limit(1)

    if (!report) {
      throw new Error('Damage report not found')
    }

    if (report.status !== 'quarantined') {
      throw new Error(
        `Damage report ${report.damageNumber} is already resolved (${report.status})`,
      )
    }

    // 2. Fetch Central Damaged Stock singleton
    const [damagedLocation] = await tx
      .select()
      .from(locations)
      .where(eq(locations.type, 'damaged'))
      .limit(1)

    if (!damagedLocation) {
      throw new Error('Central Damaged Stock location not found')
    }

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
      .where(eq(productVariants.id, report.variantId))
      .limit(1)

    if (!variant) {
      throw new Error('Product variant not found')
    }

    const reportQtyFixed3 = toFixed3(report.quantity)

    if (input.action === 'repair') {
      if (!input.resolutionLocationId) {
        throw new Error(
          'Target location is required to restock repaired merchandise',
        )
      }

      // Fetch target restock location
      const [targetLocation] = await tx
        .select()
        .from(locations)
        .where(eq(locations.id, input.resolutionLocationId))
        .limit(1)

      if (!targetLocation) {
        throw new Error('Target restock location not found')
      }

      if (!targetLocation.isActive) {
        throw new Error(`Location "${targetLocation.name}" is inactive`)
      }

      if (targetLocation.type === 'damaged') {
        throw new Error(
          'Cannot return repaired stock back to Central Damaged Stock',
        )
      }

      // Lock both damaged location and target location inventory rows
      const locIds = [damagedLocation.id, targetLocation.id].sort()
      const lockedRows = await tx
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.variantId, variant.id),
            inArray(inventory.locationId, locIds),
          ),
        )
        .for('update')

      const damagedRow = lockedRows.find(
        (r) => r.locationId === damagedLocation.id,
      )
      const targetRow = lockedRows.find(
        (r) => r.locationId === targetLocation.id,
      )

      const damagedQtyFixed3 = damagedRow ? toFixed3(damagedRow.quantity) : 0n

      if (!damagedRow || damagedQtyFixed3 < reportQtyFixed3) {
        throw new Error(
          `Central Damaged Stock balance (${fromFixed3(damagedQtyFixed3)}) is less than report quantity (${report.quantity})`,
        )
      }

      // Decrement Central Damaged Stock
      await tx
        .update(inventory)
        .set({
          quantity: fromFixed3(damagedQtyFixed3 - reportQtyFixed3),
          updatedAt: new Date(),
        })
        .where(eq(inventory.id, damagedRow.id))

      // Increment Target Location Stock
      const targetQtyFixed3 = targetRow ? toFixed3(targetRow.quantity) : 0n
      const newTargetQty = fromFixed3(targetQtyFixed3 + reportQtyFixed3)

      if (targetRow) {
        await tx
          .update(inventory)
          .set({
            quantity: newTargetQty,
            updatedAt: new Date(),
          })
          .where(eq(inventory.id, targetRow.id))
      } else {
        await tx.insert(inventory).values({
          productId: variant.productId,
          variantId: variant.id,
          locationId: targetLocation.id,
          quantity: newTargetQty,
        })
      }

      // Record stock movement (type: 'repair')
      await tx.insert(stockMovements).values({
        productId: variant.productId,
        variantId: variant.id,
        sourceLocationId: damagedLocation.id,
        destinationLocationId: targetLocation.id,
        type: 'repair',
        quantity: report.quantity,
        referenceType: 'damage_resolution',
        referenceId: report.damageNumber,
        reason: `Repaired stock returned to inventory: ${input.notes}`,
        userId,
      })

      // Update damage report
      const [updatedReport] = await tx
        .update(damageReports)
        .set({
          status: 'repaired',
          resolutionNotes: input.notes,
          resolutionLocationId: targetLocation.id,
          resolvedAt: new Date(),
          resolvedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(damageReports.id, report.id))
        .returning()

      // Audit log
      await logActivity(
        {
          userId,
          action: 'damage.repaired',
          entityType: 'damage_report',
          entityId: report.id,
          sourceLocationId: damagedLocation.id,
          destinationLocationId: targetLocation.id,
          description: `Damage report ${report.damageNumber} repaired: restored ${report.quantity} ${variant.unit} of "${variant.productName}" to ${targetLocation.name}`,
          metadata: {
            damageNumber: report.damageNumber,
            resolutionLocationName: targetLocation.name,
            notes: input.notes,
          },
        },
        tx,
      )

      return updatedReport
    } else {
      // action === 'disposal'
      // Lock Central Damaged Stock row
      const [damagedRow] = await tx
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.variantId, variant.id),
            eq(inventory.locationId, damagedLocation.id),
          ),
        )
        .for('update')

      const damagedQtyFixed3 = damagedRow ? toFixed3(damagedRow.quantity) : 0n

      if (!damagedRow || damagedQtyFixed3 < reportQtyFixed3) {
        throw new Error(
          `Central Damaged Stock balance (${fromFixed3(damagedQtyFixed3)}) is less than report quantity (${report.quantity})`,
        )
      }

      // Decrement Central Damaged Stock
      await tx
        .update(inventory)
        .set({
          quantity: fromFixed3(damagedQtyFixed3 - reportQtyFixed3),
          updatedAt: new Date(),
        })
        .where(eq(inventory.id, damagedRow.id))

      // Record stock movement (type: 'disposal')
      await tx.insert(stockMovements).values({
        productId: variant.productId,
        variantId: variant.id,
        sourceLocationId: damagedLocation.id,
        destinationLocationId: null,
        type: 'disposal',
        quantity: report.quantity,
        referenceType: 'damage_resolution',
        referenceId: report.damageNumber,
        reason: `Damaged stock disposed / written off: ${input.notes}`,
        userId,
      })

      // Update damage report
      const [updatedReport] = await tx
        .update(damageReports)
        .set({
          status: 'disposed',
          resolutionNotes: input.notes,
          resolvedAt: new Date(),
          resolvedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(damageReports.id, report.id))
        .returning()

      // Audit log
      await logActivity(
        {
          userId,
          action: 'damage.disposed',
          entityType: 'damage_report',
          entityId: report.id,
          sourceLocationId: damagedLocation.id,
          description: `Damage report ${report.damageNumber} disposed: wrote off ${report.quantity} ${variant.unit} of "${variant.productName}"`,
          metadata: {
            damageNumber: report.damageNumber,
            notes: input.notes,
          },
        },
        tx,
      )

      return updatedReport
    }
  })
}

export async function listDamageReports(input: ListDamageReportsInput = {}) {
  const page = input.page || 1
  const pageSize = input.pageSize || 20
  const offset = (page - 1) * pageSize

  const conditions = []

  if (input.locationId) {
    conditions.push(
      or(
        eq(damageReports.sourceLocationId, input.locationId),
        eq(damageReports.resolutionLocationId, input.locationId),
      ),
    )
  }

  if (input.status) {
    conditions.push(eq(damageReports.status, input.status))
  }

  if (input.search) {
    const pattern = `%${input.search}%`
    conditions.push(
      or(
        ilike(damageReports.damageNumber, pattern),
        ilike(damageReports.reason, pattern),
        ilike(products.name, pattern),
        ilike(productVariants.sku, pattern),
      ),
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [totalCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(damageReports)
    .innerJoin(products, eq(damageReports.productId, products.id))
    .innerJoin(productVariants, eq(damageReports.variantId, productVariants.id))
    .where(whereClause)

  const rows = await db
    .select({
      id: damageReports.id,
      damageNumber: damageReports.damageNumber,
      sourceLocationId: damageReports.sourceLocationId,
      sourceLocationName: locations.name,
      productId: damageReports.productId,
      productName: products.name,
      unit: products.unit,
      variantId: damageReports.variantId,
      sku: productVariants.sku,
      quantity: damageReports.quantity,
      reason: damageReports.reason,
      status: damageReports.status,
      resolutionNotes: damageReports.resolutionNotes,
      resolutionLocationId: damageReports.resolutionLocationId,
      resolvedAt: damageReports.resolvedAt,
      resolvedBy: damageReports.resolvedBy,
      reportedBy: damageReports.reportedBy,
      reporterUsername: profiles.username,
      createdAt: damageReports.createdAt,
      updatedAt: damageReports.updatedAt,
    })
    .from(damageReports)
    .innerJoin(locations, eq(damageReports.sourceLocationId, locations.id))
    .innerJoin(products, eq(damageReports.productId, products.id))
    .innerJoin(productVariants, eq(damageReports.variantId, productVariants.id))
    .leftJoin(profiles, eq(damageReports.reportedBy, profiles.id))
    .where(whereClause)
    .orderBy(desc(damageReports.createdAt))
    .limit(pageSize)
    .offset(offset)

  return {
    damageReports: rows,
    total: totalCountResult?.count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((totalCountResult?.count || 0) / pageSize),
  }
}

export async function getDamageReportById(damageReportId: string) {
  const [report] = await db
    .select({
      id: damageReports.id,
      damageNumber: damageReports.damageNumber,
      sourceLocationId: damageReports.sourceLocationId,
      sourceLocationName: locations.name,
      productId: damageReports.productId,
      productName: products.name,
      unit: products.unit,
      variantId: damageReports.variantId,
      sku: productVariants.sku,
      attributes: productVariants.attributes,
      quantity: damageReports.quantity,
      reason: damageReports.reason,
      status: damageReports.status,
      resolutionNotes: damageReports.resolutionNotes,
      resolutionLocationId: damageReports.resolutionLocationId,
      resolvedAt: damageReports.resolvedAt,
      resolvedBy: damageReports.resolvedBy,
      reportedBy: damageReports.reportedBy,
      createdAt: damageReports.createdAt,
      updatedAt: damageReports.updatedAt,
    })
    .from(damageReports)
    .innerJoin(locations, eq(damageReports.sourceLocationId, locations.id))
    .innerJoin(products, eq(damageReports.productId, products.id))
    .innerJoin(productVariants, eq(damageReports.variantId, productVariants.id))
    .where(eq(damageReports.id, damageReportId))
    .limit(1)

  if (!report) {
    return null
  }

  let resolutionLocation = null
  if (report.resolutionLocationId) {
    const [resLoc] = await db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(eq(locations.id, report.resolutionLocationId))
      .limit(1)
    resolutionLocation = resLoc || null
  }

  const [reporter] = await db
    .select({ id: profiles.id, username: profiles.username })
    .from(profiles)
    .where(eq(profiles.id, report.reportedBy))
    .limit(1)

  let resolver = null
  if (report.resolvedBy) {
    const [res] = await db
      .select({ id: profiles.id, username: profiles.username })
      .from(profiles)
      .where(eq(profiles.id, report.resolvedBy))
      .limit(1)
    resolver = res || null
  }

  return {
    ...report,
    resolutionLocation,
    reporter,
    resolver,
  }
}

