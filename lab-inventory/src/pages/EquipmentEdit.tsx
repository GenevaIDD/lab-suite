import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PhotoUpload } from '@/components/equipment/PhotoUpload'
import { useEquipment } from '@/lib/queries'
import { useUpdateEquipment } from '@/lib/mutations'
import { useAuth, isAdmin } from '@/lib/auth'
import { CURRENCIES } from '@/types/database'
import type { Currency } from '@/types/database'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function EquipmentEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const admin = isAdmin(profile)
  const { data: equipment, isLoading } = useEquipment(id)
  const updateEquipment = useUpdateEquipment()

  const [name, setName]                     = useState('')
  const [category, setCategory]             = useState('')
  const [manufacturer, setManufacturer]     = useState('')
  const [model, setModel]                   = useState('')
  const [serialNumber, setSerialNumber]     = useState('')
  const [supplier, setSupplier]             = useState('')
  const [vendorContact, setVendorContact]   = useState('')
  const [purchaseDate, setPurchaseDate]     = useState('')
  const [installedAt, setInstalledAt]       = useState('')
  const [warrantyExpiry, setWarrantyExpiry] = useState('')
  const [cost, setCost]                     = useState('')
  const [currency, setCurrency]             = useState<Currency>('USD')
  const [notes, setNotes]                   = useState('')
  const [photoUrls, setPhotoUrls]           = useState<string[]>([])

  useEffect(() => {
    if (!equipment) return
    setName(equipment.name)
    setCategory(equipment.category)
    setManufacturer(equipment.manufacturer ?? '')
    setModel(equipment.model ?? '')
    setSerialNumber(equipment.serial_number ?? '')
    setSupplier(equipment.supplier ?? '')
    setVendorContact(equipment.vendor_contact ?? '')
    setPurchaseDate(equipment.purchase_date ?? '')
    setInstalledAt(equipment.installed_at ?? '')
    setWarrantyExpiry(equipment.warranty_expiry ?? '')
    setCost(equipment.cost ? String(equipment.cost) : '')
    setCurrency((equipment.currency as Currency) ?? 'USD')
    setNotes(equipment.notes ?? '')
    setPhotoUrls(equipment.photo_urls ?? [])
  }, [equipment])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !name || !category) {
      toast.error('Nom et catégorie sont requis')
      return
    }
    try {
      await updateEquipment.mutateAsync({
        id,
        name,
        category,
        manufacturer: manufacturer || null,
        model: model || null,
        serial_number: serialNumber || null,
        supplier: supplier || null,
        vendor_contact: vendorContact || null,
        purchase_date: purchaseDate || null,
        installed_at: installedAt || null,
        warranty_expiry: warrantyExpiry || null,
        cost: cost ? Number(cost) : null,
        currency: cost ? currency : null,
        notes: notes || null,
        photo_urls: photoUrls,
      })
      toast.success('Équipement mis à jour')
      navigate(`/equipment/${id}`)
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

  if (!equipment) {
    return <p className="text-sm text-muted-foreground">Équipement introuvable.</p>
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      <Link to={`/equipment/${id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Retour à l'équipement
      </Link>

      <div>
        <h2 className="text-xl font-semibold">Modifier l'équipement</h2>
        <p className="text-sm text-muted-foreground mt-1">{equipment.name}</p>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Informations générales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label="Nom *" value={name} onChange={setName} required />
            <Field id="category" label="Catégorie *" value={category} onChange={setCategory} required />
            <Field id="manufacturer" label="Fabricant" value={manufacturer} onChange={setManufacturer} placeholder="ex : Eppendorf" />
            <Field id="model" label="Modèle" value={model} onChange={setModel} placeholder="ex : 5810 R" />
            <Field id="serial" label="Numéro de série" value={serialNumber} onChange={setSerialNumber} />
          </div>
        </CardContent>
      </Card>

      {/* Procurement */}
      <Card>
        <CardHeader><CardTitle className="text-base">Approvisionnement</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="supplier" label="Fournisseur" value={supplier} onChange={setSupplier} />
            <Field id="contact" label="Contact fournisseur" value={vendorContact} onChange={setVendorContact} placeholder="email ou téléphone" />
            <Field id="purchase" label="Date d'achat" type="date" value={purchaseDate} onChange={setPurchaseDate} />
            <Field id="installed" label="Date d'installation" type="date" value={installedAt} onChange={setInstalledAt} />
            <Field id="warranty" label="Garantie expire le" type="date" value={warrantyExpiry} onChange={setWarrantyExpiry} />
            {admin && (
              <div className="space-y-1">
                <Label htmlFor="cost">Coût</Label>
                <div className="flex gap-2">
                  <Input id="cost" type="number" min={0} step="0.01" value={cost}
                    onChange={e => setCost(e.target.value)} className="flex-1" />
                  <Select value={currency} onValueChange={v => setCurrency((v ?? 'USD') as Currency)}>
                    <SelectTrigger className="w-28 shrink-0">
                      <SelectValue>{(v: string | null) => v ?? 'USD'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} <span className="text-muted-foreground">— {c.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Photos</CardTitle></CardHeader>
        <CardContent>
          <PhotoUpload photos={photoUrls} onChange={setPhotoUrls} />
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={4} placeholder="Observations, détails supplémentaires…" />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link to={`/equipment/${id}`} className={cn(buttonVariants({ variant: 'outline' }))}>Annuler</Link>
        <Button type="submit" disabled={updateEquipment.isPending}>
          {updateEquipment.isPending
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <Save className="h-4 w-4 mr-1" />}
          Enregistrer
        </Button>
      </div>
    </form>
  )
}

function Field({ id, label, value, onChange, type = 'text', placeholder, required }: {
  id: string; label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required} />
    </div>
  )
}
