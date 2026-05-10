import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export interface ScheduleDraft {
  label: string
  interval_days: number
  lead_days: number
  next_due: string
}

interface Props {
  schedules: ScheduleDraft[]
  onChange: (schedules: ScheduleDraft[]) => void
}

export function MaintenanceScheduleEditor({ schedules, onChange }: Props) {
  const [draft, setDraft] = useState<ScheduleDraft>({
    label: '',
    interval_days: 90,
    lead_days: 60,
    next_due: '',
  })

  function add() {
    if (!draft.label || !draft.next_due) return
    onChange([...schedules, draft])
    setDraft({ label: '', interval_days: 90, lead_days: 60, next_due: '' })
  }

  function remove(idx: number) {
    onChange(schedules.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      {schedules.length > 0 && (
        <div className="space-y-2">
          {schedules.map((s, idx) => (
            <Card key={idx}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">
                    every {s.interval_days} days · alert {s.lead_days} days before · next: {s.next_due}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(idx)} aria-label="Remove schedule">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="space-y-3 py-4">
          <p className="text-xs font-medium text-muted-foreground">Add a maintenance schedule</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ms-label" className="text-xs">Label</Label>
              <Input
                id="ms-label"
                placeholder="e.g. Quarterly filter clean"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ms-next-due" className="text-xs">First due date</Label>
              <Input
                id="ms-next-due"
                type="date"
                value={draft.next_due}
                onChange={(e) => setDraft({ ...draft, next_due: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ms-interval" className="text-xs">Repeats every (days)</Label>
              <Input
                id="ms-interval"
                type="number"
                min={1}
                value={draft.interval_days}
                onChange={(e) => setDraft({ ...draft, interval_days: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ms-lead" className="text-xs">Alert lead time (days)</Label>
              <Input
                id="ms-lead"
                type="number"
                min={0}
                value={draft.lead_days}
                onChange={(e) => setDraft({ ...draft, lead_days: Number(e.target.value) })}
              />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={!draft.label || !draft.next_due}>
            <Plus className="h-4 w-4 mr-1" />
            Add Schedule
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
