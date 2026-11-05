import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db/index.ts'
import {
  damageReports,
  inventory,
  locations,
  products,
  productVariants,
  returnItems,
  returns,
  saleItems,
  sales,
} from '../db/schema/index.ts'
import type {
  DashboardData,
  DashboardFilterInput,
  LocationInventoryMetric,
  RevenueTrendPoint,
  TopProductMetric,
} from '../../lib/schemas/dashboard.ts'

export async function getDashboardData(
  filters: DashboardFilterInput,
): Promise<DashboardData> {
  // Determine start and end timestamps
  const end = filters.endDate ? new Date(filters.endDate) : new Date()
  end.setHours(23, 59, 59, 999)

  const start = filters.startDate ? new Date(filters.startDate) : new Date()
  if (!filters.startDate) {
    start.setDate(start.getDate() - 29)
  }
  start.setHours(0, 0, 0, 0)

  // 1. Prepare parallel queries for high-performance concurrent execution

  // Sales & Units Metrics Promise
  const salesMetricsPromise = filters.productId
    ? db
        .select({
          totalRevenue: sql<string>`coalesce(sum(${saleItems.subtotal}), '0')`,
          totalOrders: sql<number>`count(distinct ${sales.id})::int`,
          unitsSold: sql<string>`coalesce(sum(${saleItems.quantity}), '0')`,
        })
        .from(saleItems)
        .innerJoin(sales, eq(saleItems.saleId, sales.id))
        .where(
          and(
            eq(sales.status, 'completed'),
            gte(sales.createdAt, start),
            lte(sales.createdAt, end),
            eq(saleItems.productId, filters.productId),
            filters.locationId
              ? eq(sales.locationId, filters.locationId)
              : undefined,
          ),
        )
        .then(([row]) => ({
          totalRevenue: parseFloat(row?.totalRevenue || '0'),
          totalOrders: Number(row?.totalOrders || 0),
          unitsSold: parseFloat(row?.unitsSold || '0'),
        }))
    : Promise.all([
        db
          .select({
            totalRevenue: sql<string>`coalesce(sum(${sales.totalAmount}), '0')`,
            totalOrders: sql<number>`count(distinct ${sales.id})::int`,
          })
          .from(sales)
          .where(
            and(
              eq(sales.status, 'completed'),
              gte(sales.createdAt, start),
              lte(sales.createdAt, end),
              filters.locationId
                ? eq(sales.locationId, filters.locationId)
                : undefined,
            ),
          ),
        db
          .select({
            unitsSold: sql<string>`coalesce(sum(${saleItems.quantity}), '0')`,
          })
          .from(saleItems)
          .innerJoin(sales, eq(saleItems.saleId, sales.id))
          .where(
            and(
              eq(sales.status, 'completed'),
              gte(sales.createdAt, start),
              lte(sales.createdAt, end),
              filters.locationId
                ? eq(sales.locationId, filters.locationId)
                : undefined,
            ),
          ),
      ]).then(([[salesRow], [unitsRow]]) => ({
        totalRevenue: parseFloat(salesRow?.totalRevenue || '0'),
        totalOrders: Number(salesRow?.totalOrders || 0),
        unitsSold: parseFloat(unitsRow?.unitsSold || '0'),
      }))

  // Current Inventory Valuation Promise
  const inventoryMetricsPromise = db
    .select({
      totalUnits: sql<string>`coalesce(sum(${inventory.quantity}), '0')`,
      totalValue: sql<string>`coalesce(sum(${inventory.quantity} * ${productVariants.discountedPrice}), '0')`,
    })
    .from(inventory)
    .innerJoin(productVariants, eq(inventory.variantId, productVariants.id))
    .innerJoin(locations, eq(inventory.locationId, locations.id))
    .where(
      and(
        eq(locations.isActive, true),
        filters.locationId
          ? eq(inventory.locationId, filters.locationId)
          : undefined,
        filters.productId
          ? eq(inventory.productId, filters.productId)
          : undefined,
      ),
    )
    .then(([row]) => ({
      currentStockUnits: parseFloat(row?.totalUnits || '0'),
      currentStockValue: parseFloat(row?.totalValue || '0'),
    }))

  // Damage Reports Metrics Promise
  const damageMetricsPromise = db
    .select({
      damagedUnits: sql<string>`coalesce(sum(${damageReports.quantity}), '0')`,
    })
    .from(damageReports)
    .where(
      and(
        gte(damageReports.createdAt, start),
        lte(damageReports.createdAt, end),
        filters.locationId
          ? eq(damageReports.sourceLocationId, filters.locationId)
          : undefined,
        filters.productId
          ? eq(damageReports.productId, filters.productId)
          : undefined,
      ),
    )
    .then(([row]) => parseFloat(row?.damagedUnits || '0'))

  // Customer Returns Metrics Promise
  const returnsMetricsPromise = db
    .select({
      returnedUnits: sql<string>`coalesce(sum(${returnItems.quantity}), '0')`,
    })
    .from(returnItems)
    .innerJoin(returns, eq(returnItems.returnId, returns.id))
    .where(
      and(
        gte(returns.createdAt, start),
        lte(returns.createdAt, end),
        filters.locationId
          ? eq(returns.locationId, filters.locationId)
          : undefined,
        filters.productId
          ? eq(returnItems.productId, filters.productId)
          : undefined,
      ),
    )
    .then(([row]) => parseFloat(row?.returnedUnits || '0'))

  // Daily Trend Query Promise
  const trendPromise = filters.productId
    ? db
        .select({
          day: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM-DD')`,
          revenue: sql<string>`coalesce(sum(${saleItems.subtotal}), '0')`,
          orders: sql<number>`count(distinct ${sales.id})::int`,
        })
        .from(saleItems)
        .innerJoin(sales, eq(saleItems.saleId, sales.id))
        .where(
          and(
            eq(sales.status, 'completed'),
            gte(sales.createdAt, start),
            lte(sales.createdAt, end),
            eq(saleItems.productId, filters.productId),
            filters.locationId
              ? eq(sales.locationId, filters.locationId)
              : undefined,
          ),
        )
        .groupBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`)
    : db
        .select({
          day: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM-DD')`,
          revenue: sql<string>`coalesce(sum(${sales.totalAmount}), '0')`,
          orders: sql<number>`count(distinct ${sales.id})::int`,
        })
        .from(sales)
        .where(
          and(
            eq(sales.status, 'completed'),
            gte(sales.createdAt, start),
            lte(sales.createdAt, end),
            filters.locationId
              ? eq(sales.locationId, filters.locationId)
              : undefined,
          ),
        )
        .groupBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`)

  // Top Products Query Promise
  const topProductsPromise = db
    .select({
      productId: products.id,
      productName: products.name,
      category: products.category,
      unit: products.unit,
      unitsSold: sql<string>`coalesce(sum(${saleItems.quantity}), '0')`,
      revenue: sql<string>`coalesce(sum(${saleItems.subtotal}), '0')`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(
      and(
        eq(sales.status, 'completed'),
        gte(sales.createdAt, start),
        lte(sales.createdAt, end),
        filters.locationId
          ? eq(sales.locationId, filters.locationId)
          : undefined,
        filters.productId
          ? eq(saleItems.productId, filters.productId)
          : undefined,
      ),
    )
    .groupBy(products.id, products.name, products.category, products.unit)
    .orderBy(sql`sum(${saleItems.subtotal}) desc`)
    .limit(6)

  // Facility Inventory Query Promise
  const locationInvPromise = db
    .select({
      locationId: locations.id,
      locationName: locations.name,
      locationType: locations.type,
      inStockUnits: sql<string>`coalesce(sum(${inventory.quantity}), '0')`,
      stockValue: sql<string>`coalesce(sum(${inventory.quantity} * ${productVariants.discountedPrice}), '0')`,
    })
    .from(locations)
    .leftJoin(
      inventory,
      and(
        eq(locations.id, inventory.locationId),
        filters.productId
          ? eq(inventory.productId, filters.productId)
          : undefined,
      ),
    )
    .leftJoin(productVariants, eq(inventory.variantId, productVariants.id))
    .where(
      and(
        eq(locations.isActive, true),
        filters.locationId ? eq(locations.id, filters.locationId) : undefined,
      ),
    )
    .groupBy(locations.id, locations.name, locations.type)
    .orderBy(
      sql`coalesce(sum(${inventory.quantity} * ${productVariants.discountedPrice}), '0') desc`,
    )

  // Execute ALL queries concurrently in parallel
  const [
    salesMetrics,
    invMetrics,
    damagedUnits,
    returnedUnits,
    trendRows,
    topProductsRaw,
    locationInvRaw,
  ] = await Promise.all([
    salesMetricsPromise,
    inventoryMetricsPromise,
    damageMetricsPromise,
    returnsMetricsPromise,
    trendPromise,
    topProductsPromise,
    locationInvPromise,
  ])

  // Build continuous daily sequence for charts
  const trendMap = new Map(
    trendRows.map((r) => [
      r.day,
      { revenue: parseFloat(r.revenue), orders: Number(r.orders) },
    ]),
  )
  const revenueTrend: RevenueTrendPoint[] = []
  const iterDate = new Date(start)
  while (iterDate <= end) {
    const yyyy = iterDate.getFullYear()
    const mm = String(iterDate.getMonth() + 1).padStart(2, '0')
    const dd = String(iterDate.getDate()).padStart(2, '0')
    const dayStr = `${yyyy}-${mm}-${dd}`
    const match = trendMap.get(dayStr)
    revenueTrend.push({
      date: dayStr,
      revenue: match ? match.revenue : 0,
      orders: match ? match.orders : 0,
    })
    iterDate.setDate(iterDate.getDate() + 1)
  }

  const topProducts: TopProductMetric[] = topProductsRaw.map((p) => ({
    productId: p.productId,
    productName: p.productName,
    category: p.category,
    unit: p.unit,
    unitsSold: parseFloat(p.unitsSold),
    revenue: parseFloat(p.revenue),
  }))

  const locationInventory: LocationInventoryMetric[] = locationInvRaw.map(
    (l) => ({
      locationId: l.locationId,
      locationName: l.locationName,
      locationType: l.locationType,
      inStockUnits: parseFloat(l.inStockUnits),
      stockValue: parseFloat(l.stockValue),
    }),
  )

  return {
    metrics: {
      totalRevenue: salesMetrics.totalRevenue,
      totalOrders: salesMetrics.totalOrders,
      unitsSold: salesMetrics.unitsSold,
      currentStockUnits: invMetrics.currentStockUnits,
      currentStockValue: invMetrics.currentStockValue,
      damagedUnits,
      returnedUnits,
    },
    revenueTrend,
    topProducts,
    locationInventory,
  }
}
