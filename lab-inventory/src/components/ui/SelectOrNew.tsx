import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useLang } from '@/lib/i18n'

interface SelectOrNewProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  newPlaceholder?: string
  disabled?: boolean
}

export function SelectOrNew({
  id,
  value,
  onChange,
  options,
  placeholder,
  newPlaceholder,
  disabled,
}: SelectOrNewProps) {
  const { t } = useLang()
  const [open, setOpen]           = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [newValue, setNewValue]   = useState('')
  const [dropPos, setDropPos]     = useState({ top: 0, left: 0, width: 0 })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const portalRef  = useRef<HTMLDivElement>(null)
  // Latest values so the (stable) close handler can commit a pending new value.
  const stateRef   = useRef({ addingNew, newValue })
  stateRef.current = { addingNew, newValue }

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width })
  }, [])

  const commitPending = useCallback(() => {
    const { addingNew: a, newValue: nv } = stateRef.current
    if (a && nv.trim()) onChange(nv.trim())
  }, [onChange])

  const close = useCallback(() => {
    commitPending()
    setOpen(false); setAddingNew(false); setNewValue('')
  }, [commitPending])

  // Close on outside click (commits any typed-but-unconfirmed new value first)
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (portalRef.current?.contains(target)) return
      close()
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [open, updatePos, close])

  useEffect(() => { if (addingNew) inputRef.current?.focus() }, [addingNew])

  function toggle() {
    if (open) { close(); return }
    updatePos()
    setOpen(true)
    setAddingNew(false)
  }

  function selectOption(opt: string) { onChange(opt); setOpen(false); setAddingNew(false); setNewValue('') }

  function confirmNew() {
    const trimmed = newValue.trim()
    if (!trimmed) return
    onChange(trimmed); setAddingNew(false); setNewValue(''); setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); confirmNew() }
    if (e.key === 'Escape') { setAddingNew(false); setNewValue('') }
  }

  const dropdown = open ? (
    <div
      ref={portalRef}
      style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
      className="rounded-lg border bg-popover shadow-md"
    >
      <div className="max-h-60 overflow-y-auto">
        {options.length === 0 && !addingNew && (
          <p className="py-2 px-3 text-xs text-muted-foreground">{t('son.empty')}</p>
        )}
        {options.map(opt => (
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
      <div className="border-t">
        {addingNew ? (
          <div className="flex gap-1.5 p-2">
            <Input
              ref={inputRef}
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={newPlaceholder ?? t('son.new.placeholder')}
              className="h-7 text-sm"
            />
            <Button type="button" size="sm" onClick={confirmNew}
              disabled={!newValue.trim()} className="h-7 px-2 shrink-0">
              {t('action.add')}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingNew(true)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('son.add.reveal')}
          </button>
        )}
      </div>
    </div>
  ) : null

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={toggle}
        className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-background px-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground truncate'}>
          {value || placeholder || t('itemform.select.ph')}
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
      </button>
      {createPortal(dropdown, document.body)}
    </div>
  )
}
