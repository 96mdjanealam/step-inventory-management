import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, X, Loader2, Check } from 'lucide-react'
import { DropdownPagination } from './DropdownPagination.tsx'

export interface PaginatedSelectProps<T> {
  value: string | null | undefined
  onChange: (value: string, item: T | null) => void
  fetcher: (params: {
    page: number
    pageSize: number
    search: string
  }) => Promise<{ items: T[]; total: number }>
  getItemValue: (item: T) => string
  getItemLabel: (item: T) => string
  renderItem?: (item: T, isSelected: boolean) => React.ReactNode
  renderSelected?: (selectedItem: T | null) => React.ReactNode
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  reloadTrigger?: unknown
  initialSelectedItem?: T | null
  clearable?: boolean
}

export function PaginatedSelect<T>({
  value,
  onChange,
  fetcher,
  getItemValue,
  getItemLabel,
  renderItem,
  renderSelected,
  placeholder = '-- Select an option --',
  searchPlaceholder = 'Search...',
  disabled = false,
  className = '',
  reloadTrigger,
  initialSelectedItem = null,
  clearable = false,
}: PaginatedSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<T | null>(initialSelectedItem)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const getItemValueRef = useRef(getItemValue)
  getItemValueRef.current = getItemValue

  // Update selectedItem if initialSelectedItem changes
  useEffect(() => {
    if (initialSelectedItem !== undefined) {
      setSelectedItem(initialSelectedItem)
    }
  }, [initialSelectedItem])

  // Sync selectedItem if value is cleared from outside
  useEffect(() => {
    if (!value) {
      setSelectedItem(null)
    }
  }, [value])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  // Reset page when reloadTrigger changes
  useEffect(() => {
    setPage(1)
    setSearch('')
    setDebouncedSearch('')
  }, [reloadTrigger])

  // Fetch items whenever dropdown is open and page, debouncedSearch, or reloadTrigger changes
  useEffect(() => {
    if (!isOpen || disabled) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetcherRef
      .current({
        page,
        pageSize: 10,
        search: debouncedSearch.trim(),
      })
      .then((res) => {
        if (cancelled) return
        const loadedItems = res.items || []
        setItems(loadedItems)
        setTotal(res.total || 0)

        // If value is set, find the item to ensure selectedItem label is available
        if (value) {
          const found = loadedItems.find(
            (i) => getItemValueRef.current(i) === value,
          )
          if (found) {
            setSelectedItem(found)
          }
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load data')
        setItems([])
        setTotal(0)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, disabled, page, debouncedSearch, reloadTrigger, value])

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  // Close on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  function handleSelect(item: T) {
    const itemVal = getItemValueRef.current(item)
    setSelectedItem(item)
    onChange(itemVal, item)
    setIsOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedItem(null)
    onChange('', null)
  }

  // Find if currently selected item is in the loaded page
  const currentItem =
    selectedItem ||
    items.find((i) => getItemValueRef.current(i) === value) ||
    null

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen)
        }}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault()
            setIsOpen(true)
          }
        }}
        className={`w-full min-h-10 px-3 py-2 text-left bg-white border border-neutral-300 text-sm text-brand-charcoal focus:outline-none focus:border-brand-primary flex items-center justify-between gap-2 shadow-2xs hover:bg-neutral-50/50 transition cursor-pointer select-none ${
          disabled ? 'opacity-50 bg-neutral-100 cursor-not-allowed' : ''
        }`}
      >
        <div className="flex-1 min-w-0">
          {currentItem ? (
            renderSelected ? (
              renderSelected(currentItem)
            ) : (
              <span className="truncate block font-medium">
                {getItemLabel(currentItem)}
              </span>
            )
          ) : (
            renderSelected?.(null) || (
              <span className="text-neutral-400 select-none">{placeholder}</span>
            )
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 text-neutral-400">
          {clearable && value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 transition"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-brand-primary' : ''
            }`}
          />
        </div>
      </div>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 shadow-lg overflow-hidden animate-in fade-in-50 duration-100 flex flex-col max-h-80">
          {/* Search Box */}
          <div className="p-2 border-b border-neutral-100 bg-neutral-50/50">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-neutral-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-neutral-200 focus:outline-none focus:border-brand-primary placeholder:text-neutral-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List of items */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-50 text-sm">
            {loading && items.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-xs text-neutral-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
                <span>Loading options...</span>
              </div>
            ) : error ? (
              <div className="p-4 text-xs text-center text-rose-600 bg-rose-50/50">
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                No results found.
              </div>
            ) : (
              items.map((item) => {
                const itemVal = getItemValueRef.current(item)
                const isSelected = itemVal === value

                return (
                  <div
                    key={itemVal}
                    onClick={() => handleSelect(item)}
                    className={`px-3 py-2.5 cursor-pointer hover:bg-brand-bg/40 flex items-center justify-between gap-3 transition ${
                      isSelected ? 'bg-brand-bg/70 font-semibold text-brand-primary' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      {renderItem ? (
                        renderItem(item, isSelected)
                      ) : (
                        <div className="truncate text-neutral-800">
                          {getItemLabel(item)}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-brand-primary flex-shrink-0" />
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Embedded DropdownPagination (Fixed at 10 items per page) */}
          <DropdownPagination
            page={page}
            total={total}
            pageSize={10}
            onPageChange={(newPage) => setPage(newPage)}
            loading={loading}
          />
        </div>
      )}
    </div>
  )
}

