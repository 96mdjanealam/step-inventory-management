import { Calendar, RotateCcw } from 'lucide-react'
import { DatePicker } from '../DatePicker.tsx'
import { LocationSelect } from '../LocationSelect.tsx'
import { ProductSelect } from '../ProductSelect.tsx'

interface DashboardFilterBarProps {
  startDate?: string
  endDate?: string
  locationId?: string
  productId?: string
  onChange: (filters: {
    startDate?: string
    endDate?: string
    locationId?: string
    productId?: string
  }) => void
}

function formatDateStr(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function DashboardFilterBar({
  startDate,
  endDate,
  locationId,
  productId,
  onChange,
}: DashboardFilterBarProps) {
  const today = formatDateStr(new Date())

  // Quick preset helper
  const handlePreset = (days: number) => {
    const s = new Date()
    s.setDate(s.getDate() - (days - 1))
    onChange({
      startDate: formatDateStr(s),
      endDate: today,
      locationId,
      productId,
    })
  }

  const handleThisYear = () => {
    const s = new Date(new Date().getFullYear(), 0, 1)
    onChange({
      startDate: formatDateStr(s),
      endDate: today,
      locationId,
      productId,
    })
  }

  // Clear dates button: clears both date fields and resets range to last 30 days
  const handleClearDates = () => {
    onChange({
      startDate: undefined,
      endDate: undefined,
      locationId,
      productId,
    })
  }

  // Reset all filters (dates, store, product)
  const handleReset = () => {
    onChange({
      startDate: undefined,
      endDate: undefined,
      locationId: undefined,
      productId: undefined,
    })
  }

  // Determine which preset is active (if any)
  const is30dActive =
    (!startDate && !endDate) ||
    (startDate === formatDateStr(new Date(Date.now() - 29 * 86400000)) &&
      endDate === today)

  const is7dActive =
    startDate === formatDateStr(new Date(Date.now() - 6 * 86400000)) &&
    endDate === today

  const is90dActive =
    startDate === formatDateStr(new Date(Date.now() - 89 * 86400000)) &&
    endDate === today

  const isThisYearActive =
    startDate === `${new Date().getFullYear()}-01-01` && endDate === today

  const hasCustomDates = Boolean(startDate || endDate)
  const hasActiveFilters = Boolean(
    startDate || endDate || locationId || productId,
  )

  return (
    <div className="border border-neutral-200 bg-white p-4 space-y-4 shadow-2xs">
      {/* Top Row: Presets and From/To Date Pickers */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Date Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 mr-1 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            <Calendar className="size-3.5" />
            <span>Range:</span>
          </div>

          <button
            type="button"
            onClick={() => handlePreset(7)}
            className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
              is7dActive
                ? 'bg-brand-primary text-white border-brand-primary hover:bg-brand-dark'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Last 7 Days
          </button>

          <button
            type="button"
            onClick={() => handlePreset(30)}
            className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
              is30dActive
                ? 'bg-brand-primary text-white border-brand-primary hover:bg-brand-dark'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Last 30 Days
          </button>

          <button
            type="button"
            onClick={() => handlePreset(90)}
            className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
              is90dActive
                ? 'bg-brand-primary text-white border-brand-primary hover:bg-brand-dark'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Last 90 Days
          </button>

          <button
            type="button"
            onClick={handleThisYear}
            className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
              isThisYearActive
                ? 'bg-brand-primary text-white border-brand-primary hover:bg-brand-dark'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            This Year
          </button>
        </div>

        {/* Custom Start & End Date Pickers + Single Clear Date Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-neutral-500 font-medium">From:</span>
            <DatePicker
              value={startDate}
              maxDate={endDate || today}
              placeholder="Start date"
              className="w-36"
              align="left"
              onChange={(val) =>
                onChange({
                  startDate: val,
                  endDate: endDate || today,
                  locationId,
                  productId,
                })
              }
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-neutral-500 font-medium">To:</span>
            <DatePicker
              value={endDate}
              minDate={startDate}
              placeholder="End date"
              className="w-36"
              align="right"
              onChange={(val) =>
                onChange({
                  startDate:
                    startDate ||
                    formatDateStr(new Date(Date.now() - 29 * 86400000)),
                  endDate: val,
                  locationId,
                  productId,
                })
              }
            />
          </div>

          {hasCustomDates && (
            <button
              type="button"
              onClick={handleClearDates}
              className="h-8 px-2.5 border border-neutral-200 bg-white text-neutral-700 hover:text-brand-primary hover:border-brand-coral/60 hover:bg-brand-bg/30 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
              title="Clear custom dates and reset to Last 30 Days"
            >
              <RotateCcw className="size-3 text-neutral-400" />
              <span>Clear Dates</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Row: Location & Product Selects */}
      <div className="pt-3 border-t border-neutral-100 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
            Store / Warehouse Location
          </label>
          <LocationSelect
            value={locationId}
            onChange={(val) =>
              onChange({
                startDate,
                endDate,
                locationId: val || undefined,
                productId,
              })
            }
            clearable={true}
            placeholder="All Stores & Warehouses"
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
            Product Filter
          </label>
          <ProductSelect
            value={productId}
            locationId={locationId}
            onChange={(val) =>
              onChange({
                startDate,
                endDate,
                locationId,
                productId: val || undefined,
              })
            }
            clearable={true}
            placeholder="All Catalog Products"
          />
        </div>

        {hasActiveFilters && (
          <div className="md:self-end pb-0.5">
            <button
              type="button"
              onClick={handleReset}
              className="h-9 px-3 border border-neutral-200 bg-neutral-50 text-neutral-700 text-xs font-medium hover:bg-neutral-100 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
            >
              <RotateCcw className="size-3.5" />
              Reset All
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
