import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

export interface DatePickerProps {
  value?: string // YYYY-MM-DD
  onChange: (date?: string) => void
  placeholder?: string
  minDate?: string
  maxDate?: string
  className?: string
  disabled?: boolean
  align?: 'left' | 'right'
}

function parseDateStr(str?: string): Date | null {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function formatDateStr(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatDisplayDate(str?: string): string {
  const d = parseDateStr(str)
  if (!d) return ''
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const DAYS_OF_WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  minDate,
  maxDate,
  className = '',
  disabled = false,
  align = 'left',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeDate = parseDateStr(value) || new Date()
  const [viewYear, setViewYear] = useState(activeDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(activeDate.getMonth())

  // Keep view aligned when value changes or opened
  useEffect(() => {
    if (value) {
      const parsed = parseDateStr(value)
      if (parsed) {
        setViewYear(parsed.getFullYear())
        setViewMonth(parsed.getMonth())
      }
    }
  }, [value, isOpen])

  // Dismiss on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
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

  // Year options: past 10 years to +2 years
  const yearOptions = useMemo(() => {
    const curYear = new Date().getFullYear()
    const years: number[] = []
    for (let y = curYear - 10; y <= curYear + 2; y++) {
      years.push(y)
    }
    return years
  }, [])

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const lastDay = new Date(viewYear, viewMonth + 1, 0)

    let startDayOfWeek = firstDay.getDay() - 1
    if (startDayOfWeek === -1) startDayOfWeek = 6

    const days: Array<{
      dateStr: string
      dayNum: number
      isCurrentMonth: boolean
      isDisabled: boolean
    }> = []

    // Previous month padding
    const prevMonthLastDate = new Date(viewYear, viewMonth, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDate - i
      const dateObj = new Date(viewYear, viewMonth - 1, d)
      const dateStr = formatDateStr(dateObj)
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isDisabled:
          (Boolean(minDate) && dateStr < minDate!) ||
          (Boolean(maxDate) && dateStr > maxDate!),
      })
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateObj = new Date(viewYear, viewMonth, d)
      const dateStr = formatDateStr(dateObj)
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isDisabled:
          (Boolean(minDate) && dateStr < minDate!) ||
          (Boolean(maxDate) && dateStr > maxDate!),
      })
    }

    // Next month padding
    const remaining = (7 - (days.length % 7)) % 7
    for (let d = 1; d <= remaining; d++) {
      const dateObj = new Date(viewYear, viewMonth + 1, d)
      const dateStr = formatDateStr(dateObj)
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isDisabled:
          (Boolean(minDate) && dateStr < minDate!) ||
          (Boolean(maxDate) && dateStr > maxDate!),
      })
    }

    return days
  }, [viewYear, viewMonth, minDate, maxDate])

  const handleSelect = (dateStr: string) => {
    onChange(dateStr)
    setIsOpen(false)
  }

  const todayStr = formatDateStr(new Date())

  // Core Calendar Component Content
  const calendarContent = (
    <div className="space-y-2.5">
      {/* Header with Month & Year Selectors */}
      <div className="flex items-center justify-between pb-1.5 border-b border-neutral-100 gap-1">
        <div className="flex items-center gap-1">
          {/* Month Selector */}
          <select
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="text-xs font-bold text-brand-charcoal bg-white border border-neutral-200 px-1 py-0.5 cursor-pointer focus:outline-hidden focus:border-brand-primary hover:border-brand-coral"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx}>
                {name}
              </option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="text-xs font-bold text-brand-charcoal bg-white border border-neutral-200 px-1 py-0.5 cursor-pointer focus:outline-hidden focus:border-brand-primary hover:border-brand-coral"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Previous & Next Month Navigation */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 border border-neutral-200 hover:bg-neutral-100 text-neutral-600 cursor-pointer"
            title="Previous month"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 border border-neutral-200 hover:bg-neutral-100 text-neutral-600 cursor-pointer"
            title="Next month"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 text-center">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="text-[10px] font-semibold text-neutral-400 py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs select-none">
        {calendarDays.map((cell) => {
          const isSelected = cell.dateStr === value
          const isToday = cell.dateStr === todayStr

          return (
            <button
              key={cell.dateStr}
              type="button"
              disabled={cell.isDisabled}
              onClick={() => handleSelect(cell.dateStr)}
              className={`h-7.5 sm:h-7 w-full flex items-center justify-center font-medium transition-colors cursor-pointer ${
                cell.isDisabled
                  ? 'opacity-25 cursor-not-allowed text-neutral-300'
                  : isSelected
                    ? 'bg-brand-primary text-white font-bold hover:bg-brand-dark'
                    : cell.isCurrentMonth
                      ? 'text-neutral-800 hover:bg-brand-bg/60'
                      : 'text-neutral-300 hover:bg-neutral-50'
              } ${isToday && !isSelected ? 'border border-brand-coral font-bold text-brand-primary' : ''}`}
            >
              {cell.dayNum}
            </button>
          )
        })}
      </div>

      {/* Quick Shortcuts */}
      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
        <button
          type="button"
          onClick={() => handleSelect(todayStr)}
          className="text-brand-primary hover:text-brand-dark font-medium cursor-pointer"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-neutral-500 hover:text-neutral-800 font-medium cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Input Display Button */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={(e) => !disabled && e.key === 'Enter' && setIsOpen((prev) => !prev)}
        className={`h-8 px-2.5 flex items-center justify-between gap-2 border bg-white text-xs cursor-pointer select-none transition-colors ${
          disabled
            ? 'opacity-60 cursor-not-allowed bg-neutral-100 border-neutral-200'
            : isOpen
              ? 'border-brand-primary ring-1 ring-brand-primary'
              : 'border-neutral-200 hover:border-brand-coral/60'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Calendar className="size-3.5 text-neutral-400 shrink-0" />
          <span className={value ? 'text-neutral-900 font-medium' : 'text-neutral-400'}>
            {value ? formatDisplayDate(value) : placeholder}
          </span>
        </div>
      </div>

      {/* Popover Calendar (Responsive: Centered modal on mobile, anchored dropdown on tablet/desktop) */}
      {isOpen && (
        <>
          {/* Mobile Overlay (< sm) */}
          <div
            className="fixed inset-0 bg-neutral-900/40 z-50 sm:hidden flex items-center justify-center p-4 backdrop-blur-2xs"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="w-full max-w-[280px] bg-white border border-neutral-300 p-3.5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {calendarContent}
            </div>
          </div>

          {/* Desktop/Tablet Anchored Dropdown (>= sm) */}
          <div
            className={`hidden sm:block absolute ${
              align === 'right' ? 'right-0' : 'left-0'
            } mt-1 z-50 w-64 bg-white border border-neutral-300 p-3 shadow-lg`}
          >
            {calendarContent}
          </div>
        </>
      )}
    </div>
  )
}
