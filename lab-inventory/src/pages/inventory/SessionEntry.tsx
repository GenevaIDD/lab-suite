import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft, ArrowRight, Pause, CheckCircle2, Printer,
  Loader2, SkipForward, List, ChevronRight,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { useSession, useSessionEntries } from '@/lib/queries'
import { useUpdateEntry, usePauseSession, useCompleteSession } from '@/lib/mutations'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function SessionEntry() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const { data: session, isLoading: loadingSession } = useSession(id)
  const { data: entries = [], isLoading: loadingEntries } = useSessionEntries(id)
  const updateEntry = useUpdateEntry()
  const pauseSession = usePauseSession()
  const completeSession = useCompleteSession()

  const [currentIdx, setCurrentIdx] = useState(0)
  const [value, setValue] = useState('')
  const [entryNotes, setEntryNotes] = useState('')
  const [showList, setShowList] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const current = entries[currentIdx]
  const entered = entries.filter((e) => e.counted_quantity !== null).length
  const skipped = entries.filter((e, i) => i < currentIdx && e.counted_quantity === null).length

  // Pre-fill value if entry already has a count (re-visiting)
  useEffect(() => {
    if (current) {
      setValue(current.counted_quantity !== null ? String(current.counted_quantity) : '')
      setEntryNotes(current.notes ?? '')
    }
  }, [currentIdx, current])

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [currentIdx])

  // Advance to first unentered item on load
  useEffect(() => {
    if (entries.length > 0) {
      const firstBlank = entries.findIndex((e) => e.counted_quantity === null)
      if (firstBlank > 0) setCurrentIdx(firstBlank)
    }
  }, [entries.length])

  async function saveCurrentAndAdvance(skip = false) {
    if (!current || !id) return
    if (!skip && value === '') {
      toast.error('Enter a quantity or skip this item')
      return
    }
    try {
      await updateEntry.mutateAsync({
        id: current.id,
        sessionId: id,
        countedQuantity: skip ? null : Number(value),
        enteredBy: profile?.full_name ?? null,
        notes: entryNotes || null,
      })
      if (currentIdx < entries.length - 1) {
        setCurrentIdx((i) => i + 1)
      } else {
        toast.success('All items reached — review and complete the session.')
      }
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`)
    }
  }

  async function handlePause() {
    if (!id) return
    try {
      await pauseSession.mutateAsync(id)
      toast.success('Session paused — you can resume from the Inventory page.')
      navigate('/inventory')
    } catch (err) {
      toast.error(`Pause failed: ${(err as Error).message}`)
    }
  }

  async function handleComplete() {
    if (!id || !session) return
    try {
      await completeSession.mutateAsync({
        sessionId: id,
        targetDate: session.target_date,
        entries: entries.map((e) => ({
          item_type_id: e.item_type_id,
          counted_quantity: e.counted_quantity,
          entered_by: e.entered_by,
          notes: e.notes,
        })),
      })
      toast.success('Inventory complete!')
      navigate(`/inventory/session/${id}/summary`)
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveCurrentAndAdvance() }
  }

  const loading = loadingSession || loadingEntries
  const allEntered = entries.length > 0 && entries.every((e) => e.counted_quantity !== null)
  const isCompleted = session?.status === 'completed'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session || entries.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground text-sm">
        Session not found.{' '}
        <Link to="/inventory" className="underline">Back to Inventory</Link>
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div className="text-center py-20 space-y-3">
        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
        <p className="font-medium">This session is complete.</p>
        <Link to={`/inventory/session/${id}/summary`} className={cn(buttonVariants({ variant: 'outline' }))}>
          View reconciliation summary
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">
            Count date: {format(parseISO(session.target_date), 'd MMM yyyy')}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-xs">
              {entered}/{entries.length} entered
            </Badge>
            {skipped > 0 && (
              <Badge variant="outline" className="text-xs">{skipped} skipped</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          <Link
            to={`/inventory/session/${id}/print`}
            target="_blank"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <Printer className="h-4 w-4 mr-1" />
            Print sheet
          </Link>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowList(!showList)}
            title="View all items"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${entries.length ? (entered / entries.length) * 100 : 0}%` }}
        />
      </div>

      {/* Item list view */}
      {showList && (
        <Card>
          <CardContent className="p-0 max-h-72 overflow-y-auto">
            {entries.map((entry, idx) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => { setCurrentIdx(idx); setShowList(false) }}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-0',
                  idx === currentIdx && 'bg-muted/50 font-medium',
                )}
              >
                <span className="truncate mr-2">
                  {idx + 1}. {entry.item_type?.name ?? '—'}
                </span>
                <span className="shrink-0 flex items-center gap-1">
                  {entry.counted_quantity !== null ? (
                    <Badge variant="outline" className="text-xs">
                      {entry.counted_quantity} {entry.item_type?.unit}
                    </Badge>
                  ) : idx === currentIdx ? (
                    <Badge className="text-xs bg-primary">Current</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main count card */}
      {!showList && current && (
        <Card className="border-primary/30">
          <CardContent className="pt-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {currentIdx + 1} of {entries.length} — {current.item_type?.category}
              </p>
              <h2 className="text-2xl font-bold mt-1">{current.item_type?.name}</h2>
            </div>

            <div className="space-y-1">
              <label htmlFor="qty" className="text-sm font-medium">
                Quantity counted ({current.item_type?.unit})
              </label>
              <Input
                ref={inputRef}
                id="qty"
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-2xl h-14 text-center font-mono"
                placeholder="0"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="entry-notes" className="text-xs text-muted-foreground">
                Notes (optional)
              </label>
              <Textarea
                id="entry-notes"
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                rows={2}
                placeholder="e.g. 2 boxes sealed, 1 opened"
                className="text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => saveCurrentAndAdvance(true)}
                disabled={updateEntry.isPending}
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Skip
              </Button>
              <Button
                className="flex-2"
                onClick={() => saveCurrentAndAdvance()}
                disabled={updateEntry.isPending || value === ''}
              >
                {updateEntry.isPending
                  ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  : <ArrowRight className="h-4 w-4 mr-1" />}
                Save & next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation prev/next */}
      {!showList && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <button
            type="button"
            className="flex items-center gap-1 hover:text-foreground disabled:opacity-30"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((i) => i - 1)}
          >
            <ArrowLeft className="h-3 w-3" /> Previous
          </button>
          <button
            type="button"
            className="flex items-center gap-1 hover:text-foreground disabled:opacity-30"
            disabled={currentIdx === entries.length - 1}
            onClick={() => setCurrentIdx((i) => i + 1)}
          >
            Next <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Add missing item */}
      <div className="text-center">
        <Link
          to="/inventory/new"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Item not in list? Add it →
        </Link>
      </div>

      {/* Bottom actions */}
      <div className="flex gap-2 pt-2 border-t">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handlePause}
          disabled={pauseSession.isPending}
        >
          {pauseSession.isPending
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <Pause className="h-4 w-4 mr-1" />}
          Pause
        </Button>
        <CompleteDialog
          enteredCount={entered}
          totalCount={entries.length}
          onConfirm={handleComplete}
          isPending={completeSession.isPending}
          allEntered={allEntered}
        />
      </div>
    </div>
  )
}

function CompleteDialog({
  enteredCount,
  totalCount,
  onConfirm,
  isPending,
  allEntered,
}: {
  enteredCount: number
  totalCount: number
  onConfirm: () => void
  isPending: boolean
  allEntered: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="flex-1" variant={allEntered ? 'default' : 'outline'}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Complete
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete inventory session?</DialogTitle>
        </DialogHeader>
        <div className="py-2 text-sm space-y-2">
          <p>
            <span className="font-medium">{enteredCount}</span> of{' '}
            <span className="font-medium">{totalCount}</span> items have been counted.
          </p>
          {!allEntered && (
            <p className="text-amber-600">
              {totalCount - enteredCount} items were skipped and will not update stock.
            </p>
          )}
          <p className="text-muted-foreground">
            This will create stock count records for all entered values and show a reconciliation report.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onConfirm(); setOpen(false) }} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Complete session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
