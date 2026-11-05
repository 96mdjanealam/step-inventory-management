import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  size?: ModalSize
  className?: string
  closeOnBackdropClick?: boolean
  showCloseButton?: boolean
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  className = '',
  closeOnBackdropClick = true,
  showCloseButton = true,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`relative w-full ${sizeClasses[size]} bg-white border border-neutral-300 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header if title or close button is provided */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between p-5 border-b border-neutral-200 bg-neutral-50/50 flex-shrink-0">
            <div className="min-w-0 pr-4">
              {title && (
                <h3 className="text-base sm:text-lg font-bold text-brand-charcoal tracking-tight leading-snug">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 -mr-1 -mt-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition cursor-pointer flex-shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  )
}

function ModalBody({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`p-5 overflow-y-auto space-y-4 flex-1 ${className}`}>
      {children}
    </div>
  )
}

function ModalFooter({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex items-center justify-end gap-2.5 p-4 border-t border-neutral-200 bg-neutral-50/70 flex-shrink-0 ${className}`}
    >
      {children}
    </div>
  )
}

function ModalAlert({
  children,
  variant = 'error',
  className = '',
}: {
  children: React.ReactNode
  variant?: 'error' | 'warning' | 'info'
  className?: string
}) {
  const variantStyles = {
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  return (
    <div
      className={`p-3 text-xs border font-medium leading-relaxed ${variantStyles[variant]} ${className}`}
    >
      {children}
    </div>
  )
}

Modal.Body = ModalBody
Modal.Footer = ModalFooter
Modal.Alert = ModalAlert

