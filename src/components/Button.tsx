import React from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'

export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-950 shadow-xs border border-transparent',
  secondary:
    'bg-white text-neutral-800 border border-neutral-200 hover:bg-neutral-50 active:bg-neutral-100 shadow-2xs',
  outline:
    'bg-transparent text-neutral-700 border border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100',
  ghost:
    'bg-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 active:bg-neutral-200',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-xs border border-transparent',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-5 py-2.5 text-base rounded-lg gap-2.5',
}

/**
 * Standard reusable button component for forms, modals, headers, and general UI actions.
 * Enforces consistent design token styling, focus rings, disabled and loading states.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-hidden focus:ring-2 focus:ring-neutral-950/20 disabled:pointer-events-none disabled:opacity-50'
    const variantClass = variantStyles[variant] || variantStyles.primary
    const sizeClass = sizeStyles[size] || sizeStyles.md

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${variantClass} ${sizeClass} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  },
)

Button.displayName = 'Button'

export interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/**
 * Standard reusable button styling attached to a TanStack Router <Link>.
 * Ideal for primary header actions (e.g. "+ New Sale", "+ New Product").
 */
export function LinkButton({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  ...props
}: LinkButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-hidden focus:ring-2 focus:ring-neutral-950/20'
  const variantClass = variantStyles[variant] || variantStyles.primary
  const sizeClass = sizeStyles[size] || sizeStyles.md

  return (
    <Link
      className={`${baseClasses} ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  )
}

/* =========================================================================
   COMPACT TABLE ACTION BUTTONS (Specifically designed for table cells)
   ========================================================================= */

export type TableActionVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'danger'
  | 'success'
  | 'ghost'

export interface TableActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TableActionVariant
  isLoading?: boolean
  leftIcon?: React.ReactNode
}

const tableActionVariantStyles: Record<TableActionVariant, string> = {
  default:
    'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 active:bg-neutral-300',
  secondary:
    'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 active:bg-neutral-300',
  primary:
    'bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-950',
  outline:
    'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100 active:bg-neutral-200',
  danger:
    'text-rose-600 hover:bg-rose-50 active:bg-rose-100 hover:text-rose-700',
  success:
    'text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 hover:text-emerald-800',
  ghost:
    'text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 hover:text-neutral-900',
}

/**
 * Compact button component specifically designed for table row action cells.
 * Does NOT consume full button sizing or padding, keeping tables tight and readable.
 */
export const TableActionButton = React.forwardRef<
  HTMLButtonElement,
  TableActionButtonProps
>(
  (
    {
      children,
      className = '',
      variant = 'default',
      isLoading = false,
      disabled = false,
      leftIcon,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center text-xs font-medium px-2.5 py-1 rounded-md transition-colors gap-1 disabled:opacity-50 disabled:pointer-events-none'
    const variantClass =
      tableActionVariantStyles[variant] || tableActionVariantStyles.default

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${variantClass} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        {children}
      </button>
    )
  },
)

TableActionButton.displayName = 'TableActionButton'

export interface TableActionLinkProps extends LinkProps {
  variant?: TableActionVariant
  leftIcon?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/**
 * Compact link button for table row actions that navigate (e.g. "View Stock", "View Order").
 */
export function TableActionLink({
  children,
  className = '',
  variant = 'default',
  leftIcon,
  ...props
}: TableActionLinkProps) {
  const baseClasses =
    'inline-flex items-center justify-center text-xs font-medium px-2.5 py-1 rounded-md transition-colors gap-1'
  const variantClass =
    tableActionVariantStyles[variant] || tableActionVariantStyles.default

  return (
    <Link className={`${baseClasses} ${variantClass} ${className}`} {...props}>
      {leftIcon}
      {children}
    </Link>
  )
}

