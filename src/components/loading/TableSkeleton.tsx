import { Skeleton } from './Skeleton.tsx'

interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
  className?: string
}

/**
 * Reusable table skeleton loader matching TableCard dimensions and zero-border-radius design.
 */
export function TableSkeleton({
  rows = 6,
  columns = 6,
  showHeader = true,
  className = '',
}: TableSkeletonProps) {
  const widthClasses = ['w-20', 'w-32', 'w-44', 'w-24', 'w-36', 'w-28', 'w-16']

  return (
    <div className={`overflow-x-auto border border-neutral-200 bg-white ${className}`}>
      <table className="w-full text-left text-sm border-collapse">
        {showHeader && (
          <thead className="bg-neutral-50/75 border-b border-neutral-200">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="py-3 px-4">
                  <Skeleton className={`h-3.5 ${widthClasses[i % widthClasses.length]}`} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-neutral-200">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="bg-white">
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} className="py-3.5 px-4">
                  <Skeleton
                    className={`h-4 ${
                      colIdx === 0
                        ? 'w-24'
                        : colIdx === 1
                          ? 'w-36'
                          : colIdx === columns - 1
                            ? 'w-16 ml-auto'
                            : widthClasses[(rowIdx + colIdx) % widthClasses.length]
                    }`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

