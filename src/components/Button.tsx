import React from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'dangerSoft'
  | 'success'

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-hidden focus:ring-2 focus:ring-brand-primary/25 disabled:pointer-events-none disabled:opacity-50'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-primary text-white hover:bg-brand-dark active:bg-brand-dark border border-transparent shadow-xs',
  secondary:
    'bg-white text-neutral-800 border border-neutral-200 hover:bg-neutral-50 active:bg-neutral-100',
  outline:
    'bg-transparent text-neutral-700 border border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100',
  ghost:
    'bg-transparent text-neutral-600 hover:text-brand-charcoal hover:bg-neutral-100 active:bg-neutral-200 border border-transparent',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 border border-transparent',
  dangerSoft:
    'text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200',
  success:
    'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200',
}

const sizes: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs gap-1.5',
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2.5',
}

type StyleOptions = {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

function buttonClasses({
  variant = 'primary',
  size = 'md',
  className = '',
}: StyleOptions = {}) {
  return [base, variants[variant], sizes[size], className]
    .filter(Boolean)
    .join(' ')
}

interface IconProps {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export interface ButtonProps
  extends React.ComponentProps<'button'>,
    IconProps {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
}

export function Button({
  children,
  className,
  variant,
  size,
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {isLoading ? (
        <Loader2
          className={`${size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4'} animate-spin`}
        />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  )
}

export interface LinkButtonProps extends LinkProps, IconProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: React.ReactNode
}

export function LinkButton({
  children,
  className,
  variant,
  size,
  leftIcon,
  rightIcon,
  ...props
}: LinkButtonProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  )
}
