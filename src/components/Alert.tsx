import React from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
} from 'lucide-react'

export type AlertVariant = 'error' | 'warning' | 'info' | 'success'

export interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: React.ReactNode
  onClose?: () => void
  className?: string
}

const variantConfig: Record<
  AlertVariant,
  {
    container: string
    titleColor: string
    iconColor: string
    textColor: string
    Icon: React.ComponentType<{ className?: string }>
  }
> = {
  error: {
    container: 'bg-rose-50 border-rose-200 text-rose-900',
    titleColor: 'text-rose-900',
    iconColor: 'text-rose-600',
    textColor: 'text-rose-800',
    Icon: AlertCircle,
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-900',
    titleColor: 'text-amber-900',
    iconColor: 'text-amber-600',
    textColor: 'text-amber-800',
    Icon: AlertTriangle,
  },
  info: {
    container: 'bg-sky-50 border-sky-200 text-sky-900',
    titleColor: 'text-sky-900',
    iconColor: 'text-sky-600',
    textColor: 'text-sky-800',
    Icon: Info,
  },
  success: {
    container: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    titleColor: 'text-emerald-900',
    iconColor: 'text-emerald-600',
    textColor: 'text-emerald-800',
    Icon: CheckCircle2,
  },
}

export function Alert({
  variant = 'error',
  title,
  children,
  onClose,
  className = '',
}: AlertProps) {
  const config = variantConfig[variant]
  const Icon = config.Icon

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 p-3.5 border shadow-2xs transition-colors ${config.container} ${className}`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${config.iconColor}`} />

      <div className="flex-1 min-w-0 text-xs leading-relaxed">
        {title ? (
          <h4 className={`font-semibold mb-0.5 ${config.titleColor}`}>
            {title}
          </h4>
        ) : null}
        <div className={`font-medium ${config.textColor}`}>{children}</div>
      </div>

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="p-1 -mr-1 -mt-1 text-neutral-400 hover:text-neutral-700 transition cursor-pointer flex-shrink-0"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  )
}
