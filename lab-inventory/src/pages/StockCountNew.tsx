import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useItemTypes, useCurrentStock } from '@/lib/queries'
import { useCreateStockCount } from '@/lib/mutations'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

interface StockRow { item_type_id: string; quantity: number }

export function StockCountNew() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: itemTypes = [], isLoading } = useItemTypes()
  const { data: stockRows = [] } = useCurrentStock() as { data: StockRow[] }
  const createCount = useCreateStockCount()

  const [itemTypeId, setItemTypeId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [countedAt, setCountedAt] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [countedBy, setCountedBy] = useState(profile?.full_name ?? '')
  const [notes, setNotes] = useState('')

  const selectedItem = itemTypes.find((i) => i.id === itemTypeId)
  const currentQty = stockRows.find((r) => r.item_type_id === itemTypeId)?.quantity

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!itemTypeId || quantity === '') {
      toast.error('Item and quantity are required')
      return
    }
    try {
      await createCount.mutateAsync({
        item_type_id: itemTypeId,
        quantity: Number(quantity),
        counted_at: new Date(countedAt).toISOString(),
        counted_by: countedBy || null,
        notes: notes || null,
      })
      toast.success(navigator.onLine ? 'Stock count saved' : 'Saved offline — will sync when online')
      navigate('/inventory')
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-xl">
      <Link to="/inventory" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Inventory
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log stock count</CardTitle>
          <p className="text-sm text-muted-foreground">
            Record a physical count. This becomes the new baseline — deliveries after this date will be added on top.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="item">Item *</Label>
            <Select value={itemTypeId} onValueChange={(v) => { setItemTypeId(v ?? ''); setQuantity('') }}>
              <SelectTrigger id="item">
                <SelectValue placeholder={isLoading ? 'Loading…' : 'Select an item'} />
              </SelectTrigger>
              <SelectContent>
                {itemTypes.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {itemTypeId && currentQty !== undefined && (
            <p className="text-xs text-muted-foreground rounded-md border bg-muted/30 px-3 py-2">
              Current stock (before this count): <span className="font-medium">{currentQty} {selectedItem?.unit}</span>
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="qty">
                Counted quantity *{selectedItem && <span className="text-muted-foreground font-normal"> ({selectedItem.unit})</span>}
              </Label>
              <Input
                id="qty"
                type="number"
                min={0}
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="counted-at">Count date *</Label>
              <Input
                id="counted-at"
                type="date"
                value={countedAt}
                onChange={(e) => setCountedAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="counted-by">Counted by</Label>
              <Input
                id="counted-by"
                value={countedBy}
                onChange={(e) => setCountedBy(e.target.value)}
                placeholder="Name"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Discrepancies, damage, expiry concerns…"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link to="/inventory" className={cn(buttonVariants({ variant: 'outline' }))}>Cancel</Link>
        <Button type="submit" disabled={createCount.isPending}>
          {createCount.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save Count
        </Button>
      </div>
    </form>
  )
}
