import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, CheckCircle2, Clock, AlertTriangle, MapPin, Package, Banknote, Loader2 } from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useEquipment, useMaintenanceSchedules, useMaintenanceLogs } from '@/lib/queries'
import { useLogMaintenance } from '@/lib/mutations'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { MaintenanceSchedule } from '@/types/database'

const LAB_LABEL: Record<string, string> = { lab_1: 'Lab 1', lab_2: 'Lab 2' }

export function EquipmentDetail() {
  const { id } = useParams()
  const { data: equipment, isLoading, error } = useEquipment(id)
  const { data: schedules = [] } = useMaintenanceSchedules(id)
  const { data: logs = [] } = useMaintenanceLogs(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !equipment) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Equipment not found or unable to load.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/equipment" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Equipment
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">{equipment.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{equipment.category}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1">
            <MapPin className="h-3 w-3" />
            {LAB_LABEL[equipment.lab]}
          </Badge>
          {equipment.serial_number && (
            <Badge variant="secondary" className="gap-1">SN: {equipment.serial_number}</Badge>
          )}
        </div>
      </div>

      {equipment.photo_urls.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {equipment.photo_urls.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noopener" className="aspect-square rounded-md overflow-hidden border bg-muted">
              <img src={url} alt={`${equipment.name} photo ${i + 1}`} className="object-cover w-full h-full" />
            </a>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoBlock icon={Package} label="Supplier" value={equipment.supplier} />
        <InfoBlock icon={Calendar} label="Purchased" value={equipment.purchase_date ? format(parseISO(equipment.purchase_date), 'd MMM yyyy') : null} />
        <InfoBlock icon={Calendar} label="Warranty expires" value={equipment.warranty_expiry ? format(parseISO(equipment.warranty_expiry), 'd MMM yyyy') : null} />
        <InfoBlock icon={Banknote} label="Cost" value={equipment.cost ? `${equipment.cost.toLocaleString()} ${equipment.currency ?? ''}`.trim() : null} />
      </div>

      {equipment.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{equipment.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maintenance schedules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No maintenance schedules set up.</p>
          ) : (
            schedules.map((s) => <ScheduleRow key={s.id} schedule={s} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maintenance history</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No maintenance has been logged yet.</p>
          ) : (
            <ul className="space-y-3">
              {logs.map((log) => (
                <li key={log.id} className="border-l-2 border-primary/30 pl-3 py-1">
                  <p className="text-sm font-medium">
                    {format(parseISO(log.performed_at), 'd MMM yyyy')}
                    {log.performed_by && <span className="text-muted-foreground font-normal"> · by {log.performed_by}</span>}
                  </p>
                  {log.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{log.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InfoBlock({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-3">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium">{value ?? <span className="text-muted-foreground">—</span>}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ScheduleRow({ schedule }: { schedule: MaintenanceSchedule }) {
  const due = parseISO(schedule.next_due)
  const days = differenceInDays(due, new Date())
  const overdue = days < 0
  const dueSoon = days >= 0 && days <= schedule.lead_days

  return (
    <div className="flex items-center justify-between gap-3 border rounded-md p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{schedule.label}</p>
        <p className="text-xs text-muted-foreground">
          every {schedule.interval_days}d · alert {schedule.lead_days}d before
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {overdue ? (
          <Badge variant="destructive" className="gap-1 text-xs">
            <AlertTriangle className="h-3 w-3" />
            Overdue {Math.abs(days)}d
          </Badge>
        ) : dueSoon ? (
          <Badge className="gap-1 text-xs bg-amber-500 hover:bg-amber-500/90">
            <Clock className="h-3 w-3" />
            Due in {days}d
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-xs">
            Due {format(due, 'd MMM')}
          </Badge>
        )}
        <LogMaintenanceDialog schedule={schedule} />
      </div>
    </div>
  )
}

function LogMaintenanceDialog({ schedule }: { schedule: MaintenanceSchedule }) {
  const [open, setOpen] = useState(false)
  const [performedAt, setPerformedAt] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [performedBy, setPerformedBy] = useState('')
  const [notes, setNotes] = useState('')
  const logMutation = useLogMaintenance()

  function nextDue(performedDate: string): string {
    const d = parseISO(performedDate)
    d.setDate(d.getDate() + schedule.interval_days)
    return format(d, 'yyyy-MM-dd')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await logMutation.mutateAsync({
        schedule_id: schedule.id,
        equipment_id: schedule.equipment_id,
        performed_at: performedAt,
        performed_by: performedBy || null,
        notes: notes || null,
        next_due: nextDue(performedAt),
      })
      toast.success('Maintenance logged')
      setOpen(false)
      setPerformedBy('')
      setNotes('')
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Log Done
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Log maintenance — {schedule.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="perf-at">Performed on</Label>
              <Input id="perf-at" type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="perf-by">Performed by</Label>
              <Input id="perf-by" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} placeholder="Name (optional)" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="perf-notes">Notes</Label>
              <Textarea id="perf-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any details (optional)" />
            </div>
            <p className="text-xs text-muted-foreground">
              Next due will be set to <span className="font-medium">{nextDue(performedAt)}</span>
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={logMutation.isPending}>
              {logMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
