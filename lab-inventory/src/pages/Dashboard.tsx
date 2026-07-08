import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, differenceInDays, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Wrench, Package, AlertTriangle, Clock, Loader2, CheckCircle2, MessageSquare, CalendarClock } from 'lucide-react'
import { useEquipmentList, useMaintenanceSchedules, useItemTypes, useCurrentStock, useCategoryCoverage, useEquipmentObservations, useAllActiveLots } from '@/lib/queries'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { getExpiringLots } from '@/lib/lotCalc'
import type { MaintenanceSchedule, Equipment, InventoryLot } from '@/types/database'

interface StockRow {
  item_type_id: string
  name: string
  unit: string
  min_threshold: number
  quantity: number
  last_counted_at: string | null
}

export function Dashboard() {
  const { t } = useLang()
  const { data: equipment = [], isLoading: loadingEquipment } = useEquipmentList()
  const { data: schedules = [], isLoading: loadingSchedules } = useMaintenanceSchedules()
  const { data: itemTypes = [] } = useItemTypes()
  const { data: stockRows = [] } = useCurrentStock() as { data: StockRow[] }
  const { data: coverage = [], isLoading: loadingCoverage } = useCategoryCoverage(itemTypes)
  const { data: recentObs = [] } = useEquipmentObservations(undefined, 5)
  const { data: allActiveLots = [] } = useAllActiveLots()

  const todayStr = new Date().toISOString().slice(0, 10)
  const expiredLots  = useMemo(() => allActiveLots.filter(l => l.expiry_date < todayStr), [allActiveLots, todayStr])
  const expiringLots = useMemo(() => getExpiringLots(allActiveLots, 90), [allActiveLots])

  const today = new Date()

  const { overdue, dueSoon } = useMemo(() => {
    const equipmentMap = new Map(equipment.map((e) => [e.id, e]))
    const overdue: Array<{ schedule: MaintenanceSchedule; equipment: Equipment }> = []
    const dueSoon: Array<{ schedule: MaintenanceSchedule; equipment: Equipment; days: number }> = []

    for (const s of schedules) {
      const eq = equipmentMap.get(s.equipment_id)
      if (!eq) continue
      const days = differenceInDays(parseISO(s.next_due), today)
      if (days < 0) overdue.push({ schedule: s, equipment: eq })
      else if (days <= s.lead_days) dueSoon.push({ schedule: s, equipment: eq, days })
    }

    dueSoon.sort((a, b) => a.days - b.days)
    return { overdue, dueSoon }
  }, [schedules, equipment])

  const lowStock = useMemo(() => {
    const stockByItem = new Map(stockRows.map((r) => [r.item_type_id, r]))
    return itemTypes
      .map((i) => {
        const row = stockByItem.get(i.id)
        return { ...i, quantity: Number(row?.quantity ?? 0), last_counted_at: row?.last_counted_at ?? null }
      })
      .filter((i) => i.quantity < i.min_threshold)
      .sort((a, b) => a.quantity - b.quantity) // out of stock (0) first
  }, [itemTypes, stockRows])

  const loading = loadingEquipment || loadingSchedules

  return (
    <div className="space-y-6">
      {/* Alert strip */}
      {(overdue.length > 0 || lowStock.length > 0 || expiredLots.length > 0 || expiringLots.length > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">
              {[
                overdue.length > 0 && `${overdue.length} ${t('dash.alert.maintenance')}`,
                lowStock.length > 0 && `${lowStock.length} ${t('dash.alert.low.stock')}`,
                expiredLots.length > 0 && `${expiredLots.length} ${t('dash.alert.expired')}`,
                expiringLots.length > 0 && `${expiringLots.length} ${t('dash.alert.expiring')}`,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title={t('dash.equipment')}
          value={loading ? '…' : String(equipment.length)}
          icon={Wrench}
          description={t('dash.equipment.sub')}
          href="/equipment"
        />
        <StatCard
          title={t('dash.overdue')}
          value={loading ? '…' : String(overdue.length)}
          icon={Clock}
          description={t('dash.overdue.sub')}
          urgent={overdue.length > 0}
          href="/equipment"
        />
        <StatCard
          title={t('dash.inventory.items')}
          value={String(itemTypes.length)}
          icon={Package}
          description={t('dash.inventory.items.sub')}
          href="/inventory"
        />
        <StatCard
          title={t('dash.low.stock')}
          value={String(lowStock.length)}
          icon={AlertTriangle}
          description={t('dash.low.stock.sub')}
          urgent={lowStock.length > 0}
          href="/inventory"
        />
        <StatCard
          title={t('dash.expiry.stat')}
          value={String(expiredLots.length + expiringLots.length)}
          icon={CalendarClock}
          description={expiredLots.length > 0 ? `${expiredLots.length} ${t('dash.expiry.stat.expired')}` : t('dash.expiry.stat.sub')}
          urgent={expiredLots.length > 0}
          href="/inventory"
        />
      </div>

      {/* Two-column detail */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Maintenance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dash.maintenance.alerts')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : overdue.length === 0 && dueSoon.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t('dash.maintenance.ok')}
              </div>
            ) : (
              <>
                {overdue.map(({ schedule, equipment: eq }) => (
                  <MaintenanceRow
                    key={schedule.id}
                    name={eq.name}
                    label={schedule.label}
                    dueDate={schedule.next_due}
                    status="overdue"
                    equipmentId={eq.id}
                  />
                ))}
                {dueSoon.map(({ schedule, equipment: eq, days }) => (
                  <MaintenanceRow
                    key={schedule.id}
                    name={eq.name}
                    label={schedule.label}
                    dueDate={schedule.next_due}
                    days={days}
                    status="due-soon"
                    equipmentId={eq.id}
                  />
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Expiry alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              {t('dash.expiry.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {expiredLots.length === 0 && expiringLots.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t('dash.expiry.ok')}
              </div>
            ) : (
              <>
                {expiredLots.map(lot => (
                  <ExpiryRow key={lot.id} lot={lot} expired />
                ))}
                {expiringLots.map(lot => (
                  <ExpiryRow key={lot.id} lot={lot} expired={false} />
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dash.low.stock.alerts')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStock.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t('dash.low.stock.ok')}
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
              {lowStock.map((item) => (
                <Link
                  key={item.id}
                  to={`/inventory/items/${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} {item.unit} · min {item.min_threshold}
                      {item.last_counted_at && (
                        <span className="text-muted-foreground/60">
                          {' '}· {t('dash.low.stock.counted')} {format(parseISO(item.last_counted_at), 'd MMM')}
                        </span>
                      )}
                    </p>
                  </div>
                  {item.quantity <= 0 ? (
                    <Badge variant="destructive" className="text-xs shrink-0">{t('dash.out.of.stock')}</Badge>
                  ) : (
                    <Badge className="text-xs shrink-0 bg-amber-500 hover:bg-amber-500/90">{t('inv.status.low')}</Badge>
                  )}
                </Link>
              ))}
              </div>
            )}
            {lowStock.length > 0 && (
              <Link to="/inventory" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full mt-2')}>
                {t('dash.view.inventory')}
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent observations */}
      {recentObs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              {t('dash.observations.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {recentObs.map((obs) => (
                <li key={obs.id}>
                  <Link
                    to={`/equipment/${obs.equipment_id}`}
                    className="block rounded-md border px-3 py-2 hover:bg-muted/30 transition-colors"
                  >
                    <p className="text-sm font-medium truncate">{obs.equipment?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{obs.note}</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {format(parseISO(obs.created_at), 'd MMM yyyy')}
                      {obs.created_by && ` · ${obs.created_by}`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Coverage widget */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('dash.coverage.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCoverage ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : coverage.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dash.coverage.empty')}</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {coverage.map(row => {
                const pct = row.total ? Math.round((row.counted / row.total) * 100) : 0
                const daysAgo = row.lastDate
                  ? differenceInDays(new Date(), parseISO(row.lastDate))
                  : null
                const color = !row.lastDate ? 'bg-destructive'
                  : pct < 50 ? 'bg-amber-500'
                  : pct < 100 ? 'bg-primary/70'
                  : 'bg-green-500'

                return (
                  <div key={row.category} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium truncate">{row.category}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {row.lastDate
                            ? `${format(parseISO(row.lastDate), 'd MMM yyyy')} · ${t('dash.coverage.ago')} ${daysAgo}${t('dash.coverage.days')}`
                            : t('dash.coverage.never')}
                        </span>
                        <Badge
                          variant={pct === 100 ? 'outline' : 'secondary'}
                          className={`text-xs ${pct < 50 ? 'text-amber-600' : ''}`}
                        >
                          {row.counted}/{row.total}
                        </Badge>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  urgent,
  href,
}: {
  title: string
  value: string
  icon: React.ElementType
  description: string
  urgent?: boolean
  href: string
}) {
  return (
    <Link to={href}>
      <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className={`h-4 w-4 ${urgent ? 'text-amber-500' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${urgent ? 'text-amber-600' : ''}`}>{value}</div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function ExpiryRow({ lot, expired }: { lot: InventoryLot; expired: boolean }) {
  const today = new Date().toISOString().slice(0, 10)
  const daysUntil = Math.ceil((new Date(lot.expiry_date).getTime() - new Date(today).getTime()) / 86400000)
  const itemName = (lot as InventoryLot & { item_type?: { name: string } }).item_type?.name ?? '—'

  return (
    <Link
      to={`/inventory/items/${lot.item_type_id}`}
      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-muted/30 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{itemName}</p>
        <p className="text-xs text-muted-foreground truncate">
          {lot.manufacturer} · {lot.quantity_remaining} {(lot as InventoryLot & { item_type?: { unit: string } }).item_type?.unit ?? ''}
        </p>
      </div>
      {expired ? (
        <Badge variant="destructive" className="text-xs shrink-0">
          Expiré {format(parseISO(lot.expiry_date), 'd MMM')}
        </Badge>
      ) : (
        <Badge className={cn('text-xs shrink-0', daysUntil <= 30 ? 'bg-destructive hover:bg-destructive/90' : 'bg-amber-500 hover:bg-amber-500/90')}>
          {daysUntil}j
        </Badge>
      )}
    </Link>
  )
}

function MaintenanceRow({
  name,
  label,
  dueDate,
  days,
  status,
  equipmentId,
}: {
  name: string
  label: string
  dueDate: string
  days?: number
  status: 'overdue' | 'due-soon'
  equipmentId: string
}) {
  const { t } = useLang()
  return (
    <Link
      to={`/equipment/${equipmentId}`}
      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-muted/30 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
      {status === 'overdue' ? (
        <Badge variant="destructive" className="text-xs shrink-0">
          {t('dash.overdue.label')} {format(parseISO(dueDate), 'd MMM')}
        </Badge>
      ) : (
        <Badge className="text-xs shrink-0 bg-amber-500 hover:bg-amber-500/90">
          {t('dash.due.soon.label')} {days}{t('dash.due.soon.days')}
        </Badge>
      )}
    </Link>
  )
}
