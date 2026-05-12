import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, ClipboardList, Loader2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useItemTypes, useActiveSession } from '@/lib/queries'
import { useStartSession } from '@/lib/mutations'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function SessionStart() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: itemTypes = [], isLoading } = useItemTypes()
  const { data: activeSession } = useActiveSession()
  const startSession = useStartSession()

  const [targetDate, setTargetDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')

  async function handleStart() {
    if (activeSession) {
      toast.error('A session is already in progress. Resume or complete it before starting a new one.')
      navigate(`/inventory/session/${activeSession.id}`)
      return
    }
    if (itemTypes.length === 0) {
      toast.error('No items registered — add inventory items first.')
      return
    }
    try {
      const session = await startSession.mutateAsync({
        targetDate,
        startedBy: profile?.full_name ?? null,
        itemTypes: itemTypes.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category,
        })),
      })
      toast.success('Inventory session started')
      navigate(`/inventory/session/${session.id}`)
    } catch (err) {
      toast.error(`Failed to start session: ${(err as Error).message}`)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <Link to="/inventory" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Inventory
      </Link>

      <div>
        <h2 className="text-xl font-semibold">Start Inventory Count</h2>
        <p className="text-sm text-muted-foreground mt-1">
          A session will be created for all {isLoading ? '…' : itemTypes.length} registered items,
          sorted by category. You can print a blank count sheet, fill it in during the lab walk,
          then enter values here — or count directly on your phone.
        </p>
      </div>

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
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used for burn-rate projections and anomaly detection. Defaults to today.
            </p>
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
          <li>Click <strong>Start counting</strong> — a session is created with all items in category order.</li>
          <li>Click <strong>Print sheet</strong> (top of the next page) to get a blank count form for the lab walk.</li>
          <li>Walk the lab with the paper, write down quantities. Or count directly on your phone.</li>
          <li>Back at the computer, enter values one by one. You can pause and come back later.</li>
          <li>Complete the session — stock values update and you see a reconciliation report.</li>
        </ol>
      </div>

      <div className="flex gap-2 justify-end">
        <Link to="/inventory" className={cn(buttonVariants({ variant: 'outline' }))}>Cancel</Link>
        <Button onClick={handleStart} disabled={startSession.isPending || isLoading}>
          {startSession.isPending
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <ClipboardList className="h-4 w-4 mr-1" />}
          Start counting
        </Button>
      </div>
    </div>
  )
}
