import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

export interface DropdownPaginationProps {
  page: number
  total: number
  pageSize?: number
  onPageChange: (newPage: number) => void
  loading?: boolean
  className?: string
}

export function DropdownPagination({
  page,
  total,
  pageSize = 10,
  onPageChange,
  loading = false,
  className = '',
}: DropdownPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(total, page * pageSize)

  if (totalPages <= 1 && !loading) {
    return null
  }

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 border-t border-neutral-100 bg-neutral-50/70 text-xs text-neutral-500 select-none ${className}`}
    >
      <div className="flex items-center gap-2">
        {loading ? (
          <span className="inline-flex items-center gap-1.5 text-neutral-400">
            <Loader2 className="w-3 h-3 animate-spin text-neutral-500" />
            Loading...
          </span>
        ) : (
          <span>
            {startItem}-{endItem} of <strong className="font-semibold text-neutral-700">{total}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <span className="text-[11px] text-neutral-400 mr-1">
          Pg {page}/{totalPages}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onPageChange(Math.max(1, page - 1))
          }}
          disabled={page <= 1 || loading}
          className="p-1 rounded hover:bg-neutral-200/70 disabled:opacity-30 disabled:hover:bg-transparent text-neutral-700 transition"
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onPageChange(Math.min(totalPages, page + 1))
          }}
          disabled={page >= totalPages || loading}
          className="p-1 rounded hover:bg-neutral-200/70 disabled:opacity-30 disabled:hover:bg-transparent text-neutral-700 transition"
          title="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

