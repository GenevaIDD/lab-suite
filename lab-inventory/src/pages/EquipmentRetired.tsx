import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, ArchiveX, Loader2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useEquipmentList } from '@/lib/queries'
import { cn } from '@/lib/utils'

export function EquipmentRetired() {
  const { data: equipment = [], isLoading } = useEquipmentList(true)
  const retired = equipment.filter(e => e.retired_at)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Link to="/equipment" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour aux équipements
        </Link>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Équipements retirés</h2>
        <p className="text-sm text-muted-foreground mt-1">{retired.length} équipement{retired.length !== 1 ? 's' : ''} retiré{retired.length !== 1 ? 's' : ''}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Date de retrait</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Destinataire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
              ) : retired.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                      <ArchiveX className="h-8 w-8 opacity-30" />
                      <p className="text-sm">Aucun équipement retiré.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                retired.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link to={`/equipment/${e.id}`} className="font-medium hover:underline">{e.name}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.category}</TableCell>
                    <TableCell className="text-muted-foreground">{e.retired_at ? format(parseISO(e.retired_at), 'd MMM yyyy') : '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{e.retirement_destination ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{e.retirement_recipient ?? '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
