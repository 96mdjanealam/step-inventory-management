import React from 'react'

export interface PriceInputProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange' | 'prefix'> {
  value?: string | number
  defaultValue?: string | number
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onValueChange?: (value: string) => void
  prefix?: React.ReactNode
  error?: boolean
  className?: string
  inputClassName?: string
}

/**
 * Sanitizes input text so it only contains non-negative digits and at most 2 decimal places.
 * Example: "123.456" -> "123.45"
 * Example: "abc$25.5" -> "25.5"
 */
function sanitizePrice(val: string): string {
  // Strip everything except digits and decimal point
  let cleaned = val.replace(/[^0-9.]/g, '')

  // Allow only the first decimal point
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('')
  }

  // Restrict to max 2 decimal places
  const [intPart, decimalPart] = cleaned.split('.')
  if (decimalPart !== undefined) {
    return `${intPart}.${decimalPart.slice(0, 2)}`
  }
  return cleaned
}

export function PriceInput({
  value,
  defaultValue,
  onChange,
  onValueChange,
  prefix = '$',
  error = false,
  className = '',
  inputClassName = '',
  disabled = false,
  placeholder = '0.00',
  ...props
}: PriceInputProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Allow navigation, deletion, copy/paste/select-all
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'Tab' ||
      e.key === 'Escape' ||
      e.key === 'Enter' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'Home' ||
      e.key === 'End' ||
      ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase()))
    ) {
      return
    }

    // Disallow anything other than digits and '.'
    if (!/^[0-9.]$/.test(e.key)) {
      e.preventDefault()
      return
    }

    const currentVal = e.currentTarget.value
    // Prevent second decimal point
    if (e.key === '.' && currentVal.includes('.')) {
      e.preventDefault()
      return
    }

    // Prevent more than 2 decimal places if inserting at the end of decimal part
    const selectionStart = e.currentTarget.selectionStart ?? currentVal.length
    const selectionEnd = e.currentTarget.selectionEnd ?? currentVal.length
    const isReplacing = selectionStart !== selectionEnd

    if (!isReplacing && currentVal.includes('.')) {
      const dotIndex = currentVal.indexOf('.')
      if (selectionStart > dotIndex && currentVal.length - dotIndex > 2) {
        e.preventDefault()
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const sanitized = sanitizePrice(text)
    if (!sanitized) return

    const input = e.currentTarget
    const start = input.selectionStart ?? 0
    const end = input.selectionEnd ?? 0
    const current = input.value
    const next = sanitizePrice(current.slice(0, start) + sanitized + current.slice(end))

    // Set value and trigger synthetic change
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, next)
      const event = new Event('input', { bubbles: true })
      input.dispatchEvent(event)
    }

    onValueChange?.(next)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const sanitized = sanitizePrice(e.target.value)
    if (sanitized !== e.target.value) {
      e.target.value = sanitized
    }
    onChange?.(e)
    onValueChange?.(sanitized)
  }

  return (
    <div
      className={`relative flex items-center bg-white border ${
        error
          ? 'border-rose-500 ring-1 ring-rose-500'
          : 'border-neutral-300 focus-within:border-neutral-900 focus-within:ring-1 focus-within:ring-neutral-900'
      } ${disabled ? 'bg-neutral-100 opacity-60 cursor-not-allowed' : ''} ${className}`}
    >
      {prefix && (
        <span className="pl-3 pr-1 text-sm font-medium text-neutral-400 select-none flex-shrink-0">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onChange={handleChange}
        className={`w-full py-2 ${
          prefix ? 'pl-1' : 'pl-3'
        } pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 bg-transparent focus:outline-none disabled:cursor-not-allowed ${inputClassName}`}
        {...props}
      />
    </div>
  )
}
