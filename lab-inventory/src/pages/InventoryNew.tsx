import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, AlertTriangle, ExternalLink } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectOrNew } from '@/components/ui/SelectOrNew'
import { SourceEditor, type SourceDraft } from '@/components/inventory/SourceEditor'
import { useCreateItemType, useCreateItemSource } from '@/lib/mutations'
import { useDistinctCategories, useDistinctUnits, useItemTypes } from '@/lib/queries'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { findSimilar } from '@/lib/similarity'

// ── Component ─────────────────────────────────────────────────

export function InventoryNew() {
  const navigate = useNavigate()
  const createItem = useCreateItemType()
  const createSource = useCreateItemSource()

  const { data: categories = [] } = useDistinctCategories()
  const { data: units = [] }      = useDistinctUnits()
  const { data: allItems = [] }   = useItemTypes()

  const [name, setName]               = useState('')
  const [category, setCategory]       = useState('')
  const [unit, setUnit]               = useState('')
  const [minThreshold, setMinThreshold] = useState('0')
  const [notes, setNotes]             = useState('')
  const [sources, setSources]         = useState<SourceDraft[]>([])
  const [dismissed, setDismissed]     = useState(false)

  // Reset dismissed when name changes significantly
  function handleNameChange(v: string) {
    setName(v)
    setDismissed(false)
  }

  const similar = useMemo(
    () => dismissed ? [] : findSimilar(name, allItems),
    [name, allItems, dismissed],
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !category || !unit) {
      toast.error('Nom, catégorie et unité sont requis')
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
      toast.success(item ? 'Article créé' : 'Sauvegardé hors ligne')
      navigate('/inventory')
    } catch (err) {
      toast.error(`Erreur : ${(err as Error).message}`)
    }
  }

  const submitting = createItem.isPending || createSource.isPending

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      <Link to="/inventory" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Retour à l'inventaire
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails de l'article</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Name field + similarity warning */}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="ex: Cryotubes 2 mL"
                required
              />

              {/* Similarity panel */}
              {similar.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2 mt-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <p className="text-xs font-medium">
                        {similar.length === 1
                          ? 'Un article similaire existe déjà — vérifiez avant de créer :'
                          : `${similar.length} articles similaires existent déjà — vérifiez avant de créer :`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDismissed(true)}
                      className="text-xs text-amber-600 hover:text-amber-800 shrink-0"
                    >
                      Ignorer
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {similar.map(it => (
                      <li key={it.id}>
                        <Link
                          to={`/inventory/items/${it.id}`}
                          target="_blank"
                          className="flex items-center gap-2 text-xs rounded px-2 py-1.5 hover:bg-amber-100 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3 text-amber-600 shrink-0" />
                          <span className="font-medium text-amber-900">{it.name}</span>
                          <span className="text-amber-600">— {it.category}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-600 pl-1">
                    Si c'est un article différent (ex: même nom, catégorie différente), ignorez cette alerte et continuez.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="category">Catégorie *</Label>
              <SelectOrNew
                id="category"
                value={category}
                onChange={setCategory}
                options={categories}
                placeholder="Sélectionner ou ajouter…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit">Unité *</Label>
              <SelectOrNew
                id="unit"
                value={unit}
                onChange={setUnit}
                options={units}
                placeholder="Sélectionner ou ajouter…"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="min">Seuil minimum de stock</Label>
              <Input
                id="min"
                type="number"
                min={0}
                step="1"
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Une alerte email est envoyée quand le stock total tombe en dessous de ce seuil.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fabricants / fournisseurs</CardTitle>
        </CardHeader>
        <CardContent>
          <SourceEditor sources={sources} onChange={setSources} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Remarques</CardTitle>
        </CardHeader>
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
        <Link to="/inventory" className={cn(buttonVariants({ variant: 'outline' }))}>
          Annuler
        </Link>
        <Button type="submit" disabled={submitting}>
          {submitting
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <Save className="h-4 w-4 mr-1" />}
          Enregistrer l'article
        </Button>
      </div>
    </form>
  )
}
