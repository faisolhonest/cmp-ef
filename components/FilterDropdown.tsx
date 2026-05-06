'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export type FilterDropdownOption = {
  value: string
  label: string
  dotClassName?: string
}

export default function FilterDropdown({
  icon,
  label,
  value,
  onChange,
  options,
  className = '',
  menuAlign = 'left',
}: {
  icon?: ReactNode
  label: string
  value: string
  onChange: (value: string) => void
  options: FilterDropdownOption[]
  className?: string
  menuAlign?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value]
  )

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`filter-dropdown ${className}`}>
      <button
        type="button"
        className="filter-dropdown-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {icon && <span className="planner-filter-icon">{icon}</span>}
        <span className="filter-dropdown-copy">
          <span className="filter-dropdown-label">{label}</span>
          <span className="filter-dropdown-value">
            {selectedOption?.dotClassName && <span className={`filter-option-dot ${selectedOption.dotClassName}`} />}
            <span>{selectedOption?.label}</span>
          </span>
        </span>
        <svg viewBox="0 0 24 24" className={`filter-dropdown-chevron ${open ? 'filter-dropdown-chevron-open' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div className={`filter-dropdown-menu filter-dropdown-menu-${menuAlign}`} role="listbox" aria-label={label}>
          {options.map((option) => {
            const selected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={`filter-dropdown-option ${selected ? 'filter-dropdown-option-selected' : ''}`}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <span className="filter-dropdown-option-main">
                  {option.dotClassName && <span className={`filter-option-dot ${option.dotClassName}`} />}
                  <span>{option.label}</span>
                </span>
                {selected && (
                  <svg viewBox="0 0 20 20" className="filter-dropdown-check" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="m5 10 3 3 7-7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
