import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PhotoUpload } from '@/components/equipment/PhotoUpload'
import { MaintenanceScheduleEditor, type ScheduleDraft } from '@/components/equipment/MaintenanceScheduleEditor'
import { useCreateEquipment, useCreateMaintenanceSchedule } from '@/lib/mutations'
import { toast } from 'sonner'
import type { Lab, Currency } from '@/types/database'
import { CURRENCIES } from '@/types/database'
import { cn } from '@/lib/utils'

interface FormState {
  name: string
  category: string
  serial_number: string
  lab: Lab
  supplier: string
  vendor_contact: string
  purchase_date: string
  warranty_expiry: string
  cost: string
  currency: Currency
  notes: string
  photo_urls: string[]
}

const initialForm: FormState = {
  name: '',
  category: '',
  serial_number: '',
  lab: 'lab_1',
  supplier: '',
  vendor_contact: '',
  purchase_date: '',
  warranty_expiry: '',
  cost: '',
  currency: 'USD',
  notes: '',
  photo_urls: [],
}

export function EquipmentNew() {
  const navigate = useNavigate()
  const createEquipment = useCreateEquipment()
  const createSchedule = useCreateMaintenanceSchedule()

  const [form, setForm] = useState<FormState>(initialForm)
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.category) {
      toast.error('Name and category are required')
      return
    }

    try {
      const equipment = await createEquipment.mutateAsync({
        name: form.name,
        category: form.category,
        serial_number: form.serial_number || null,
        lab: form.lab,
        supplier: form.supplier || null,
        vendor_contact: form.vendor_contact || null,
        purchase_date: form.purchase_date || null,
        warranty_expiry: form.warranty_expiry || null,
        cost: form.cost ? Number(form.cost) : null,
        currency: form.cost ? form.currency : null,
        notes: form.notes || null,
        photo_urls: form.photo_urls,
      })

      if (equipment?.id && schedules.length > 0) {
        await Promise.all(
          schedules.map((s) =>
            createSchedule.mutateAsync({
              equipment_id: equipment.id,
              label: s.label,
              interval_days: s.interval_days,
              lead_days: s.lead_days,
              next_due: s.next_due,
            }),
          ),
        )
      }

      toast.success(equipment ? 'Equipment registered' : 'Saved offline — will sync when online')
      navigate('/equipment')
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`)
    }
  }

  const submitting = createEquipment.isPending || createSchedule.isPending

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      <Link to="/equipment" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Equipment
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label="Name *" value={form.name} onChange={(v) => update('name', v)} placeholder="e.g. Eppendorf Centrifuge 5810" required />
            <Field id="category" label="Category *" value={form.category} onChange={(v) => update('category', v)} placeholder="e.g. Centrifuge" required />
            <Field id="serial" label="Serial number" value={form.serial_number} onChange={(v) => update('serial_number', v)} />
            <div className="space-y-1">
              <Label htmlFor="lab">Lab *</Label>
              <Select value={form.lab} onValueChange={(v) => update('lab', v as Lab)}>
                <SelectTrigger id="lab">
                  <SelectValue>{(v: string | null) => (v === 'lab_2' ? 'Lab 2' : 'Lab 1')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lab_1">Lab 1</SelectItem>
                  <SelectItem value="lab_2">Lab 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Procurement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="supplier" label="Supplier / vendor" value={form.supplier} onChange={(v) => update('supplier', v)} />
            <Field id="contact" label="Vendor contact" value={form.vendor_contact} onChange={(v) => update('vendor_contact', v)} placeholder="email or phone" />
            <Field id="purchase" label="Purchase date" type="date" value={form.purchase_date} onChange={(v) => update('purchase_date', v)} />
            <Field id="warranty" label="Warranty expires" type="date" value={form.warranty_expiry} onChange={(v) => update('warranty_expiry', v)} />
            <div className="space-y-1">
              <Label htmlFor="cost">Cost</Label>
              <div className="flex gap-2">
                <Input
                  id="cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => update('cost', e.target.value)}
                  className="flex-1"
                />
                <Select value={form.currency} onValueChange={(v) => update('currency', (v ?? 'USD') as Currency)}>
                  <SelectTrigger className="w-28 shrink-0">
                    <SelectValue>{(v: string | null) => v ?? 'USD'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} <span className="text-muted-foreground">— {c.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoUpload photos={form.photo_urls} onChange={(p) => update('photo_urls', p)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maintenance schedules</CardTitle>
        </CardHeader>
        <CardContent>
          <MaintenanceScheduleEditor schedules={schedules} onChange={setSchedules} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Any additional details..."
            rows={4}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link to="/equipment" className={cn(buttonVariants({ variant: 'outline' }))}>Cancel</Link>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save Equipment
        </Button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}
