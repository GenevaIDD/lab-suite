import { useParams, Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSession, useSessionEntries } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export function SessionSummary() {
  const { id } = useParams<{ id: string }>()
  const { data: session, isLoading: loadingSession } = useSession(id)
  const { data: entries = [], isLoading: loadingEntries } = useSessionEntries(id)

  if (loadingSession || loadingEntries) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) return null

  const entered = entries.filter((e) => e.counted_quantity !== null)
  const skipped = entries.filter((e) => e.counted_quantity === null)

  // Note: at time of summary, current_stock already reflects the session counts
  // So we compare: counted_quantity vs what was expected (no longer accessible)
  // Instead, flag large outliers as potential anomalies for review

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/inventory" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Inventory
      </Link>

      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
        <div>
          <h2 className="text-xl font-semibold">Inventory Complete</h2>
          <p className="text-sm text-muted-foreground">
            Count date: {format(parseISO(session.target_date), 'd MMMM yyyy')} ·{' '}
            {entered.length} of {entries.length} items counted
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Items counted" value={entered.length} />
        <StatCard label="Items skipped" value={skipped.length} warn={skipped.length > 0} />
        <StatCard label="Total items" value={entries.length} />
      </div>

      {/* Skipped items */}
      {skipped.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Skipped items — not updated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {skipped.map((e) => (
                <li key={e.id} className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  {e.item_type?.name} ({e.item_type?.category})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Count results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Count results</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Counted</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.item_type?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{e.item_type?.category}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {e.counted_quantity}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.item_type?.unit}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{e.notes ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Stock levels in the app have been updated to reflect this count.
        Deliveries received after {format(parseISO(session.target_date), 'd MMM yyyy')} will be added on top.
      </div>
    </div>
  )
}

function StatCard({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className={cn('text-2xl font-bold', warn && value > 0 ? 'text-amber-600' : '')}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  )
}
