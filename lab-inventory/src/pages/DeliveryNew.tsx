import { useState, useMemo } from 'react'
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
import { useItemTypes, useItemSources } from '@/lib/queries'
import { useCreateDelivery, useCreateItemSource } from '@/lib/mutations'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function DeliveryNew() {
  const navigate = useNavigate()
  const { data: itemTypes = [], isLoading: loadingTypes } = useItemTypes()
  const createDelivery = useCreateDelivery()

  const [itemTypeId, setItemTypeId] = useState('')
  const [itemSourceId, setItemSourceId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [receivedAt, setReceivedAt] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [receivedBy, setReceivedBy] = useState('')
  const [notes, setNotes] = useState('')

  const { data: sources = [] } = useItemSources(itemTypeId || undefined)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!itemTypeId || !quantity) {
      toast.error('Item and quantity are required')
      return
    }
    try {
      await createDelivery.mutateAsync({
        item_type_id: itemTypeId,
        item_source_id: itemSourceId || null,
        quantity: Number(quantity),
        lot_number: lotNumber || null,
        expiry_date: expiryDate || null,
        received_at: new Date(receivedAt).toISOString(),
        received_by: receivedBy || null,
        notes: notes || null,
      })
      toast.success(navigator.onLine ? 'Delivery logged' : 'Saved offline — will sync when online')
      navigate('/inventory')
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`)
    }
  }

  const selectedItem = useMemo(() => itemTypes.find((i) => i.id === itemTypeId), [itemTypes, itemTypeId])

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <Link to="/inventory" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Inventory
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log new delivery</CardTitle>
          <p className="text-sm text-muted-foreground">Record incoming stock from a supplier.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="item">Item *</Label>
            <Select value={itemTypeId} onValueChange={(v) => { setItemTypeId(v ?? ''); setItemSourceId('') }}>
              <SelectTrigger id="item">
                <SelectValue placeholder={loadingTypes ? 'Loading…' : 'Select an item'}>
                  {(v: string | null) => {
                    const item = itemTypes.find((i) => i.id === v)
                    return item ? `${item.name} (${item.unit})` : ''
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {itemTypes.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} <span className="text-muted-foreground">({i.unit})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loadingTypes && itemTypes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No items registered yet. <Link to="/inventory/new" className="underline">Add one first</Link>.
              </p>
            )}
          </div>

          {itemTypeId && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="source">Manufacturer / source</Label>
                <NewSourceDialog itemTypeId={itemTypeId} onCreated={setItemSourceId} />
              </div>
              <Select value={itemSourceId} onValueChange={(v) => setItemSourceId(v ?? '')}>
                <SelectTrigger id="source">
                  <SelectValue placeholder="Select a manufacturer (optional)">
                    {(v: string | null) => {
                      const s = sources.find((src) => src.id === v)
                      return s ? `${s.manufacturer}${s.supplier ? ` (via ${s.supplier})` : ''}` : ''
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.manufacturer}{s.supplier ? ` (via ${s.supplier})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="qty">Quantity * {selectedItem && <span className="text-muted-foreground font-normal">({selectedItem.unit})</span>}</Label>
              <Input id="qty" type="number" min={0} step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lot">Lot number</Label>
              <Input id="lot" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="exp">Expiry date</Label>
              <Input id="exp" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rec-at">Received on *</Label>
              <Input id="rec-at" type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rec-by">Received by</Label>
              <Input id="rec-by" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Name (optional)" />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link to="/inventory" className={cn(buttonVariants({ variant: 'outline' }))}>Cancel</Link>
        <Button type="submit" disabled={createDelivery.isPending}>
          {createDelivery.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save Delivery
        </Button>
      </div>
    </form>
  )
}

function NewSourceDialog({ itemTypeId, onCreated }: { itemTypeId: string; onCreated: (id: string) => void }) {
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
      toast.success(created ? 'Source added' : 'Saved offline — will sync when online')
      setOpen(false)
      setManufacturer('')
      setSupplier('')
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="xs">
            <Plus className="h-3 w-3 mr-1" />
            New
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add new manufacturer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="new-mfr">Manufacturer</Label>
              <Input id="new-mfr" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-sup">Supplier (optional)</Label>
              <Input id="new-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!manufacturer || createSource.isPending}>
              {createSource.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
