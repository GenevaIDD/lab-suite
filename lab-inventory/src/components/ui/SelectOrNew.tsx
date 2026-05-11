import { useState, useRef, useEffect } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface SelectOrNewProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  newPlaceholder?: string
  disabled?: boolean
}

/**
 * Dropdown of existing options with an inline "Add new" option.
 * Selecting "Add new" shows a text input. Confirming adds the value
 * to the list and selects it.
 */
export function SelectOrNew({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select or add new…',
  newPlaceholder = 'Type new value…',
  disabled,
}: SelectOrNewProps) {
  const [open, setOpen] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [newValue, setNewValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setAddingNew(false)
        setNewValue('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Focus input when "Add new" is shown
  useEffect(() => {
    if (addingNew) inputRef.current?.focus()
  }, [addingNew])

  function selectOption(option: string) {
    onChange(option)
    setOpen(false)
  }

  function confirmNew() {
    const trimmed = newValue.trim()
    if (!trimmed) return
    onChange(trimmed)
    setAddingNew(false)
    setNewValue('')
    setOpen(false)
  }

  function handleNewKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); confirmNew() }
    if (e.key === 'Escape') { setAddingNew(false); setNewValue('') }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setAddingNew(false) }}
        className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-background px-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value || placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md">
          {/* Existing options */}
          <div className="max-h-48 overflow-y-auto">
            {options.length === 0 && !addingNew && (
              <p className="py-2 px-3 text-xs text-muted-foreground">No existing options — add one below.</p>
            )}
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => selectOption(opt)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
              >
                <Check className={`h-3.5 w-3.5 shrink-0 ${value === opt ? 'opacity-100' : 'opacity-0'}`} />
                {opt}
              </button>
            ))}
          </div>

          {/* Add new section */}
          <div className="border-t">
            {addingNew ? (
              <div className="flex gap-1.5 p-2">
                <Input
                  ref={inputRef}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={handleNewKeyDown}
                  placeholder={newPlaceholder}
                  className="h-7 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={confirmNew}
                  disabled={!newValue.trim()}
                  className="h-7 px-2 shrink-0"
                >
                  Add
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingNew(true)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                Add new…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
