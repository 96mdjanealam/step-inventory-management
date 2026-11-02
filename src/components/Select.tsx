import React, {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: React.ReactNode
}

export interface SelectProps {
  value?: string
  defaultValue?: string
  onChange?: (event: React.ChangeEvent<HTMLSelectElement> | any) => void
  options?: SelectOption[]
  children?: React.ReactNode
  name?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  sizeVariant?: 'sm' | 'md'
  id?: string
  required?: boolean
}

/**
 * Standardized custom dropdown with the exact same visual styling, popover design,
 * active states, and checkmark indicators as PaginatedSelect, tailored for simple
 * static and enum selections without pagination or search.
 */
export const Select = forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onChange,
      options,
      children,
      name,
      placeholder = '-- Select --',
      disabled = false,
      className = '',
      sizeVariant = 'md',
      id,
      required = false,
    },
    ref,
  ) => {
    // Parse options from either `options` prop or `<option>` children
    const parsedOptions: SelectOption[] = []
    if (options && options.length > 0) {
      parsedOptions.push(...options)
    } else if (children) {
      Children.toArray(children).forEach((child) => {
        if (isValidElement<{ value?: any; children?: React.ReactNode }>(child)) {
          const val =
            child.props.value !== undefined ? String(child.props.value) : ''
          const lbl = child.props.children ?? val
          parsedOptions.push({ value: val, label: lbl })
        }
      })
    }

    const isControlled = controlledValue !== undefined
    const [internalValue, setInternalValue] = useState<string>(
      isControlled
        ? controlledValue
        : defaultValue !== undefined
          ? defaultValue
          : parsedOptions[0]?.value ?? '',
    )

    const currentValue = isControlled ? controlledValue : internalValue
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Sync controlled value changes
    useEffect(() => {
      if (isControlled) {
        setInternalValue(controlledValue)
      }
    }, [isControlled, controlledValue])

    // Close on outside click or Escape key
    useEffect(() => {
      function handleClickOutside(e: MouseEvent) {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
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

    function handleSelect(nextVal: string) {
      if (!isControlled) {
        setInternalValue(nextVal)
      }
      setIsOpen(false)

      if (onChange) {
        // Create synthetic event compatible with HTML select change handlers
        const syntheticEvent = {
          target: { value: nextVal, name: name || '' },
          currentTarget: { value: nextVal, name: name || '' },
        } as unknown as React.ChangeEvent<HTMLSelectElement>
        onChange(syntheticEvent)
      }
    }

    const selectedOption = parsedOptions.find(
      (opt) => opt.value === currentValue,
    )

    const isSm = sizeVariant === 'sm'

    return (
      <div
        ref={containerRef}
        className={`relative inline-block ${className}`}
        id={id}
      >
        {/* Hidden input for form submission */}
        {name && (
          <input
            type="hidden"
            name={name}
            value={currentValue}
            required={required}
          />
        )}

        {/* Trigger Button styled identically to PaginatedSelect */}
        <button
          ref={ref as any}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full text-left bg-white border border-neutral-300 text-neutral-900 focus:outline-none focus:border-neutral-900 flex items-center justify-between gap-2 shadow-2xs hover:bg-neutral-50/50 transition cursor-pointer disabled:opacity-50 disabled:bg-neutral-100 disabled:cursor-not-allowed ${
            isSm ? 'min-h-8 px-2.5 py-1 text-xs' : 'min-h-10 px-3 py-2 text-sm'
          }`}
        >
          <span className="truncate block font-medium flex-1 min-w-0">
            {selectedOption ? (
              selectedOption.label
            ) : (
              <span className="text-neutral-400 select-none">
                {placeholder}
              </span>
            )}
          </span>

          <ChevronDown
            className={`transition-transform duration-150 text-neutral-400 flex-shrink-0 ${
              isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'
            } ${isOpen ? 'rotate-180 text-neutral-800' : ''}`}
          />
        </button>

        {/* Popover Dropdown Menu styled identically to PaginatedSelect */}
        {isOpen && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 min-w-[140px] bg-white border border-neutral-200 shadow-lg overflow-hidden animate-in fade-in-50 duration-100 flex flex-col max-h-60">
            <div className="overflow-y-auto divide-y divide-neutral-50 py-1">
              {parsedOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-neutral-400">
                  No options available
                </div>
              ) : (
                parsedOptions.map((opt) => {
                  const isSelected = opt.value === currentValue

                  return (
                    <div
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
                      className={`cursor-pointer hover:bg-neutral-50 flex items-center justify-between gap-3 transition ${
                        isSm ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
                      } ${
                        isSelected
                          ? 'bg-neutral-100/70 font-semibold text-neutral-900'
                          : 'text-neutral-700'
                      }`}
                    >
                      <span className="truncate flex-1">{opt.label}</span>
                      {isSelected && (
                        <Check
                          className={`${
                            isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'
                          } text-neutral-900 flex-shrink-0`}
                        />
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    )
  },
)

Select.displayName = 'Select'
