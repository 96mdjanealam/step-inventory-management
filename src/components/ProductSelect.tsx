import { useCallback } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Image as ImageIcon } from 'lucide-react'
import { listProductsFn } from '../server/functions/products.ts'
import { PaginatedSelect } from './PaginatedSelect.tsx'

export interface ProductSelectItem {
  id: string
  name: string
  category: string
  unit: string
  measurementType?: 'count' | 'weight' | 'volume'
  images?: string[] | null
  variantImage?: string | null
  discountedPrice?: string | null
}

export interface ProductSelectProps {
  value: string | null | undefined
  onChange: (value: string, product: ProductSelectItem | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  clearable?: boolean
  initialProduct?: ProductSelectItem | null
}

export function ProductSelect({
  value,
  onChange,
  placeholder = '-- Choose Product --',
  disabled = false,
  className = '',
  clearable = false,
  initialProduct = null,
}: ProductSelectProps) {
  const fetchProducts = useServerFn(listProductsFn)

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
      const res = await fetchProducts({
        data: {
          page,
          pageSize,
          search: search || undefined,
          includeArchived: false,
        },
      })
      return {
        items: (res.items || []) as ProductSelectItem[],
        total: res.total || 0,
      }
    },
    [fetchProducts],
  )

  function getThumbnail(p: ProductSelectItem) {
    const src = p.variantImage || p.images?.[0]
    return (
      <div className="w-8 h-8 rounded border border-neutral-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
        {src ? (
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <ImageIcon className="w-4 h-4 text-neutral-300" />
        )}
      </div>
    )
  }

  return (
    <PaginatedSelect<ProductSelectItem>
      value={value}
      onChange={onChange}
      fetcher={fetcher}
      getItemValue={(p) => p.id}
      getItemLabel={(p) => p.name}
      placeholder={placeholder}
      searchPlaceholder="Search products by name..."
      disabled={disabled}
      className={className}
      clearable={clearable}
      initialSelectedItem={initialProduct}
      renderSelected={(p) =>
        p ? (
          <div className="flex items-center gap-2 min-w-0">
            {getThumbnail(p)}
            <div className="truncate">
              <span className="font-semibold text-neutral-900">{p.name}</span>{' '}
              <span className="text-xs text-neutral-500 font-normal">
                ({p.category}) · {p.unit}
              </span>
            </div>
          </div>
        ) : null
      }
      renderItem={(p) => (
        <div className="flex items-center gap-3">
          {getThumbnail(p)}
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-neutral-900 truncate">
              {p.name}
            </div>
            <div className="text-xs text-neutral-500 truncate">
              {p.category} · Unit: {p.unit}
            </div>
          </div>
        </div>
      )}
    />
  )
}

