import { useState, useEffect, useRef, useCallback } from 'react'
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

  // Update selectedItem if initialSelectedItem changes
  useEffect(() => {
    if (initialSelectedItem !== undefined) {
      setSelectedItem(initialSelectedItem)
    }
  }, [initialSelectedItem])

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

  // Fetch items whenever page, debouncedSearch, or reloadTrigger changes (and when dropdown is opened)
  const loadData = useCallback(async () => {
    if (disabled) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetcher({
        page,
        pageSize: 10,
        search: debouncedSearch.trim(),
      })
      setItems(res.items || [])
      setTotal(res.total || 0)

      // If value is set but selectedItem is null, try finding it in current items
      if (value && !selectedItem) {
        const found = (res.items || []).find((i) => getItemValue(i) === value)
        if (found) {
          setSelectedItem(found)
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [disabled, fetcher, page, debouncedSearch, reloadTrigger, value, selectedItem, getItemValue])

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, loadData])

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
    const itemVal = getItemValue(item)
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
    selectedItem || items.find((i) => getItemValue(i) === value) || null

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-10 px-3 py-2 text-left bg-white border border-neutral-300 rounded-lg text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 flex items-center justify-between gap-2 shadow-2xs hover:bg-neutral-50/50 transition disabled:opacity-50 disabled:bg-neutral-100 disabled:cursor-not-allowed"
      >
        <div className="flex-1 min-w-0">
          {renderSelected ? (
            renderSelected(currentItem)
          ) : currentItem ? (
            <span className="truncate block font-medium">
              {getItemLabel(currentItem)}
            </span>
          ) : (
            <span className="text-neutral-400 select-none">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 text-neutral-400">
          {clearable && value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 transition"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-neutral-800' : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in-50 duration-100 flex flex-col max-h-80">
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
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-900 placeholder:text-neutral-400"
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
                const itemVal = getItemValue(item)
                const isSelected = itemVal === value

                return (
                  <div
                    key={itemVal}
                    onClick={() => handleSelect(item)}
                    className={`px-3 py-2.5 cursor-pointer hover:bg-neutral-50 flex items-center justify-between gap-3 transition ${
                      isSelected ? 'bg-neutral-100/70 font-semibold' : ''
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
                      <Check className="w-4 h-4 text-neutral-900 flex-shrink-0" />
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

