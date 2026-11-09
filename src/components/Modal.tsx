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
        className={`relative w-full ${sizeClasses[size]} bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header if title or close button is provided */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between p-5 border-b border-neutral-700/60 bg-brand-charcoal text-white flex-shrink-0">
            <div className="min-w-0 pr-4">
              {title && (
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 -mr-1 -mt-1 text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer flex-shrink-0"
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

import { Alert, type AlertVariant } from './Alert.tsx'

export interface ModalAlertProps {
  children: React.ReactNode
  variant?: AlertVariant
  className?: string
  title?: string
}

function ModalAlert({
  children,
  variant = 'error',
  className = '',
  title,
}: ModalAlertProps) {
  return (
    <Alert variant={variant} title={title} className={className}>
      {children}
    </Alert>
  )
}

Modal.Body = ModalBody
Modal.Footer = ModalFooter
Modal.Alert = ModalAlert

