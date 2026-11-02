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
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2.5',
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
   COMPACT SMALL BUTTONS & TABLE ACTIONS
   ========================================================================= */

export type SmallButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'danger'
  | 'destructive'
  | 'success'
  | 'ghost'
  | 'default'

export interface SmallButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: SmallButtonVariant
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const smallButtonVariantStyles: Record<SmallButtonVariant, string> = {
  default:
    'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 active:bg-neutral-300 border border-transparent',
  secondary:
    'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:bg-neutral-300 border border-neutral-200',
  primary:
    'bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-950 border border-transparent',
  outline:
    'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100',
  danger:
    'text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200',
  destructive:
    'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 border border-transparent',
  success:
    'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200',
  ghost:
    'text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 hover:text-neutral-900 border border-transparent',
}

/**
 * Reusable small button component for compact actions (table cells, card headers, inline tools).
 * Maintains consistent sizing, typography, and crisp non-rounded borders across the app.
 */
export const SmallButton = React.forwardRef<HTMLButtonElement, SmallButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'secondary',
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
      'inline-flex items-center justify-center text-xs font-medium px-2.5 py-1 transition-colors select-none gap-1.5 focus:outline-hidden focus:ring-2 focus:ring-neutral-950/20 disabled:opacity-50 disabled:pointer-events-none'
    const variantClass =
      smallButtonVariantStyles[variant] || smallButtonVariantStyles.secondary

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${variantClass} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  },
)

SmallButton.displayName = 'SmallButton'

export interface SmallLinkButtonProps extends LinkProps {
  variant?: SmallButtonVariant
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/**
 * Compact navigation link styled as a SmallButton.
 */
export function SmallLinkButton({
  children,
  className = '',
  variant = 'secondary',
  leftIcon,
  rightIcon,
  ...props
}: SmallLinkButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center text-xs font-medium px-2.5 py-1 transition-colors select-none gap-1.5 focus:outline-hidden focus:ring-2 focus:ring-neutral-950/20'
  const variantClass =
    smallButtonVariantStyles[variant] || smallButtonVariantStyles.secondary

  return (
    <Link className={`${baseClasses} ${variantClass} ${className}`} {...props}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  )
}

// Backward-compatible table action aliases
export type TableActionVariant = SmallButtonVariant
export type TableActionButtonProps = SmallButtonProps
export const TableActionButton = SmallButton
export type TableActionLinkProps = SmallLinkButtonProps
export const TableActionLink = SmallLinkButton

