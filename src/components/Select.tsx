import { forwardRef, type SelectHTMLAttributes } from 'react'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  sizeVariant?: 'sm' | 'md'
}

/**
 * Standardized reusable dropdown for simple static or enum selects
 * that do not require server pagination. Provides uniform border, focus ring,
 * typography, and padding across the app.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', sizeVariant = 'md', children, ...props }, ref) => {
    const sizeClasses =
      sizeVariant === 'sm'
        ? 'px-3 py-1.5 text-xs'
        : 'px-3 py-2 text-sm'

    return (
      <select
        ref={ref}
        className={`rounded-lg border border-neutral-300 bg-white font-medium text-neutral-800 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400 transition cursor-pointer ${sizeClasses} ${className}`}
        {...props}
      >
        {children}
      </select>
    )
  },
)

Select.displayName = 'Select'
