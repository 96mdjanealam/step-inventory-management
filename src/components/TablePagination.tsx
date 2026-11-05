import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface TablePaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (newPage: number) => void
  onPageSizeChange?: (newPageSize: number) => void
  pageSizeOptions?: number[]
  className?: string
  disabled?: boolean
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
  disabled = false,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(total, page * pageSize)

  // Generate page numbers with ellipsis
  function getPageNumbers(): (number | string)[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    if (page <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages]
    }

    if (page >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    return [1, '...', page - 1, page, page + 1, '...', totalPages]
  }

  const pageNumbers = getPageNumbers()

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1 text-sm text-neutral-600 ${className}`}
    >
      {/* Left: Results summary & Page size selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing <strong className="font-semibold text-brand-charcoal">{startItem}</strong> to{' '}
          <strong className="font-semibold text-brand-charcoal">{endItem}</strong> of{' '}
          <strong className="font-semibold text-brand-charcoal">{total}</strong> results
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const nextSize = Number(e.target.value)
                onPageSizeChange(nextSize)
                onPageChange(1)
              }}
              disabled={disabled}
              className="border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-800 focus:border-brand-primary focus:outline-none disabled:opacity-50"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span>per page</span>
          </div>
        )}
      </div>

      {/* Right: Page navigation buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || disabled}
          className="inline-flex items-center justify-center p-1.5 border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-xs text-neutral-400 select-none"
                >
                  ...
                </span>
              )
            }

            const pageNum = p as number
            const isActive = pageNum === page

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                disabled={disabled}
                className={`min-w-8 h-8 px-2 flex items-center justify-center text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-brand-primary text-white font-semibold shadow-xs'
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-brand-charcoal'
                } disabled:opacity-50`}
              >
                {pageNum}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || disabled}
          className="inline-flex items-center justify-center p-1.5 border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

