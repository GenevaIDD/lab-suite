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
import { Plus, Search, Wrench, AlertTriangle, Clock, Loader2, ArchiveX, Download } from 'lucide-react'
import { useEquipmentList, useMaintenanceSchedules } from '@/lib/queries'
import { useLang } from '@/lib/i18n'
import { useAuth, isAdmin } from '@/lib/auth'
import { downloadXlsx } from '@/lib/export'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { MaintenanceSchedule } from '@/types/database'

export function Equipment() {
  const [search, setSearch] = useState('')
  const { t } = useLang()
  const { profile } = useAuth()
  const admin = isAdmin(profile)
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

  async function exportEquipment() {
    try {
      const columns = [
        { header: t('export.eq.name'), width: 30 },
        { header: t('export.eq.category'), width: 22 },
        { header: t('export.eq.serial'), width: 18 },
        { header: t('export.eq.supplier'), width: 22 },
        { header: t('export.eq.purchase'), width: 14 },
        { header: t('export.eq.install'), width: 14 },
        { header: t('export.eq.warranty'), width: 14 },
        { header: t('export.eq.nextmaint'), width: 16 },
        ...(admin ? [{ header: t('export.eq.cost'), width: 12 }, { header: t('export.eq.currency'), width: 10 }] : []),
        { header: t('export.eq.notes'), width: 40 },
      ]
      const rows = [...equipment]
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
        .map((e) => {
          const next = (schedulesByEquipment.get(e.id) ?? [])
            .map((s) => ({ s, days: differenceInDays(parseISO(s.next_due), new Date()) }))
            .sort((a, b) => a.days - b.days)[0]
          return [
            e.name, e.category, e.serial_number, e.supplier,
            e.purchase_date ? parseISO(e.purchase_date) : null,
            e.installed_at ? parseISO(e.installed_at) : null,
            e.warranty_expiry ? parseISO(e.warranty_expiry) : null,
            next ? parseISO(next.s.next_due) : null,
            ...(admin ? [e.cost ?? null, e.currency ?? null] : []),
            e.notes ?? null,
          ]
        })
      await downloadXlsx(`equipements-${format(new Date(), 'yyyy-MM-dd')}.xlsx`, [
        { name: t('export.sheet.equipment'), columns, rows },
      ])
    } catch (err) {
      toast.error(`${t('export.error')} : ${(err as Error).message}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('equip.search')}
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="button" onClick={exportEquipment} className={cn(buttonVariants({ variant: 'outline' }))}>
          <Download className="h-4 w-4 mr-1" />
          {t('export.btn')}
        </button>
        <Link to="/equipment/retired" className={cn(buttonVariants({ variant: 'outline' }))}>
          <ArchiveX className="h-4 w-4 mr-1" />
          {t('equip.retired.link')}
        </Link>
        <Link to="/equipment/new" className={cn(buttonVariants())}>
          <Plus className="h-4 w-4 mr-1" />
          {t('equip.add')}
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('equip.col.name')}</TableHead>
                <TableHead>{t('equip.col.category')}</TableHead>
                <TableHead>{t('equip.col.next.maint')}</TableHead>
                <TableHead>{t('equip.col.status')}</TableHead>
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
                    {t('equip.error.load')}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                      <Wrench className="h-8 w-8 opacity-30" />
                      <p className="text-sm">
                        {search ? t('equip.empty.search') : t('equip.empty')}
                      </p>
                      {!search && (
                        <Link to="/equipment/new" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                          {t('equip.add.first')}
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
                        <div className="flex items-center gap-2">
                          <Link to={`/equipment/${e.id}`} className="font-medium hover:underline">
                            {e.name}
                          </Link>
                          {e.is_functional === false && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {t('equip.not.functional')}
                            </Badge>
                          )}
                        </div>
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
        {t('equip.legend')}
        <Badge variant="destructive" className="text-xs">{t('equip.status.overdue')}</Badge>
        <Badge className="text-xs bg-amber-500">{t('equip.status.due.soon')}</Badge>
        <Badge variant="outline" className="text-xs">{t('equip.status.ok')}</Badge>
      </div>
    </div>
  )
}

function StatusBadge({ schedule, days }: { schedule?: MaintenanceSchedule; days?: number }) {
  const { t } = useLang()
  if (!schedule || days === undefined) return <Badge variant="outline" className="text-xs">{t('equip.status.no.sched')}</Badge>
  if (days < 0) {
    return (
      <Badge variant="destructive" className="gap-1 text-xs">
        <AlertTriangle className="h-3 w-3" />
        {t('equip.status.overdue')}
      </Badge>
    )
  }
  if (days <= schedule.lead_days) {
    return (
      <Badge className="gap-1 text-xs bg-amber-500 hover:bg-amber-500/90">
        <Clock className="h-3 w-3" />
        {t('equip.status.due.soon')}
      </Badge>
    )
  }
  return <Badge variant="outline" className="text-xs">{t('equip.status.ok')}</Badge>
}
