import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TopProductMetric } from '../../lib/schemas/dashboard.ts'

interface TopProductsChartProps {
  data: TopProductMetric[]
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
    payload: TopProductMetric
  }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null
  const item = payload[0].payload

  return (
    <div className="border border-neutral-300 bg-white p-3 shadow-md text-xs space-y-1 max-w-xs">
      <div className="font-semibold text-neutral-800 border-b border-neutral-100 pb-1">
        {item.productName}
      </div>
      <div className="text-[11px] text-neutral-500">
        Category: {item.category}
      </div>
      <div className="flex items-center justify-between gap-4 text-neutral-600 pt-1">
        <span>Units Sold:</span>
        <span className="font-mono font-medium text-brand-charcoal">
          {item.unitsSold.toLocaleString()} {item.unit}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 text-neutral-600">
        <span>Total Revenue:</span>
        <span className="font-mono font-medium text-brand-primary font-bold">
          ${item.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  )
}

function truncateName(name: string): string {
  return name.length > 14 ? `${name.slice(0, 12)}…` : name
}

export function TopProductsChart({ data }: TopProductsChartProps) {
  const hasData = data.length > 0

  return (
    <div className="border border-neutral-200 bg-white p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
            Top Performing Products
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            By sales revenue in selected timeframe
          </p>
        </div>
      </div>

      <div className="h-72 w-full pt-2">
        {!hasData ? (
          <div className="h-full flex items-center justify-center border border-dashed border-neutral-200 text-xs text-neutral-400">
            No product sales data in selected range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="productName"
                tickFormatter={truncateName}
                stroke="#a3a3a3"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e5e5e5' }}
              />
              <YAxis
                stroke="#a3a3a3"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e5e5e5' }}
                tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="#D04B50" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

