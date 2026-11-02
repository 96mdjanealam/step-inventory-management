import { useCallback } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { listLocationsPaginatedFn } from '../server/functions/locations.ts'
import { PaginatedSelect } from './PaginatedSelect.tsx'

export interface LocationItem {
  id: string
  name: string
  type: 'warehouse' | 'store' | 'damaged'
  storeType?: 'ownstore' | 'franchise' | null
  address?: string | null
  phone?: string | null
  isActive: boolean
}

export interface LocationSelectProps {
  value: string | null | undefined
  onChange: (value: string, location: LocationItem | null) => void
  type?: 'warehouse' | 'store' | 'damaged'
  storeType?: 'ownstore' | 'franchise'
  placeholder?: string
  disabled?: boolean
  className?: string
  clearable?: boolean
  initialLocation?: LocationItem | null
  includeInactive?: boolean
}

export function LocationSelect({
  value,
  onChange,
  type,
  storeType,
  placeholder = '-- Choose Location --',
  disabled = false,
  className = '',
  clearable = false,
  initialLocation = null,
  includeInactive = false,
}: LocationSelectProps) {
  const fetchLocations = useServerFn(listLocationsPaginatedFn)

  const fetcher = useCallback(
    async ({
      page,
      pageSize,
      search,
    }: {
      page: number
      pageSize: number
      search: string
    }) => {
      const res = await fetchLocations({
        data: {
          page,
          pageSize,
          search: search || undefined,
          type,
          storeType,
          includeInactive,
        },
      })
      return res as { items: LocationItem[]; total: number }
    },
    [fetchLocations, type, storeType, includeInactive],
  )

  function getTypeBadge(loc: LocationItem) {
    if (loc.type === 'warehouse') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Warehouse
        </span>
      )
    }
    if (loc.type === 'damaged') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Damaged Stock
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        {loc.storeType === 'ownstore' ? 'Company Store' : 'Franchise'}
      </span>
    )
  }

  return (
    <PaginatedSelect<LocationItem>
      value={value}
      onChange={onChange}
      fetcher={fetcher}
      getItemValue={(loc) => loc.id}
      getItemLabel={(loc) => loc.name}
      placeholder={placeholder}
      searchPlaceholder="Search locations by name or address..."
      disabled={disabled}
      className={className}
      clearable={clearable}
      initialSelectedItem={initialLocation}
      reloadTrigger={`${type}-${storeType}`}
      renderSelected={(loc) =>
        loc ? (
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-neutral-900 truncate">
              {loc.name}
            </span>
            {getTypeBadge(loc)}
          </div>
        ) : null
      }
      renderItem={(loc) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-neutral-900 truncate">
              {loc.name}
            </div>
            {loc.address && (
              <div className="text-xs text-neutral-500 truncate">
                {loc.address}
              </div>
            )}
          </div>
          <div className="flex-shrink-0">{getTypeBadge(loc)}</div>
        </div>
      )}
    />
  )
}

