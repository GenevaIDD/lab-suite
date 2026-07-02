import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { qtyStep, todayStr, cn } from '@/lib/utils'
import { ArrowLeft, Save, Loader2, FlaskConical } from 'lucide-react'
import { buttonVariants, Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ItemCombobox } from '@/components/ui/ItemCombobox'
import { useItemTypes, useCurrentStock, useItemLots } from '@/lib/queries'
import { useCreateStockCount, useUpdateLotCount } from '@/lib/mutations'
import { toast } from 'sonner'
import { useAuth, canManageStock } from '@/lib/auth'
import { useLang } from '@/lib/i18n'

interface StockRow { item_type_id: string; quantity: number }

export function StockCountNew() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { profile } = useAuth()
  const { data: itemTypes = [], isLoading } = useItemTypes()
  const { data: stockRows = [] } = useCurrentStock() as { data: StockRow[] }
  const createCount = useCreateStockCount()
  const updateLot = useUpdateLotCount()

  const [itemTypeId, setItemTypeId] = useState('')
  const [lotId, setLotId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [countedAt, setCountedAt] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [countedBy, setCountedBy] = useState(profile?.full_name ?? '')
  const [notes, setNotes] = useState('')

  const selectedItem = itemTypes.find((i) => i.id === itemTypeId)
  const isLot = selectedItem?.track_lots ?? false
  const currentQty = stockRows.find((r) => r.item_type_id === itemTypeId)?.quantity
  const { data: lots = [] } = useItemLots(isLot ? itemTypeId : undefined)
  const selectedLot = lots.find((l) => l.id === lotId)

  function onItemChange(id: string) {
    setItemTypeId(id)
    setLotId('')
    setQuantity('')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!itemTypeId || quantity === '') { toast.error(t('quickcount.required')); return }

    try {
      if (isLot) {
        if (!lotId) { toast.error(t('quickcount.lot.pick')); return }
        await updateLot.mutateAsync({ lotId, itemTypeId, countedQuantity: Number(quantity) })
        toast.success(t('quickcount.lot.saved'))
      } else {
        await createCount.mutateAsync({
          item_type_id: itemTypeId,
          quantity: Number(quantity),
          counted_at: new Date(countedAt).toISOString(),
          counted_by: countedBy || null,
          notes: notes || null,
        })
        toast.success(navigator.onLine ? t('quickcount.saved') : t('quickcount.saved.offline'))
      }
      navigate('/inventory')
    } catch (err) {
      toast.error(`${t('quickcount.error')} : ${(err as Error).message}`)
    }
  }

  if (!canManageStock(profile)) {
    return (
      <div className="space-y-6 max-w-xl">
        <Link to="/inventory" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('quickcount.back')}
        </Link>
        <p className="text-sm text-muted-foreground">{t('stockcount.no.access')}</p>
      </div>
    )
  }

  const noLots = isLot && lots.length === 0
  const saving = createCount.isPending || updateLot.isPending

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-xl">
      <Link to="/inventory" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t('quickcount.back')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('quickcount.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {isLot ? t('quickcount.desc.lot') : t('quickcount.desc')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="item">{t('quickcount.item')} *</Label>
            <ItemCombobox id="item" items={itemTypes} value={itemTypeId} onChange={onItemChange} loading={isLoading} />
          </div>

          {itemTypeId && currentQty !== undefined && !isLot && (
            <p className="text-xs text-muted-foreground rounded-md border bg-muted/30 px-3 py-2">
              {t('quickcount.current')} : <span className="font-medium">{currentQty} {selectedItem?.unit}</span>
            </p>
          )}

          {/* Lot-tracked: pick a lot and set its remaining quantity */}
          {isLot && (
            noLots ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3">
                <FlaskConical className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-amber-800">{t('quickcount.lot.nolots')}</p>
                  <Link to={`/inventory/items/${itemTypeId}`} className="inline-block mt-1 text-sm font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900">
                    {t('quickcount.lot.goto')} →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>{t('quickcount.lot.select')} *</Label>
                  <Select value={lotId} onValueChange={(v) => { setLotId(v ?? ''); setQuantity('') }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('quickcount.lot.placeholder')}>
                        {(v) => {
                          const l = lots.find((x) => x.id === v)
                          return l ? `${l.manufacturer} · ${t('quickcount.lot.exp')} ${format(parseISO(l.expiry_date), 'MMM yyyy')}${l.lot_number ? ` · ${l.lot_number}` : ''}` : ''
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {lots.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.manufacturer} · {t('quickcount.lot.exp')} {format(parseISO(l.expiry_date), 'MMM yyyy')}{l.lot_number ? ` · ${l.lot_number}` : ''} ({l.quantity_remaining} {t('quickcount.lot.remaining')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedLot && (
                  <div className="space-y-1">
                    <Label htmlFor="lot-qty">
                      {t('quickcount.lot.newqty')} *{selectedItem && <span className="text-muted-foreground font-normal"> ({selectedItem.unit})</span>}
                    </Label>
                    <Input id="lot-qty" type="number" min={0} step={qtyStep(selectedItem?.unit)} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                    <p className="text-xs text-muted-foreground">
                      {t('quickcount.lot.was')} {selectedLot.quantity_remaining} {selectedItem?.unit}
                    </p>
                  </div>
                )}
              </div>
            )
          )}

          {/* Non-lot: baseline count */}
          {!isLot && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="qty">
                    {t('quickcount.qty')} *{selectedItem && <span className="text-muted-foreground font-normal"> ({selectedItem.unit})</span>}
                  </Label>
                  <Input id="qty" type="number" min={0} step={qtyStep(selectedItem?.unit)} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="counted-at">{t('quickcount.date')} *</Label>
                  <Input id="counted-at" type="date" max={todayStr()} value={countedAt} onChange={(e) => setCountedAt(e.target.value)} required />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="counted-by">{t('quickcount.by')}</Label>
                  <Input id="counted-by" value={countedBy} onChange={(e) => setCountedBy(e.target.value)} placeholder={t('quickcount.by.placeholder')} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="notes">{t('quickcount.notes')}</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={t('quickcount.notes.placeholder')} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!noLots && (
        <div className="flex justify-end gap-2">
          <Link to="/inventory" className={cn(buttonVariants({ variant: 'outline' }))}>{t('users.cancel')}</Link>
          <Button type="submit" disabled={saving || (isLot && !lotId)}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {t('quickcount.save')}
          </Button>
        </div>
      )}
    </form>
  )
}
