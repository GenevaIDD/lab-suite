import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export interface SourceDraft {
  manufacturer: string
  supplier: string
}

interface Props {
  sources: SourceDraft[]
  onChange: (sources: SourceDraft[]) => void
}

export function SourceEditor({ sources, onChange }: Props) {
  const [draft, setDraft] = useState<SourceDraft>({ manufacturer: '', supplier: '' })

  function add() {
    if (!draft.manufacturer) return
    onChange([...sources, draft])
    setDraft({ manufacturer: '', supplier: '' })
  }

  function remove(idx: number) {
    onChange(sources.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      {sources.length > 0 && (
        <div className="space-y-2">
          {sources.map((s, idx) => (
            <Card key={idx}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-medium">{s.manufacturer}</p>
                  {s.supplier && <p className="text-xs text-muted-foreground">via {s.supplier}</p>}
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(idx)} aria-label="Remove source">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="space-y-3 py-4">
          <p className="text-xs font-medium text-muted-foreground">Add a manufacturer / supplier</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="src-mfr" className="text-xs">Manufacturer</Label>
              <Input
                id="src-mfr"
                placeholder="e.g. Eppendorf"
                value={draft.manufacturer}
                onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="src-sup" className="text-xs">Supplier (optional)</Label>
              <Input
                id="src-sup"
                placeholder="e.g. local distributor"
                value={draft.supplier}
                onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}
              />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={!draft.manufacturer}>
            <Plus className="h-4 w-4 mr-1" />
            Add Source
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Stock is pooled across all sources for this item type. Sources are recorded per delivery.
      </p>
    </div>
  )
}
