import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, differenceInDays, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Wrench, Package, AlertTriangle, Clock, Loader2, CheckCircle2 } from 'lucide-react'
import { useEquipmentList, useMaintenanceSchedules, useItemTypes, useCurrentStock } from '@/lib/queries'
import { cn } from '@/lib/utils'
import type { MaintenanceSchedule, Equipment } from '@/types/database'

interface StockRow {
  item_type_id: string
  name: string
  unit: string
  min_threshold: number
  quantity: number
}

export function Dashboard() {
  const { data: equipment = [], isLoading: loadingEquipment } = useEquipmentList()
  const { data: schedules = [], isLoading: loadingSchedules } = useMaintenanceSchedules()
  const { data: itemTypes = [] } = useItemTypes()
  const { data: stockRows = [] } = useCurrentStock() as { data: StockRow[] }

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
    const stockByItem = new Map(stockRows.map((r) => [r.item_type_id, Number(r.quantity)]))
    return itemTypes
      .map((i) => ({ ...i, quantity: stockByItem.get(i.id) ?? 0 }))
      .filter((i) => i.quantity < i.min_threshold)
  }, [itemTypes, stockRows])

  const loading = loadingEquipment || loadingSchedules

  return (
    <div className="space-y-6">
      {/* Alert strip */}
      {(overdue.length > 0 || lowStock.length > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">
              {[
                overdue.length > 0 && `${overdue.length} maintenance task${overdue.length > 1 ? 's' : ''} overdue`,
                lowStock.length > 0 && `${lowStock.length} item${lowStock.length > 1 ? 's' : ''} below minimum stock`,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Equipment"
          value={loading ? '…' : String(equipment.length)}
          icon={Wrench}
          description="registered items"
          href="/equipment"
        />
        <StatCard
          title="Overdue Maintenance"
          value={loading ? '…' : String(overdue.length)}
          icon={Clock}
          description="need attention"
          urgent={overdue.length > 0}
          href="/equipment"
        />
        <StatCard
          title="Inventory Items"
          value={String(itemTypes.length)}
          icon={Package}
          description="item types tracked"
          href="/inventory"
        />
        <StatCard
          title="Low Stock"
          value={String(lowStock.length)}
          icon={AlertTriangle}
          description="below threshold"
          urgent={lowStock.length > 0}
          href="/inventory"
        />
      </div>

      {/* Two-column detail */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Maintenance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maintenance alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : overdue.length === 0 && dueSoon.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                All maintenance up to date.
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

        {/* Low stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low stock alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStock.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                All items above minimum threshold.
              </div>
            ) : (
              lowStock.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} {item.unit} · min {item.min_threshold}
                    </p>
                  </div>
                  <Badge variant="destructive" className="text-xs shrink-0">Low</Badge>
                </div>
              ))
            )}
            {lowStock.length > 0 && (
              <Link to="/inventory" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full mt-2')}>
                View inventory
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
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
          Overdue {format(parseISO(dueDate), 'd MMM')}
        </Badge>
      ) : (
        <Badge className="text-xs shrink-0 bg-amber-500 hover:bg-amber-500/90">
          Due in {days}d
        </Badge>
      )}
    </Link>
  )
}
