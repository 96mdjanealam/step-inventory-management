export interface VariantData {
  attributes?: Record<string, any> | null
  sku?: string | null
  name?: string | null
}

export interface ProductData {
  name?: string | null
  variantCount?: number | null
  attributes?: Record<string, any> | string[] | null
  additionalInfo?: (string | null | undefined)[]
  sku?: string | null
}

/**
 * Formats variant display details according to standardized rules:
 * - First line: Show the variant name using its first two attributes and their values.
 *   If there is only one attribute, use that attribute and its value.
 *   If the variant has no attributes, use its SKU as the display name when available.
 * - Second line: Show the SKU, if available (prefixed with 'SKU: ').
 * - SKU is secondary priority; never display empty placeholders or repeated SKUs.
 *
 * Example:
 * Line 1: Red / XL
 * Line 2: SKU: SKU-12345
 */
export function formatVariantInfo(variant?: VariantData | null): {
  title: string
  subtitle: string | null
} {
  if (!variant) {
    return { title: 'Unknown Variant', subtitle: null }
  }

  const rawAttrs =
    variant.attributes && typeof variant.attributes === 'object'
      ? Object.values(variant.attributes)
          .map((v) => (v != null ? String(v).trim() : ''))
          .filter((v) => v.length > 0)
      : []

  const sku = variant.sku && variant.sku.trim().length > 0 ? variant.sku.trim() : null

  if (rawAttrs.length > 0) {
    // Show first two attributes and their values joined by " / "
    const title = rawAttrs.slice(0, 2).join(' / ')
    const subtitle = sku ? `SKU: ${sku}` : null
    return { title, subtitle }
  }

  // If the variant has no attributes, use its SKU as display name when available
  if (sku) {
    return { title: sku, subtitle: null }
  }

  return { title: variant.name?.trim() || 'Default Variant', subtitle: null }
}

/**
 * Formats product display details:
 * - First line: Product Name (Variant Count) - only include count if applicable (>0)
 * - Second line: Available attributes and other relevant information joined with ' / '
 * - Third line: SKU, if needed and available (prefixed with 'SKU: ')
 *
 * Example:
 * Line 1: Product Name (3)
 * Line 2: Red / XL / Unisex / Piece
 * Line 3: SKU: SKU-12345
 */
export function formatProductInfo(product?: ProductData | null): {
  line1: string
  line2: string | null
  line3: string | null
} {
  if (!product) {
    return { line1: 'Unknown Product', line2: null, line3: null }
  }

  const name = product.name?.trim() || 'Unnamed Product'
  const count =
    product.variantCount != null && product.variantCount > 0
      ? ` (${product.variantCount})`
      : ''
  const line1 = `${name}${count}`

  const infoParts: string[] = []

  if (product.attributes) {
    if (Array.isArray(product.attributes)) {
      infoParts.push(
        ...product.attributes
          .map((a) => (a != null ? String(a).trim() : ''))
          .filter(Boolean),
      )
    } else if (typeof product.attributes === 'object') {
      infoParts.push(
        ...Object.values(product.attributes)
          .map((v) => (v != null ? String(v).trim() : ''))
          .filter(Boolean),
      )
    }
  }

  if (product.additionalInfo) {
    for (const info of product.additionalInfo) {
      if (info && typeof info === 'string' && info.trim().length > 0) {
        infoParts.push(info.trim())
      }
    }
  }

  const uniqueParts = Array.from(new Set(infoParts))
  const line2 = uniqueParts.length > 0 ? uniqueParts.join(' / ') : null

  const sku = product.sku && product.sku.trim().length > 0 ? product.sku.trim() : null
  const line3 = sku ? `SKU: ${sku}` : null

  return { line1, line2, line3 }
}

/**
 * Reusable component for rendering standardized variant details
 */
export function VariantDisplay({
  variant,
  className = '',
  titleClassName = 'font-semibold text-neutral-900 truncate',
  subtitleClassName = 'text-xs text-neutral-500 truncate',
}: {
  variant?: VariantData | null
  className?: string
  titleClassName?: string
  subtitleClassName?: string
}) {
  const { title, subtitle } = formatVariantInfo(variant)

  return (
    <div className={`min-w-0 ${className}`}>
      <div className={titleClassName}>{title}</div>
      {subtitle && <div className={subtitleClassName}>{subtitle}</div>}
    </div>
  )
}

/**
 * Reusable component for rendering standardized product details
 */
export function ProductDisplay({
  product,
  className = '',
  line1ClassName = 'font-semibold text-neutral-900 truncate',
  line2ClassName = 'text-xs text-neutral-500 truncate',
  line3ClassName = 'text-xs font-mono text-neutral-400 truncate',
}: {
  product?: ProductData | null
  className?: string
  line1ClassName?: string
  line2ClassName?: string
  line3ClassName?: string
}) {
  const { line1, line2, line3 } = formatProductInfo(product)

  return (
    <div className={`min-w-0 ${className}`}>
      <div className={line1ClassName}>{line1}</div>
      {line2 && <div className={line2ClassName}>{line2}</div>}
      {line3 && <div className={line3ClassName}>{line3}</div>}
    </div>
  )
}
