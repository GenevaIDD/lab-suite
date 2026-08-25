import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { todayStr } from '@/lib/utils'
import { ArrowLeft, ClipboardList, Loader2, AlertTriangle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useItemTypes, useActiveSession, useAllSessions } from '@/lib/queries'
import { useStartSession } from '@/lib/mutations'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// Canonical category order matching lab's physical organisation
const CATEGORY_ORDER = [
  'Surveillance clinique',
  'Milieux et chimique',
  'Culture',
  'Consomables',
  'Articles',
  'EEP',
  'Transport',
  'Accessoires de machines',
  'Autres articles',
]

function sortCategories(cats: string[]): string[] {
  return [...cats].sort((a, b) => {
    const ai = CATEGORY_ORDER.findIndex((c) => c.toLowerCase() === a.toLowerCase())
    const bi = CATEGORY_ORDER.findIndex((c) => c.toLowerCase() === b.toLowerCase())
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b)
  })
}

export function SessionStart() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: itemTypes = [], isLoading } = useItemTypes()
  const { data: activeSession } = useActiveSession()
  const { data: allSessions = [] } = useAllSessions()
  const startSession = useStartSession()
  const { t } = useLang()

  const [confirmDup, setConfirmDup] = useState(false)

  const [targetDate, setTargetDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['__all__']))

  // Distinct categories from registered items, in canonical order
  const categories = useMemo(() => {
    const cats = [...new Set(itemTypes.map((i) => i.category))]
    return sortCategories(cats)
  }, [itemTypes])

  const allSelected = selectedCategories.has('__all__')

  function toggleAll() {
    setSelectedCategories(new Set(['__all__']))
  }

  function toggleCategory(cat: string) {
    const next = new Set(selectedCategories)
    next.delete('__all__')
    if (next.has(cat)) {
      next.delete(cat)
      if (next.size === 0) next.add('__all__') // fallback to all if nothing selected
    } else {
      next.add(cat)
    }
    setSelectedCategories(next)
  }

  const filteredItems = useMemo(() => {
    if (allSelected) return itemTypes
    return itemTypes.filter((i) => selectedCategories.has(i.category))
  }, [itemTypes, selectedCategories, allSelected])

  // A completed session for the same date means someone already counted this
  // day. Re-counting is allowed (a genuine recount happens), but it must be a
  // deliberate choice — silently redoing an hour of counting is the failure
  // this guards against.
  const duplicate = useMemo(
    () => allSessions.find((s) => s.status === 'completed' && s.target_date === targetDate) ?? null,
    [allSessions, targetDate],
  )

  async function handleStart() {
    if (activeSession) {
      toast.error('A session is already in progress. Resume or complete it before starting a new one.')
      navigate(`/inventory/session/${activeSession.id}`)
      return
    }
    if (filteredItems.length === 0) {
      toast.error('No items in the selected categories.')
      return
    }
    if (duplicate) {
      setConfirmDup(true)
      return
    }
    await doStart()
  }

  async function doStart() {
    setConfirmDup(false)
    try {
      const session = await startSession.mutateAsync({
        targetDate,
        startedBy: profile?.full_name ?? null,
        itemTypes: filteredItems.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          track_lots: i.track_lots,
        })),
      })
      toast.success('Inventory session started')
      navigate(`/inventory/session/${session.id}`)
    } catch (err) {
      toast.error(`Failed to start session: ${(err as Error).message}`)
    }
  }

  const scopeLabel = allSelected
    ? `All categories (${isLoading ? '…' : filteredItems.length} items)`
    : `${selectedCategories.size} category${selectedCategories.size > 1 ? 'ies' : ''} (${filteredItems.length} items)`

  return (
    <div className="space-y-6 max-w-lg">
      <Link to="/inventory" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Inventory
      </Link>

      <div>
        <h2 className="text-xl font-semibold">Start Inventory Count</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which categories to count, confirm the date, then print a blank sheet
          for the lab walk or count directly on your phone.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scope</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* All toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded"
                checked={allSelected}
                onChange={toggleAll}
              />
              <span className={cn('text-sm font-medium', allSelected && 'text-primary')}>
                All categories
              </span>
              {allSelected && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {filteredItems.length} items
                </span>
              )}
            </label>

            {/* Per-category toggles */}
            {categories.length > 0 && (
              <div className="border-t pt-2 space-y-1.5 pl-1">
                {categories.map((cat) => {
                  const count = itemTypes.filter((i) => i.category === cat).length
                  const checked = !allSelected && selectedCategories.has(cat)
                  return (
                    <label key={cat} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={checked}
                        onChange={() => toggleCategory(cat)}
                      />
                      <span className={cn('text-sm', checked && 'font-medium text-primary')}>
                        {cat}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {count} item{count !== 1 ? 's' : ''}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="date">Count date *</Label>
            <Input
              id="date"
              type="date"
              max={todayStr()}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used for burn-rate projections and anomaly detection. Defaults to today.
            </p>
            {duplicate && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex gap-2 mt-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-0.5">
                  <p>
                    {t('session.dup.warn')}
                    {duplicate.started_by ? ` — ${t('session.dup.by')} ${duplicate.started_by}` : ''}
                  </p>
                  <Link
                    to={`/inventory/session/${duplicate.id}/summary`}
                    className="font-medium underline underline-offset-2 hover:text-amber-900"
                  >
                    {t('session.dup.view')} →
                  </Link>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Monthly inventory — May 2026"
            />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm space-y-1">
        <p className="font-medium">How it works</p>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
          <li>Select categories, confirm date, click <strong>Start counting</strong>.</li>
          <li>Click <strong>Print sheet</strong> (top of the next page) for a blank count form.</li>
          <li>Walk the lab with the paper, write quantities. Or count directly on your phone.</li>
          <li>Enter values one by one. You can pause and come back later.</li>
          <li>Complete — stock values update and you see a reconciliation report.</li>
        </ol>
      </div>

      <div className="flex gap-2 justify-end items-center">
        <span className="text-xs text-muted-foreground mr-auto">{scopeLabel}</span>
        <Link to="/inventory" className={cn(buttonVariants({ variant: 'outline' }))}>Cancel</Link>
        <Button onClick={handleStart} disabled={startSession.isPending || isLoading}>
          {startSession.isPending
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <ClipboardList className="h-4 w-4 mr-1" />}
          Start counting
        </Button>
      </div>

      <Dialog open={confirmDup} onOpenChange={setConfirmDup}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('session.dup.title')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('session.dup.desc')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDup(false)}>
              {t('session.dup.cancel')}
            </Button>
            <Button onClick={doStart} disabled={startSession.isPending}>
              {startSession.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('session.dup.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
