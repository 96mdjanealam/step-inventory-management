import { z } from 'zod'

export const dashboardFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  locationId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
})

export type DashboardFilterInput = z.infer<typeof dashboardFilterSchema>

export interface DashboardMetrics {
  totalRevenue: number
  totalOrders: number
  unitsSold: number
  currentStockUnits: number
  currentStockValue: number
  damagedUnits: number
  returnedUnits: number
}

export interface RevenueTrendPoint {
  date: string // YYYY-MM-DD
  revenue: number
  orders: number
}

export interface TopProductMetric {
  productId: string
  productName: string
  category: string
  unit: string
  unitsSold: number
  revenue: number
}

export interface LocationInventoryMetric {
  locationId: string
  locationName: string
  locationType: string
  inStockUnits: number
  stockValue: number
}

export interface DashboardData {
  metrics: DashboardMetrics
  revenueTrend: RevenueTrendPoint[]
  topProducts: TopProductMetric[]
  locationInventory: LocationInventoryMetric[]
}
