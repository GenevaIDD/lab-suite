import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SourceEditor, type SourceDraft } from '@/components/inventory/SourceEditor'
import { useCreateItemType, useCreateItemSource } from '@/lib/mutations'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function InventoryNew() {
  const navigate = useNavigate()
  const createItem = useCreateItemType()
  const createSource = useCreateItemSource()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('')
  const [minThreshold, setMinThreshold] = useState('0')
  const [notes, setNotes] = useState('')
  const [sources, setSources] = useState<SourceDraft[]>([])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !category || !unit) {
      toast.error('Name, category, and unit are required')
      return
    }
    try {
      const item = await createItem.mutateAsync({
        name,
        category,
        unit,
        min_threshold: Number(minThreshold) || 0,
        low_stock_alerted_at: null,
        notes: notes || null,
      })
      if (item?.id && sources.length > 0) {
        await Promise.all(
          sources.map((s) =>
            createSource.mutateAsync({
              item_type_id: item.id,
              manufacturer: s.manufacturer,
              supplier: s.supplier || null,
              notes: null,
            }),
          ),
        )
      }
      toast.success(item ? 'Item created' : 'Saved offline — will sync when online')
      navigate('/inventory')
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`)
    }
  }

  const submitting = createItem.isPending || createSource.isPending

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      <Link to="/inventory" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Inventory
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Item details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2µL cryotubes" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category">Category *</Label>
              <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. consumables, reagents, PPE" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit">Unit *</Label>
              <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. boxes, mL, units" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="min">Minimum stock threshold</Label>
              <Input id="min" type="number" min={0} step="0.01" value={minThreshold} onChange={(e) => setMinThreshold(e.target.value)} />
              <p className="text-xs text-muted-foreground">Email alert fires when total stock drops below this.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manufacturers / suppliers</CardTitle>
        </CardHeader>
        <CardContent>
          <SourceEditor sources={sources} onChange={setSources} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any additional details..." />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link to="/inventory" className={cn(buttonVariants({ variant: 'outline' }))}>Cancel</Link>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save Item
        </Button>
      </div>
    </form>
  )
}
