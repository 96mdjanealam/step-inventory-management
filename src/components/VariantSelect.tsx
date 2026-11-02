import { useCallback } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Image as ImageIcon } from 'lucide-react'
import { formatVariantInfo } from '../lib/display-formatters.tsx'
import { listStoreInventoryPaginatedFn } from '../server/functions/sales.ts'
import { listProductVariantsPaginatedFn } from '../server/functions/variants.ts'
import { PaginatedSelect } from './PaginatedSelect.tsx'

export interface VariantSelectItem {
  id: string
  productId: string
  productName?: string
  category?: string
  measurementType?: 'count' | 'weight' | 'volume'
  unit?: string
  productImages?: string[] | null
  variantId: string
  sku?: string | null
  attributes?: Record<string, string> | null
  variantImage?: string | null
  image?: string | null
  quantity?: string
  price: string
  discountedPrice?: string
  regularPrice?: string | null
}

export interface VariantSelectProps {
  value: string | null | undefined
  onChange: (value: string, variant: VariantSelectItem | null) => void
  locationId?: string
  productId?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  clearable?: boolean
  initialVariant?: VariantSelectItem | null
}

export function VariantSelect({
  value,
  onChange,
  locationId,
  productId,
  placeholder = '-- Choose Variant --',
  disabled = false,
  className = '',
  clearable = false,
  initialVariant = null,
}: VariantSelectProps) {
  const fetchStoreInventory = useServerFn(listStoreInventoryPaginatedFn)
  const fetchCatalogVariants = useServerFn(listProductVariantsPaginatedFn)

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
      // Mode 1: Fetch location in-stock variants
      if (locationId) {
        const res = await fetchStoreInventory({
          data: {
            locationId,
            productId: productId || undefined,
            page,
            pageSize,
            search: search || undefined,
          },
        })
        return {
          items: (res.items || []).map((item) => ({
            ...item,
            variantId: item.variantId || item.id,
            price: item.price || '0.00',
          })) as VariantSelectItem[],
          total: res.total || 0,
        }
      }

      // Mode 2: Fetch product catalog variants
      if (productId) {
        const res = await fetchCatalogVariants({
          data: {
            productId,
            page,
            pageSize,
            search: search || undefined,
          },
        })
        return {
          items: (res.items || []).map((v) => ({
            id: v.id,
            variantId: v.id,
            productId: v.productId,
            sku: v.sku,
            attributes: v.attributes as Record<string, string>,
            variantImage: v.image,
            image: v.image,
            price: v.discountedPrice,
            regularPrice: v.regularPrice,
          })) as VariantSelectItem[],
          total: res.total || 0,
        }
      }

      return { items: [], total: 0 }
    },
    [fetchStoreInventory, fetchCatalogVariants, locationId, productId],
  )

  function getThumbnail(v: VariantSelectItem) {
    const src = v.variantImage || v.image || v.productImages?.[0]
    return (
      <div className="w-8 h-8 border border-neutral-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
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

  const computedPlaceholder = !locationId && !productId
    ? '-- Select Product First --'
    : placeholder

  return (
    <PaginatedSelect<VariantSelectItem>
      value={value}
      onChange={onChange}
      fetcher={fetcher}
      getItemValue={(v) => v.variantId || v.id}
      getItemLabel={(v) => {
        const { title, subtitle } = formatVariantInfo(v)
        return `${title}${subtitle ? ` · ${subtitle}` : ''} · $${Number(v.price).toFixed(2)}`
      }}
      placeholder={computedPlaceholder}
      searchPlaceholder="Search variants by SKU or attributes..."
      disabled={disabled || (!locationId && !productId)}
      className={className}
      clearable={clearable}
      initialSelectedItem={initialVariant}
      reloadTrigger={`${locationId}-${productId}`}
      renderSelected={(v) => {
        if (!v) return null
        const { title, subtitle } = formatVariantInfo(v)
        return (
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 truncate">
              {getThumbnail(v)}
              <div className="truncate">
                <span className="font-semibold text-neutral-900 truncate">
                  {title}
                </span>
                {subtitle && (
                  <span className="text-xs text-neutral-500 font-normal ml-2">
                    {subtitle}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0 text-xs">
              <span className="font-bold text-neutral-900 mr-2">
                ${Number(v.price).toFixed(2)}
              </span>
              {v.quantity !== undefined && (
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 border border-emerald-200">
                  Stock: {v.quantity} {v.unit}
                </span>
              )}
            </div>
          </div>
        )
      }}
      renderItem={(v) => {
        const { title, subtitle } = formatVariantInfo(v)
        return (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {getThumbnail(v)}
              <div className="min-w-0">
                <div className="font-semibold text-neutral-900 truncate">
                  {title}
                </div>
                {subtitle ? (
                  <div className="text-xs text-neutral-500 truncate">
                    {subtitle}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="text-right flex-shrink-0 text-xs">
              <div className="font-bold text-neutral-900">
                ${Number(v.price).toFixed(2)}
              </div>
              {v.quantity !== undefined && (
                <div className="text-emerald-700 font-semibold">
                  Stock: {v.quantity} {v.unit}
                </div>
              )}
            </div>
          </div>
        )
      }}
    />
  )
}
