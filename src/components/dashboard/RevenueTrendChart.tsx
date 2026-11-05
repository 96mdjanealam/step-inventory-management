import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RevenueTrendPoint } from '../../lib/schemas/dashboard.ts'

interface RevenueTrendChartProps {
  data: RevenueTrendPoint[]
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
    name: string
    color: string
    payload: RevenueTrendPoint
  }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null

  const dataPoint = payload[0]?.payload
  const revenue = dataPoint?.revenue ?? (payload.find((p) => p.name === 'Revenue')?.value ?? 0)
  const orders = dataPoint?.orders ?? 0

  return (
    <div className="border border-neutral-300 bg-white p-3 shadow-md text-xs space-y-1">
      <div className="font-semibold text-neutral-800 border-b border-neutral-100 pb-1">
        {label}
      </div>
      <div className="flex items-center justify-between gap-4 text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span className="size-2 bg-brand-primary inline-block" />
          Revenue:
        </span>
        <span className="font-mono font-medium text-brand-charcoal">
          ${Number(revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span className="size-2 bg-brand-coral inline-block" />
          Orders:
        </span>
        <span className="font-mono font-medium text-brand-charcoal">
          {Number(orders).toLocaleString('en-US')}
        </span>
      </div>
    </div>
  )
}

function formatDateTick(tickStr: string): string {
  if (!tickStr) return ''
  const parts = tickStr.split('-')
  if (parts.length < 3) return tickStr
  return `${parts[1]}/${parts[2]}`
}

function formatRevenueTick(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`
  return `$${val}`
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  const hasData = data.some((d) => d.revenue > 0 || d.orders > 0)

  return (
    <div className="border border-neutral-200 bg-white p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
            Revenue & Sales Trend
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Daily gross completed sales over the selected period
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-neutral-600">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 bg-brand-primary inline-block" />
            <span>Revenue ($)</span>
          </div>
        </div>
      </div>

      <div className="h-72 w-full pt-2">
        {!hasData ? (
          <div className="h-full flex items-center justify-center border border-dashed border-neutral-200 text-xs text-neutral-400">
            No sales recorded in the selected period and filters
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D04B50" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#FFF4F1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateTick}
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
                tickFormatter={formatRevenueTick}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#D04B50"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#revenueGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

