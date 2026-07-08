import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, CheckCircle2, Clock, AlertTriangle, Package, Banknote, Loader2, ArchiveX, RotateCcw, Pencil, Trash2, MessageSquare, Wrench, Power, Plus } from 'lucide-react'
import { useAuth, isAdmin, canWrite, canManageStock } from '@/lib/auth'
import { useLang } from '@/lib/i18n'
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
import { useEquipment, useMaintenanceSchedules, useMaintenanceLogs, useEquipmentObservations, useEquipmentStatusLog } from '@/lib/queries'
import { EquipmentDocumentList } from '@/components/equipment/DocumentUpload'
import { useLogMaintenance, useRetireEquipment, useUnretireEquipment, useDeleteMaintenanceLog, useAddObservation, useDeleteObservation, useDeleteEquipment, useSetEquipmentFunctional, useAddMaintenanceLog } from '@/lib/mutations'
import { toast } from 'sonner'
import { cn, todayStr } from '@/lib/utils'
import type { MaintenanceSchedule, EquipmentStatusLog } from '@/types/database'

export function EquipmentDetail() {
  const { t } = useLang()
  const { profile } = useAuth()
  const admin = isAdmin(profile)
  const canEditStatus = canWrite(profile)
  const canLogMaint = canManageStock(profile)
  const { id } = useParams()
  const { data: equipment, isLoading, error } = useEquipment(id)
  const { data: schedules = [] } = useMaintenanceSchedules(id)
  const { data: logs = [] } = useMaintenanceLogs(id)
  const { data: observations = [] } = useEquipmentObservations(id)
  const { data: statusLog = [] } = useEquipmentStatusLog(id)

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
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-semibold">{equipment.name}</h2>
            {equipment.is_functional ? (
              <Badge variant="outline" className="gap-1 text-green-600 border-green-200">
                <CheckCircle2 className="h-3 w-3" />
                {t('equip.functional')}
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t('equip.not.functional')}
              </Badge>
            )}
            {equipment.retired_at && (
              <Badge variant="secondary" className="gap-1 text-muted-foreground">
                <ArchiveX className="h-3 w-3" />
                Retiré le {format(parseISO(equipment.retired_at), 'd MMM yyyy')}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{equipment.category}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {equipment.serial_number && (
            <Badge variant="secondary" className="gap-1">SN: {equipment.serial_number}</Badge>
          )}
          {canEditStatus && (
            <FunctionalStatusDialog equipmentId={equipment.id} isFunctional={equipment.is_functional} changedBy={profile?.full_name ?? null} />
          )}
          <Link to={`/equipment/${equipment.id}/edit`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Modifier
          </Link>
          {admin && (
            equipment.retired_at
              ? <UnretireButton equipmentId={equipment.id} />
              : <RetireDialog equipmentId={equipment.id} />
          )}
          {admin && <DeleteEquipmentDialog equipmentId={equipment.id} equipmentName={equipment.name} />}
        </div>
      </div>

      {equipment.retired_at && (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm space-y-1">
          <p className="font-medium text-muted-foreground">Informations de retrait</p>
          <p>Destination : <span className="font-medium">{equipment.retirement_destination ?? '—'}</span></p>
          {equipment.retirement_recipient && <p>Destinataire : <span className="font-medium">{equipment.retirement_recipient}</span></p>}
          {equipment.retirement_reason && <p>Raison : <span className="font-medium">{equipment.retirement_reason}</span></p>}
        </div>
      )}

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
        <InfoBlock icon={Calendar} label="Date d'achat" value={equipment.purchase_date ? format(parseISO(equipment.purchase_date), 'd MMM yyyy') : null} />
        <InfoBlock icon={Calendar} label="Date d'installation" value={equipment.installed_at ? format(parseISO(equipment.installed_at), 'd MMM yyyy') : null} />
        <InfoBlock icon={Calendar} label="Garantie expire le" value={equipment.warranty_expiry ? format(parseISO(equipment.warranty_expiry), 'd MMM yyyy') : null} />
        {admin && <InfoBlock icon={Banknote} label="Coût" value={equipment.cost ? `${equipment.cost.toLocaleString()} ${equipment.currency ?? ''}`.trim() : null} />}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
        <CardContent>
          <EquipmentDocumentList equipmentId={equipment.id} />
        </CardContent>
      </Card>

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

      <ObservationsCard equipmentId={equipment.id} observations={observations} />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Historique de maintenance</CardTitle>
          {canLogMaint && <AddMaintenanceDialog equipmentId={equipment.id} performedBy={profile?.full_name ?? ''} />}
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune maintenance enregistrée.</p>
          ) : (
            <ul className="space-y-2">
              {logs.map((log) => (
                <MaintenanceLogRow key={log.id} log={log} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {statusLog.length > 0 && <StatusHistoryCard log={statusLog} />}
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
    if (!performedBy.trim()) {
      toast.error('Le champ "Effectué par" est requis')
      return
    }
    try {
      await logMutation.mutateAsync({
        schedule_id: schedule.id,
        equipment_id: schedule.equipment_id,
        performed_at: performedAt,
        performed_by: performedBy,
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
              <Input id="perf-at" type="date" max={todayStr()} value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="perf-by">Effectué par *</Label>
              <Input id="perf-by" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} placeholder="Nom" required />
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

function RetireDialog({ equipmentId }: { equipmentId: string }) {
  const [open, setOpen] = useState(false)
  const [retiredAt, setRetiredAt] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [reason, setReason] = useState('')
  const [destination, setDestination] = useState('')
  const [recipient, setRecipient] = useState('')
  const retire = useRetireEquipment()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!destination) { toast.error('La destination est requise'); return }
    try {
      await retire.mutateAsync({ id: equipmentId, retired_at: retiredAt, retirement_reason: reason, retirement_destination: destination, retirement_recipient: recipient })
      toast.success('Équipement retiré')
      setOpen(false)
    } catch (err) { toast.error(`Erreur : ${(err as Error).message}`) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10"><ArchiveX className="h-4 w-4 mr-1" />Retirer</Button>} />
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>Retirer cet équipement</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="ret-at">Date de retrait</Label>
              <Input id="ret-at" type="date" max={todayStr()} value={retiredAt} onChange={e => setRetiredAt(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ret-dest">Destination * <span className="text-xs text-muted-foreground font-normal">(ex: mise au rebut, don, transfert)</span></Label>
              <Input id="ret-dest" value={destination} onChange={e => setDestination(e.target.value)} required placeholder="Décrivez ce qu'il advient de l'équipement" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ret-rec">Destinataire / lieu</Label>
              <Input id="ret-rec" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Nom, organisation ou lieu (optionnel)" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ret-reason">Raison</Label>
              <Textarea id="ret-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Panne, obsolescence, remplacement… (optionnel)" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" variant="destructive" disabled={!destination || retire.isPending}>
              {retire.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Confirmer le retrait
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UnretireButton({ equipmentId }: { equipmentId: string }) {
  const unretire = useUnretireEquipment()
  async function handle() {
    try {
      await unretire.mutateAsync(equipmentId)
      toast.success('Équipement remis en service')
    } catch (err) { toast.error(`Erreur : ${(err as Error).message}`) }
  }
  return (
    <Button variant="outline" size="sm" onClick={handle} disabled={unretire.isPending}>
      {unretire.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
      Remettre en service
    </Button>
  )
}

function DeleteEquipmentDialog({ equipmentId, equipmentName }: { equipmentId: string; equipmentName: string }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const deleteEquipment = useDeleteEquipment()

  async function handleDelete() {
    try {
      await deleteEquipment.mutateAsync(equipmentId)
      toast.success(t('equip.delete.success'))
      navigate('/equipment')
    } catch (err) {
      toast.error(`Erreur : ${(err as Error).message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10"><Trash2 className="h-4 w-4 mr-1" />{t('equip.delete.btn')}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('equip.delete.title')}</DialogTitle>
        </DialogHeader>
        <div className="py-3 text-sm space-y-2">
          <p className="font-medium">{equipmentName}</p>
          <p className="text-muted-foreground">{t('equip.delete.desc')}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteEquipment.isPending}>
            {deleteEquipment.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t('equip.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import type { MaintenanceLog, EquipmentObservation } from '@/types/database'

function ObservationsCard({ equipmentId, observations }: { equipmentId: string; observations: EquipmentObservation[] }) {
  const { profile } = useAuth()
  const canDelete = profile?.role === 'admin' || profile?.role === 'lab_manager'
  const [note, setNote] = useState('')
  const addObs = useAddObservation()
  const deleteObs = useDeleteObservation()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    try {
      await addObs.mutateAsync({
        equipment_id: equipmentId,
        note: note.trim(),
        created_by: profile?.full_name ?? null,
      })
      setNote('')
      toast.success('Observation enregistrée')
    } catch (err) {
      toast.error(`Erreur : ${(err as Error).message}`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Observations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="flex gap-2 items-end">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex : le congélateur fait un bruit inhabituel…"
            rows={2}
            className="flex-1 text-sm resize-none"
          />
          <Button type="submit" size="sm" disabled={!note.trim() || addObs.isPending}>
            {addObs.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ajouter'}
          </Button>
        </form>
        {observations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune observation enregistrée.</p>
        ) : (
          <ul className="space-y-2">
            {observations.map((obs) => (
              <ObservationRow
                key={obs.id}
                obs={obs}
                canDelete={canDelete}
                onDelete={async () => {
                  if (!confirm('Supprimer cette observation ?')) return
                  try {
                    await deleteObs.mutateAsync({ id: obs.id, equipment_id: equipmentId })
                  } catch (err) {
                    toast.error(`Erreur : ${(err as Error).message}`)
                  }
                }}
                deleting={deleteObs.isPending}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ObservationRow({
  obs,
  canDelete,
  onDelete,
  deleting,
}: {
  obs: EquipmentObservation
  canDelete: boolean
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <li className="border-l-2 border-muted pl-3 py-1 group flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm whitespace-pre-wrap">{obs.note}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {format(parseISO(obs.created_at), 'd MMM yyyy HH:mm')}
          {obs.created_by && ` · ${obs.created_by}`}
        </p>
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-destructive transition-opacity shrink-0 mt-0.5"
          title="Supprimer"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      )}
    </li>
  )
}

function MaintenanceLogRow({ log }: { log: MaintenanceLog }) {
  const { profile } = useAuth()
  const canDelete = profile?.role === 'admin' || profile?.role === 'lab_manager'
  const deleteLog = useDeleteMaintenanceLog()
  const [editing, setEditing] = useState(false)
  const [editNotes, setEditNotes] = useState(log.notes ?? '')
  const [editBy, setEditBy] = useState(log.performed_by ?? '')

  async function handleDelete() {
    if (!confirm('Supprimer cet enregistrement de maintenance ?')) return
    try {
      await deleteLog.mutateAsync({ id: log.id, equipment_id: log.equipment_id })
      toast.success('Enregistrement supprimé')
    } catch (err) { toast.error(`Erreur : ${(err as Error).message}`) }
  }

  return (
    <li className="border-l-2 border-primary/30 pl-3 py-1 group">
      {editing ? (
        <div className="space-y-2">
          <Input
            value={editBy}
            onChange={e => setEditBy(e.target.value)}
            placeholder="Effectué par"
            className="h-7 text-sm"
          />
          <Textarea
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">
              {format(parseISO(log.performed_at), 'd MMM yyyy')}
              {log.performed_by && <span className="text-muted-foreground font-normal"> · {log.performed_by}</span>}
            </p>
            {log.notes && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{log.notes}</p>}
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteLog.isPending}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-destructive transition-opacity shrink-0"
              title="Supprimer"
            >
              {deleteLog.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

function FunctionalStatusDialog({ equipmentId, isFunctional, changedBy }: { equipmentId: string; isFunctional: boolean; changedBy: string | null }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const setStatus = useSetEquipmentFunctional()
  const goingDown = isFunctional // currently functional → marking it not functional

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) { toast.error(t('equip.status.note.required')); return }
    try {
      await setStatus.mutateAsync({ equipmentId, isFunctional: !isFunctional, note: note.trim(), changedBy })
      toast.success(goingDown ? t('equip.status.down.success') : t('equip.status.up.success'))
      setOpen(false); setNote('')
    } catch (err) {
      toast.error(`${t('equip.status.error')} : ${(err as Error).message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        goingDown
          ? <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10"><Power className="h-3.5 w-3.5 mr-1" />{t('equip.mark.down')}</Button>
          : <Button variant="outline" size="sm" className="text-green-700 border-green-200 hover:bg-green-50"><Power className="h-3.5 w-3.5 mr-1" />{t('equip.mark.up')}</Button>
      } />
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>{goingDown ? t('equip.status.down.title') : t('equip.status.up.title')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="status-note">{goingDown ? t('equip.status.issue') : t('equip.status.action')} *</Label>
              <Textarea id="status-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('action.cancel')}</Button>
            <Button type="submit" variant={goingDown ? 'destructive' : 'default'} disabled={setStatus.isPending}>
              {setStatus.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('action.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddMaintenanceDialog({ equipmentId, performedBy }: { equipmentId: string; performedBy: string }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [performedAt, setPerformedAt] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [by, setBy] = useState(performedBy)
  const [notes, setNotes] = useState('')
  const add = useAddMaintenanceLog()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!by.trim()) { toast.error(t('equip.maint.by.required')); return }
    try {
      await add.mutateAsync({ equipment_id: equipmentId, performed_at: performedAt, performed_by: by || null, notes: notes || null })
      toast.success(t('equip.maint.added'))
      setOpen(false); setNotes('')
    } catch (err) {
      toast.error(`${t('equip.maint.error')} : ${(err as Error).message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />{t('equip.maint.add')}</Button>} />
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>{t('equip.maint.add.title')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="m-at">{t('equip.maint.performed.on')}</Label>
              <Input id="m-at" type="date" max={todayStr()} value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="m-by">{t('equip.maint.performed.by')} *</Label>
              <Input id="m-by" value={by} onChange={(e) => setBy(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="m-notes">{t('equip.maint.notes')}</Label>
              <Textarea id="m-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('action.cancel')}</Button>
            <Button type="submit" disabled={add.isPending}>{add.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{t('action.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StatusHistoryCard({ log }: { log: EquipmentStatusLog[] }) {
  const { t } = useLang()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          {t('equip.status.history')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {log.map((e) => (
            <li key={e.id} className={cn('border-l-2 pl-3 py-1', e.is_functional ? 'border-green-300' : 'border-destructive/40')}>
              <div className="flex items-center gap-2 flex-wrap">
                {e.is_functional
                  ? <Badge variant="outline" className="text-xs text-green-600 border-green-200">{t('equip.functional')}</Badge>
                  : <Badge variant="destructive" className="text-xs">{t('equip.not.functional')}</Badge>}
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(e.changed_at), 'd MMM yyyy HH:mm')}{e.changed_by ? ` · ${e.changed_by}` : ''}
                </span>
              </div>
              {e.note && <p className="text-sm mt-1 whitespace-pre-wrap">{e.note}</p>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
