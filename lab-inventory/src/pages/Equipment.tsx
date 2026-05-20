import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, differenceInDays, parseISO } from 'date-fns'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Search, Wrench, AlertTriangle, Clock, Loader2, ArchiveX } from 'lucide-react'
import { useEquipmentList, useMaintenanceSchedules } from '@/lib/queries'
import { cn } from '@/lib/utils'
import type { MaintenanceSchedule } from '@/types/database'

export function Equipment() {
  const [search, setSearch] = useState('')
  const { data: equipment = [], isLoading, error } = useEquipmentList()
  const { data: schedules = [] } = useMaintenanceSchedules()

  const schedulesByEquipment = useMemo(() => {
    const map = new Map<string, MaintenanceSchedule[]>()
    for (const s of schedules) {
      const arr = map.get(s.equipment_id) ?? []
      arr.push(s)
      map.set(s.equipment_id, arr)
    }
    return map
  }, [schedules])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return equipment.filter(
      (e) => !q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q),
    )
  }, [equipment, search])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un équipement..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link to="/equipment/retired" className={cn(buttonVariants({ variant: 'outline' }))}>
          <ArchiveX className="h-4 w-4 mr-1" />
          Retirés
        </Link>
        <Link to="/equipment/new" className={cn(buttonVariants())}>
          <Plus className="h-4 w-4 mr-1" />
          Ajouter équipement
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Prochaine maintenance</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    Impossible de charger les équipements — vérifier la configuration Supabase.
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                      <Wrench className="h-8 w-8 opacity-30" />
                      <p className="text-sm">
                        {search ? 'Aucun équipement ne correspond à la recherche.' : 'Aucun équipement enregistré.'}
                      </p>
                      {!search && (
                        <Link to="/equipment/new" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                          Ajouter le premier équipement
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => {
                  const eqSchedules = schedulesByEquipment.get(e.id) ?? []
                  const next = eqSchedules
                    .map((s) => ({ s, days: differenceInDays(parseISO(s.next_due), new Date()) }))
                    .sort((a, b) => a.days - b.days)[0]
                  return (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/40">
                      <TableCell>
                        <Link to={`/equipment/${e.id}`} className="font-medium hover:underline">
                          {e.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.category}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {next ? `${next.s.label} · ${format(parseISO(next.s.next_due), 'd MMM yyyy')}` : '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge schedule={next?.s} days={next?.days} />
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground flex gap-2 items-center">
        Légende :
        <Badge variant="destructive" className="text-xs">En retard</Badge>
        <Badge className="text-xs bg-amber-500">Bientôt dû</Badge>
        <Badge variant="outline" className="text-xs">OK</Badge>
      </div>
    </div>
  )
}

function StatusBadge({ schedule, days }: { schedule?: MaintenanceSchedule; days?: number }) {
  if (!schedule || days === undefined) return <Badge variant="outline" className="text-xs">Sans planning</Badge>
  if (days < 0) {
    return (
      <Badge variant="destructive" className="gap-1 text-xs">
        <AlertTriangle className="h-3 w-3" />
        En retard
      </Badge>
    )
  }
  if (days <= schedule.lead_days) {
    return (
      <Badge className="gap-1 text-xs bg-amber-500 hover:bg-amber-500/90">
        <Clock className="h-3 w-3" />
        Bientôt dû
      </Badge>
    )
  }
  return <Badge variant="outline" className="text-xs">OK</Badge>
}
