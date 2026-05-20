import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectOrNew } from '@/components/ui/SelectOrNew'
import { useItemType, useDistinctCategories, useDistinctUnits } from '@/lib/queries'
import { useUpdateItemType } from '@/lib/mutations'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function ItemEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: item, isLoading } = useItemType(id)
  const { data: categories = [] } = useDistinctCategories()
  const { data: units = [] } = useDistinctUnits()
  const updateItem = useUpdateItemType()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('')
  const [minThreshold, setMinThreshold] = useState('0')
  const [notes, setNotes] = useState('')

  // Populate once item loads
  useEffect(() => {
    if (item) {
      setName(item.name)
      setCategory(item.category)
      setUnit(item.unit)
      setMinThreshold(String(item.min_threshold))
      setNotes(item.notes ?? '')
    }
  }, [item])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !name || !category || !unit) {
      toast.error('Nom, catégorie et unité sont requis')
      return
    }
    try {
      await updateItem.mutateAsync({
        id,
        name,
        category,
        unit,
        min_threshold: Number(minThreshold) || 0,
        notes: notes || null,
      })
      toast.success('Article mis à jour')
      navigate(`/inventory/items/${id}`)
    } catch (err) {
      toast.error(`Erreur : ${(err as Error).message}`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!item) {
    return <p className="text-sm text-muted-foreground">Article introuvable.</p>
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <Link to={`/inventory/items/${id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Retour à l'article
      </Link>

      <div>
        <h2 className="text-xl font-semibold">Modifier l'article</h2>
        <p className="text-sm text-muted-foreground mt-1">{item.name}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Détails</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="name">Nom *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Catégorie *</Label>
              <SelectOrNew
                value={category}
                onChange={setCategory}
                options={categories}
                placeholder="Sélectionner ou ajouter…"
              />
            </div>
            <div className="space-y-1">
              <Label>Unité *</Label>
              <SelectOrNew
                value={unit}
                onChange={setUnit}
                options={units}
                placeholder="Sélectionner ou ajouter…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="min">Seuil minimum de stock</Label>
              <Input
                id="min"
                type="number"
                min={0}
                step="0.01"
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Remarques</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Observations, précisions…"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link to={`/inventory/items/${id}`} className={cn(buttonVariants({ variant: 'outline' }))}>
          Annuler
        </Link>
        <Button type="submit" disabled={updateItem.isPending}>
          {updateItem.isPending
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <Save className="h-4 w-4 mr-1" />}
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
