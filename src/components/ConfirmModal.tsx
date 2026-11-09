import React, { useEffect } from 'react'
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react'
import { Button } from './Button.tsx'

export interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title?: string
  description?: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'primary'
  isLoading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Please Confirm',
  description,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const iconConfig = {
    danger: {
      Icon: AlertCircle,
      iconClass: 'text-rose-600',
      bgClass: 'bg-rose-50 border-rose-200',
      buttonVariant: 'danger' as const,
    },
    warning: {
      Icon: AlertTriangle,
      iconClass: 'text-amber-600',
      bgClass: 'bg-amber-50 border-amber-200',
      buttonVariant: 'secondary' as const,
    },
    primary: {
      Icon: Info,
      iconClass: 'text-brand-primary',
      bgClass: 'bg-brand-bg border-rose-200',
      buttonVariant: 'primary' as const,
    },
  }[variant]

  const Icon = iconConfig.Icon

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={(e) => {
        if (!isLoading && e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="relative w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-700/60 bg-brand-charcoal text-white flex-shrink-0">
          <div className="min-w-0 pr-4">
            <h3
              id="confirm-modal-title"
              className="text-base font-bold text-white tracking-tight leading-snug"
            >
              {title}
            </h3>
            {description && (
              <p className="text-xs text-neutral-300 mt-0.5 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {!isLoading && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 -mr-1 text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer flex-shrink-0"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 flex items-start gap-3.5">
          <div
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center border ${iconConfig.bgClass}`}
          >
            <Icon className={`w-5 h-5 ${iconConfig.iconClass}`} />
          </div>
          <div className="flex-1 min-w-0 text-sm text-neutral-700 leading-relaxed pt-0.5">
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-neutral-200 bg-neutral-50/70 flex-shrink-0">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={iconConfig.buttonVariant}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
