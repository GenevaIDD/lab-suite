import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import type { Equipment } from '@/types/database'

interface EquipmentComboboxProps {
  id?: string
  items: Equipment[]
  excludeIds?: string[]
  value: string | null
  onChange: (id: string) => void
  placeholder?: string
  loading?: boolean
  disabled?: boolean
}

export function EquipmentCombobox({
  id,
  items,
  excludeIds = [],
  value,
  onChange,
  placeholder = 'Rechercher un équipement…',
  loading = false,
  disabled = false,
}: EquipmentComboboxProps) {
  const [open, setOpen]         = useState(false)
  const [query, setQuery]       = useState('')
  const [highlighted, setHigh]  = useState(0)
  const [dropPos, setDropPos]   = useState({ top: 0, left: 0, width: 0 })

  const triggerRef  = useRef<HTMLButtonElement>(null)
  const inputRef    = useRef<HTMLInputElement>(null)
  const listRef     = useRef<HTMLUListElement>(null)

  const exclude = new Set(excludeIds)
  const candidates = items.filter(i => !exclude.has(i.id))
  const selected = candidates.find(i => i.id === value)

  const filtered = query.trim()
    ? candidates.filter(i =>
        i.name.toLowerCase().includes(query.toLowerCase()) ||
        i.category.toLowerCase().includes(query.toLowerCase())
      )
    : candidates

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width })
  }, [])

  function openDropdown() {
    updatePos()
    setOpen(true)
    setQuery('')
    setHigh(0)
    setTimeout(() => inputRef.current?.focus(), 10)
  }

  function closeDropdown() {
    setOpen(false)
    setQuery('')
  }

  function select(item: Equipment) {
    onChange(item.id)
    closeDropdown()
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const portal = document.getElementById('equipment-combobox-portal')
      if (triggerRef.current?.contains(e.target as Node)) return
      if (portal?.contains(e.target as Node)) return
      closeDropdown()
    }
    function handleScroll() { updatePos() }
    document.addEventListener('mousedown', handle)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handle)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open, updatePos])

  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[highlighted] as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHigh(h => Math.min(h + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHigh(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); if (filtered[highlighted]) select(filtered[highlighted]) }
    if (e.key === 'Escape')    { closeDropdown() }
  }

  const dropdown = open ? (
    <div
      id="equipment-combobox-portal"
      style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: Math.max(dropPos.width, 360), zIndex: 9999 }}
      className="rounded-lg border bg-popover shadow-md"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setHigh(0) }}
          onKeyDown={handleKeyDown}
          placeholder="Taper pour filtrer…"
          className="flex-1 text-sm bg-transparent outline-none"
        />
      </div>

      <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
        {loading ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">Chargement…</li>
        ) : filtered.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat.</li>
        ) : filtered.map((item, idx) => (
          <li
            key={item.id}
            onMouseDown={e => { e.preventDefault(); select(item) }}
            onMouseEnter={() => setHigh(idx)}
            className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${
              idx === highlighted ? 'bg-muted' : 'hover:bg-muted/50'
            }`}
          >
            <Check className={`h-3.5 w-3.5 shrink-0 ${value === item.id ? 'opacity-100 text-primary' : 'opacity-0'}`} />
            <div className="flex-1 min-w-0">
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground ml-2 text-xs">{item.category}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  ) : null

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled || loading}
        onClick={() => open ? closeDropdown() : openDropdown()}
        className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-background px-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        <span className={selected ? 'text-foreground truncate text-left' : 'text-muted-foreground'}>
          {loading ? 'Chargement…' : selected ? selected.name : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
      </button>
      {createPortal(dropdown, document.body)}
    </div>
  )
}
