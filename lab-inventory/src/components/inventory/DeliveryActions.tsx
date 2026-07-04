import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { useUpdateDelivery, useDeleteDelivery } from '@/lib/mutations'
import { useDeliveryLots } from '@/lib/queries'
import { useLang } from '@/lib/i18n'
import { qtyStep, todayStr } from '@/lib/utils'
import { toast } from 'sonner'
import type { Delivery } from '@/types/database'

export function DeliveryActions({ delivery }: { delivery: Delivery }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <EditDeliveryDialog delivery={delivery} />
      <DeleteDeliveryDialog delivery={delivery} />
    </div>
  )
}

function EditDeliveryDialog({ delivery }: { delivery: Delivery }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const trackLots = delivery.item_type?.track_lots ?? false
  const unit = delivery.item_type?.unit ?? ''
  const [quantity, setQuantity] = useState(String(delivery.quantity))
  const [receivedAt, setReceivedAt] = useState(format(parseISO(delivery.received_at), 'yyyy-MM-dd'))
  const [receivedBy, setReceivedBy] = useState(delivery.received_by ?? '')
  const [notes, setNotes] = useState(delivery.notes ?? '')
  const update = useUpdateDelivery()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await update.mutateAsync({
        id: delivery.id,
        // Lot-tracked quantity lives on the lot, not the delivery — don't touch it here.
        ...(trackLots ? {} : { quantity: Number(quantity) }),
        received_at: new Date(receivedAt).toISOString(),
        received_by: receivedBy || null,
        notes: notes || null,
      })
      toast.success(t('deliv.updated'))
      setOpen(false)
    } catch (err) {
      toast.error(`${t('deliv.update.error')} : ${(err as Error).message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="sm" title={t('deliv.edit')}><Pencil className="h-3.5 w-3.5" /></Button>
      } />
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>{t('deliv.edit')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-sm text-muted-foreground">{delivery.item_type?.name}</p>
            <div className="space-y-1">
              <Label htmlFor="d-qty">{t('deliv.qty')}{unit && <span className="text-muted-foreground font-normal"> ({unit})</span>}</Label>
              <Input id="d-qty" type="number" min={0} step={qtyStep(unit)} value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={trackLots} />
              {trackLots && <p className="text-xs text-muted-foreground">{t('deliv.qty.lot.hint')}</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="d-date">{t('deliv.date')}</Label>
                <Input id="d-date" type="date" max={todayStr()} value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-by">{t('deliv.by')}</Label>
                <Input id="d-by" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="d-notes">{t('deliv.notes')}</Label>
              <Textarea id="d-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('users.cancel')}</Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('users.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDeliveryDialog({ delivery }: { delivery: Delivery }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [removeLot, setRemoveLot] = useState(false)
  const { data: lots = [] } = useDeliveryLots(delivery.id, open)
  const lot = lots[0]
  const del = useDeleteDelivery()

  async function confirm() {
    try {
      await del.mutateAsync({
        deliveryId: delivery.id,
        itemTypeId: delivery.item_type_id,
        lotIdToRemove: removeLot && lot ? lot.id : null,
      })
      toast.success(t('deliv.deleted'))
      setOpen(false)
    } catch (err) {
      toast.error(`${t('deliv.delete.error')} : ${(err as Error).message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setRemoveLot(false) }}>
      <DialogTrigger render={
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" title={t('deliv.delete')}><Trash2 className="h-3.5 w-3.5" /></Button>
      } />
      <DialogContent>
        <DialogHeader><DialogTitle>{t('deliv.delete.title')}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-3 text-sm">
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <span className="font-medium">{delivery.item_type?.name}</span>
            <span className="text-muted-foreground"> · {delivery.quantity} {delivery.item_type?.unit} · {format(parseISO(delivery.received_at), 'd MMM yyyy')}</span>
          </div>
          <p className="text-muted-foreground">{t('deliv.delete.desc')}</p>

          {lot && (
            <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={removeLot} onChange={(e) => setRemoveLot(e.target.checked)} className="mt-0.5 rounded" />
              <span>
                <span className="font-medium text-amber-900">{t('deliv.delete.lot.remove')}</span>
                <span className="block text-xs text-amber-800 mt-0.5">
                  {t('deliv.delete.lot.q')} {lot.manufacturer} · {format(parseISO(lot.expiry_date), 'MMM yyyy')} · {lot.quantity_remaining} {delivery.item_type?.unit}
                </span>
                <span className="block text-xs text-amber-800/80 mt-0.5">{t('deliv.delete.lot.keep.hint')}</span>
              </span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('users.cancel')}</Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={del.isPending}>
            {del.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t('deliv.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
