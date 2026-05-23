import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, ClipboardList, Loader2, CheckCircle2, Pause, XCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAllSessions, useSessionEntries } from '@/lib/queries'
import { cn } from '@/lib/utils'
import type { InventorySession } from '@/types/database'

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed')
    return <Badge variant="outline" className="gap-1 text-xs text-green-600 border-green-200"><CheckCircle2 className="h-3 w-3" />Terminé</Badge>
  if (status === 'paused')
    return <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-200"><Pause className="h-3 w-3" />En pause</Badge>
  if (status === 'in_progress')
    return <Badge className="gap-1 text-xs bg-primary"><ClipboardList className="h-3 w-3" />En cours</Badge>
  return <Badge variant="secondary" className="gap-1 text-xs text-muted-foreground"><XCircle className="h-3 w-3" />Annulé</Badge>
}

function SessionRow({ session }: { session: InventorySession }) {
  const { data: entries = [] } = useSessionEntries(session.id)
  const counted = entries.filter(e => e.counted_quantity !== null).length
  const total   = entries.length
  const skipped = total - counted

  const isActive = session.status === 'in_progress' || session.status === 'paused'

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="font-medium">
        {format(parseISO(session.target_date), 'd MMM yyyy')}
      </TableCell>
      <TableCell><StatusBadge status={session.status} /></TableCell>
      <TableCell className="text-muted-foreground">{session.started_by ?? '—'}</TableCell>
      <TableCell className="tabular-nums text-right">
        {total > 0 ? (
          <span>
            <span className="font-medium">{counted}</span>
            <span className="text-muted-foreground">/{total}</span>
            {skipped > 0 && <span className="text-amber-600 ml-1 text-xs">({skipped} passé{skipped > 1 ? 's' : ''})</span>}
          </span>
        ) : '—'}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {session.completed_at
          ? format(parseISO(session.completed_at), 'd MMM yyyy HH:mm')
          : session.paused_at
          ? `Mis en pause ${format(parseISO(session.paused_at), 'd MMM')}`
          : '—'}
      </TableCell>
      <TableCell>
        <Link
          to={isActive
            ? `/inventory/session/${session.id}`
            : `/inventory/session/${session.id}/summary`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          {isActive ? 'Reprendre' : 'Voir'}
        </Link>
      </TableCell>
    </TableRow>
  )
}

export function SessionHistory() {
  const { data: sessions = [], isLoading } = useAllSessions()

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <Link to="/inventory" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour à l'inventaire
        </Link>
        <Link to="/inventory/session/new" className={cn(buttonVariants({ size: 'sm' }))}>
          <ClipboardList className="h-4 w-4 mr-1" />
          Nouvel inventaire
        </Link>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Historique des inventaires</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} au total
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <ClipboardList className="h-8 w-8 opacity-30" />
              <p className="text-sm">Aucune session d'inventaire.</p>
              <Link to="/inventory/session/new" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                Démarrer le premier inventaire
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date de comptage</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Par</TableHead>
                  <TableHead className="text-right">Articles comptés</TableHead>
                  <TableHead>Terminé le</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map(s => <SessionRow key={s.id} session={s} />)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
