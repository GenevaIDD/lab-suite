import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { SelectOrNew } from '@/components/ui/SelectOrNew'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useItemType, useDistinctCategories, useDistinctUnits, useItemSources } from '@/lib/queries'
import { useUpdateItemType, useCreateItemSource, useDeleteItemSource, useDeleteItemType } from '@/lib/mutations'
import { useAuth, isAdmin } from '@/lib/auth'
import { useLang } from '@/lib/i18n'
import { STORAGE_CONDITIONS, storageLabel } from '@/lib/storage'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ItemSource, StorageCondition } from '@/types/database'

export function ItemEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLang()
  const { profile } = useAuth()
  const { data: item, isLoading } = useItemType(id)
  const { data: categories = [] } = useDistinctCategories()
  const { data: units = [] } = useDistinctUnits()
  const updateItem = useUpdateItemType()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('')
  const [minThreshold, setMinThreshold] = useState('0')
  const [trackLots, setTrackLots] = useState(false)
  const [storage, setStorage] = useState<string>('')
  const [notes, setNotes] = useState('')

  // Populate once item loads
  useEffect(() => {
    if (item) {
      setName(item.name)
      setCategory(item.category)
      setUnit(item.unit)
      setMinThreshold(String(item.min_threshold))
      setTrackLots(item.track_lots ?? false)
      setStorage(item.storage_condition ?? '')
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
        track_lots: trackLots,
        storage_condition: (storage || null) as StorageCondition | null,
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
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="storage">{t('item.storage.label')}</Label>
              <Select value={storage} onValueChange={(v) => setStorage(v ?? '')}>
                <SelectTrigger id="storage" className="w-full">
                  <SelectValue placeholder={t('item.storage.placeholder')}>
                    {(v) => storageLabel(t, String(v))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_CONDITIONS.map((s) => (
                    <SelectItem key={s} value={s}>{storageLabel(t, s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="space-y-1 sm:col-span-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackLots}
                  onChange={e => setTrackLots(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <div>
                  <p className="text-sm font-medium">Suivi par lot (dates d'expiration)</p>
                  <p className="text-xs text-muted-foreground">
                    Activer pour les réactifs, milieux et diagnostiques avec date d'expiration.
                    Chaque livraison demandera : fabricant (requis), date d'expiration (requise), numéro de lot (optionnel).
                  </p>
                </div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Fabricants / fournisseurs</CardTitle></CardHeader>
        <CardContent>
          <SourcesManager itemTypeId={id!} />
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

      {isAdmin(profile) && (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <DeleteItemDialog itemId={id!} itemName={item.name} />
          </CardContent>
        </Card>
      )}
    </form>
  )
}

function DeleteItemDialog({ itemId, itemName }: { itemId: string; itemName: string }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const deleteItem = useDeleteItemType()

  async function handleDelete() {
    try {
      await deleteItem.mutateAsync(itemId)
      toast.success(t('item.delete.success'))
      navigate('/inventory')
    } catch (err) {
      toast.error(`Erreur : ${(err as Error).message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10"><Trash2 className="h-4 w-4 mr-1" />{t('item.delete.btn')}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('item.delete.title')}</DialogTitle>
        </DialogHeader>
        <div className="py-3 text-sm space-y-2">
          <p className="font-medium">{itemName}</p>
          <p className="text-muted-foreground">{t('item.delete.desc')}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteItem.isPending}>
            {deleteItem.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t('item.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Sources manager (live-save, outside the main form submit) ──────────────

function SourcesManager({ itemTypeId }: { itemTypeId: string }) {
  const { data: sources = [], isLoading } = useItemSources(itemTypeId)
  const createSource = useCreateItemSource()
  const deleteSource = useDeleteItemSource()
  const [manufacturer, setManufacturer] = useState('')
  const [supplier, setSupplier] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!manufacturer.trim()) return
    try {
      await createSource.mutateAsync({
        item_type_id: itemTypeId,
        manufacturer: manufacturer.trim(),
        supplier: supplier.trim() || null,
        notes: null,
      })
      setManufacturer('')
      setSupplier('')
      toast.success('Fabricant ajouté')
    } catch (err) {
      toast.error(`Erreur : ${(err as Error).message}`)
    }
  }

  async function remove(source: ItemSource) {
    if (!confirm(`Supprimer "${source.manufacturer}" ?`)) return
    try {
      await deleteSource.mutateAsync({ id: source.id, itemTypeId })
      toast.success('Fabricant supprimé')
    } catch (err) {
      toast.error(`Erreur : ${(err as Error).message}`)
    }
  }

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />

  return (
    <div className="space-y-3">
      {sources.length > 0 && (
        <ul className="space-y-2">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div className="text-sm">
                <span className="font-medium">{s.manufacturer}</span>
                {s.supplier && <span className="text-muted-foreground"> · via {s.supplier}</span>}
              </div>
              <button
                type="button"
                onClick={() => remove(s)}
                disabled={deleteSource.isPending}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors shrink-0"
                title="Supprimer"
              >
                {deleteSource.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
        <div className="space-y-1">
          <Label htmlFor="src-mfr" className="text-xs">Fabricant</Label>
          <Input
            id="src-mfr"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="ex : Eppendorf"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="src-sup" className="text-xs">Fournisseur (optionnel)</Label>
          <Input
            id="src-sup"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="ex : distributeur local"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={!manufacturer.trim() || createSource.isPending} className="self-end">
          {createSource.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Ajouter
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        Ces fabricants apparaissent dans le formulaire de livraison pour cet article.
      </p>
    </div>
  )
}
