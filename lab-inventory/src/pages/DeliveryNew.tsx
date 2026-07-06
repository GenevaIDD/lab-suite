import { useState, useMemo } from 'react'
import { todayStr } from '@/lib/utils'
import { qtyStep } from '@/lib/utils'
import { useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, Save, Loader2, Plus } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ItemCombobox } from '@/components/ui/ItemCombobox'
import { useItemTypes, useItemSources } from '@/lib/queries'
import { useCreateDelivery, useCreateItemSource, useUpsertLot } from '@/lib/mutations'
import { useLang } from '@/lib/i18n'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function DeliveryNew() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { data: itemTypes = [], isLoading: loadingTypes } = useItemTypes()
  const createDelivery = useCreateDelivery()
  const upsertLot = useUpsertLot()

  const [itemTypeId, setItemTypeId] = useState('')
  const [itemSourceId, setItemSourceId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [receivedAt, setReceivedAt] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [receivedBy, setReceivedBy] = useState('')
  const [notes, setNotes] = useState('')

  const { data: sources = [] } = useItemSources(itemTypeId || undefined)
  const selectedItem = useMemo(() => itemTypes.find(i => i.id === itemTypeId), [itemTypes, itemTypeId])
  const isTracked = selectedItem?.track_lots ?? false

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!itemTypeId || !quantity) {
      toast.error(t('delivnew.item.required'))
      return
    }
    if (isTracked && !itemSourceId) {
      toast.error(t('delivnew.mfr.required'))
      return
    }
    if (isTracked && !expiryDate) {
      toast.error(t('delivnew.exp.required'))
      return
    }
    try {
      const delivery = await createDelivery.mutateAsync({
        item_type_id: itemTypeId,
        item_source_id: itemSourceId || null,
        quantity: Number(quantity),
        lot_number: lotNumber || null,
        expiry_date: expiryDate || null,
        received_at: new Date(receivedAt).toISOString(),
        received_by: receivedBy || null,
        notes: notes || null,
      })
      // For tracked items, create/update a lot record
      if (isTracked && expiryDate && itemSourceId) {
        const source = sources.find(s => s.id === itemSourceId)
        if (source && delivery) {
          await upsertLot.mutateAsync({
            item_type_id: itemTypeId,
            delivery_id: delivery.id ?? null,
            manufacturer: source.manufacturer,
            expiry_date: expiryDate,
            lot_number: lotNumber || null,
            quantity_initial: Number(quantity),
            quantity_remaining: Number(quantity),
          })
        }
      }
      toast.success(navigator.onLine ? t('delivnew.saved') : t('new.saved.offline'))
      navigate('/inventory')
    } catch (err) {
      toast.error(`${t('form.error')} : ${(err as Error).message}`)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <Link to="/inventory" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t('inv.back')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('delivnew.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('delivnew.desc')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="item">{t('inv.col.item')} *</Label>
            <ItemCombobox
              id="item"
              items={itemTypes}
              value={itemTypeId}
              onChange={(id) => { setItemTypeId(id); setItemSourceId('') }}
              loading={loadingTypes}
            />
            {!loadingTypes && itemTypes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {t('delivnew.no.items')} <Link to="/inventory/new" className="underline">{t('delivnew.add.first')}</Link>.
              </p>
            )}
          </div>

          {itemTypeId && (
            <div className="space-y-1">
              <Label htmlFor="source">{t('delivnew.source')} {isTracked && <span className="text-destructive">*</span>}</Label>
              <div className="flex gap-2">
                <Select value={itemSourceId} onValueChange={(v) => setItemSourceId(v ?? '')}>
                  <SelectTrigger id="source" className="w-full">
                    <SelectValue placeholder={t('delivnew.source.ph')} />
                  </SelectTrigger>
                  <SelectContent className="min-w-[280px]">
                    {sources.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                        {t('delivnew.no.mfr')}
                      </div>
                    ) : (
                      sources.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.manufacturer}{s.supplier ? ` (${t('src.via')} ${s.supplier})` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <NewSourceDialog itemTypeId={itemTypeId} onCreated={setItemSourceId} />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('delivnew.source.hint')}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="qty">{t('label.quantity')} * {selectedItem && <span className="text-muted-foreground font-normal">({selectedItem.unit})</span>}</Label>
              <Input id="qty" type="number" min={0} step={qtyStep(selectedItem?.unit)} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lot">{t('label.lot')} <span className="text-xs text-muted-foreground font-normal">{t('delivnew.optional')}</span></Label>
              <Input id="lot" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="exp">{t('label.expiry')} {isTracked && <span className="text-destructive">*</span>}</Label>
              <Input id="exp" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rec-at">{t('label.received.on')} *</Label>
              <Input id="rec-at" type="date" max={todayStr()} value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rec-by">{t('label.received.by')}</Label>
              <Input id="rec-by" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder={t('delivnew.by.ph')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">{t('label.notes')}</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link to="/inventory" className={cn(buttonVariants({ variant: 'outline' }))}>{t('action.cancel')}</Link>
        <Button type="submit" disabled={createDelivery.isPending}>
          {createDelivery.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          {t('delivnew.save')}
        </Button>
      </div>
    </form>
  )
}

function NewSourceDialog({ itemTypeId, onCreated }: { itemTypeId: string; onCreated: (id: string) => void }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [manufacturer, setManufacturer] = useState('')
  const [supplier, setSupplier] = useState('')
  const createSource = useCreateItemSource()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!manufacturer) return
    try {
      const created = await createSource.mutateAsync({
        item_type_id: itemTypeId,
        manufacturer,
        supplier: supplier || null,
        notes: null,
      })
      if (created?.id) onCreated(created.id)
      toast.success(created ? t('delivnew.source.added') : t('new.saved.offline'))
      setOpen(false)
      setManufacturer('')
      setSupplier('')
    } catch (err) {
      toast.error(`${t('delivnew.failed')} : ${(err as Error).message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t('delivnew.new.mfr')}
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('delivnew.add.mfr')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="new-mfr">{t('label.manufacturer')}</Label>
              <Input id="new-mfr" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-sup">{t('src.supplier.optional')}</Label>
              <Input id="new-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('action.cancel')}</Button>
            <Button type="submit" disabled={!manufacturer || createSource.isPending}>
              {createSource.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('action.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
