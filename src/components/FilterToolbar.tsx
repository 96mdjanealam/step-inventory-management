import React, { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

export interface FilterToolbarProps {
  children: React.ReactNode
  className?: string
}

/**
 * Standardized container for search and filter controls above tables and list views.
 * Arranges all controls horizontally in a space-efficient row with consistent spacing.
 */
export function FilterToolbar({ children, className = '' }: FilterToolbarProps) {
  return (
    <div
      className={`bg-white p-3 sm:p-3.5 border border-neutral-200 shadow-2xs mb-4 flex flex-wrap items-center gap-3 ${className}`}
    >
      {children}
    </div>
  )
}

export interface FilterToolbarRightProps {
  children: React.ReactNode
  className?: string
}

/**
 * Aligns secondary filters and controls to the right side of the toolbar on desktop,
 * while wrapping naturally on smaller screens.
 */
export function FilterToolbarRight({
  children,
  className = '',
}: FilterToolbarRightProps) {
  return (
    <div
      className={`sm:ml-auto flex flex-wrap items-center gap-3 w-full sm:w-auto ${className}`}
    >
      {children}
    </div>
  )
}

FilterToolbar.Right = FilterToolbarRight

export interface SearchInputProps {
  defaultValue?: string
  value?: string
  placeholder?: string
  onSearch: (query: string) => void
  onClear?: () => void
  className?: string
  inputClassName?: string
  name?: string
  disabled?: boolean
  showSubmitButton?: boolean
  submitButtonText?: string
  debounceMs?: number
}

/**
 * Reusable standardized search bar with icon, clear action, and optional debounce / submit button.
 * Maintains a controlled appropriate width so it does not greedily consume horizontal space.
 */
export function SearchInput({
  defaultValue = '',
  value,
  placeholder = 'Search...',
  onSearch,
  onClear,
  className = 'w-full sm:w-80 md:w-96',
  inputClassName = '',
  name = 'search',
  disabled = false,
  showSubmitButton,
  submitButtonText = 'Search',
  debounceMs,
}: SearchInputProps) {
  const [query, setQuery] = useState(value !== undefined ? value : defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)
  const isFirstRender = useRef(true)
  const lastSearchedRef = useRef(value !== undefined ? value : defaultValue)

  // Default showSubmitButton to false if debouncing is active, otherwise true
  const shouldShowButton =
    showSubmitButton !== undefined ? showSubmitButton : !debounceMs

  useEffect(() => {
    if (value !== undefined) {
      setQuery(value)
      lastSearchedRef.current = value
    } else if (defaultValue !== undefined && isFirstRender.current) {
      setQuery(defaultValue)
      lastSearchedRef.current = defaultValue
    }
  }, [value, defaultValue])

  // Debounced search trigger
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (debounceMs && debounceMs > 0) {
      const timer = setTimeout(() => {
        if (query.trim() !== lastSearchedRef.current) {
          lastSearchedRef.current = query.trim()
          onSearch(query.trim())
        }
      }, debounceMs)
      return () => clearTimeout(timer)
    }
  }, [query, debounceMs, onSearch])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    lastSearchedRef.current = query.trim()
    onSearch(query.trim())
  }

  function handleClear() {
    setQuery('')
    lastSearchedRef.current = ''
    if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.focus()
    }
    if (onClear) {
      onClear()
    } else {
      onSearch('')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex items-center gap-2 ${className}`}
    >
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          name={name}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full h-10 pl-9 pr-8 border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition shadow-2xs disabled:bg-neutral-100 disabled:cursor-not-allowed ${inputClassName}`}
        />
        {query && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {shouldShowButton && (
        <button
          type="submit"
          disabled={disabled}
          className="h-10 px-3.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium transition cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
        >
          {submitButtonText}
        </button>
      )}
    </form>
  )
}
