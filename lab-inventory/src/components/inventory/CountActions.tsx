import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Pencil, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { useCorrectStockCount } from '@/lib/mutations'
import { useLang } from '@/lib/i18n'
import { qtyStep } from '@/lib/utils'
import { toast } from 'sonner'
import { writeErrorMessage } from '@/lib/errors'
import type { StockCount } from '@/types/database'

/**
 * Correct a recorded count.
 *
 * `isLatest` decides what the dialog warns about, and it is the whole point
 * of the warning: correcting the newest count for a thing moves the item's
 * displayed stock, correcting an older one changes only history and the burn
 * rate. Without saying so, people fix a number, see nothing happen, and fix
 * it again. The RPC recomputes this server-side -- this is the heads-up, not
 * the authority.
 */
export function CountActions({
  count,
  unit,
  isLatest,
}: {
  count: StockCount
  unit: string
  isLatest: boolean
}) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState(String(count.quantity))
  const [notes, setNotes] = useState(count.notes ?? '')
  const [reason, setReason] = useState('')
  const correct = useCorrectStockCount()

  // A legacy aggregate summarises lots that were never individually
  // recorded, so there is no single number a correction could mean. The DB
  // trigger refuses these too.
  if (count.is_legacy_aggregate) {
    return (
      <span className="text-xs text-muted-foreground" title={t('count.legacy.locked')}>—</span>
    )
  }

  const parsed = Number(quantity)
  const changed = quantity !== '' && parsed !== Number(count.quantity)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (quantity === '' || Number.isNaN(parsed) || parsed < 0) {
      toast.error(t('count.correct.invalid'))
      return
    }
    try {
      const result = await correct.mutateAsync({
        countId: count.id,
        quantity: parsed,
        notes: notes || null,
        reason: reason || null,
      })
      if (!result.corrected) {
        toast.error(t('count.correct.error'))
        return
      }
      toast.success(result.stock_changed ? t('count.corrected.stock') : t('count.corrected.history'))
      setOpen(false)
      setReason('')
    } catch (err) {
      toast.error(`${t('count.correct.error')} : ${writeErrorMessage(err, t)}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="sm" title={t('count.correct')}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      } />
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('count.correct.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {format(parseISO(count.counted_at), 'd MMM yyyy')}
              {count.counted_by ? ` · ${count.counted_by}` : ''}
            </p>

            <div className="space-y-1">
              <Label htmlFor="qty">{t('label.quantity')} ({unit})</Label>
              <Input
                id="qty"
                type="number"
                min={0}
                step={qtyStep(unit)}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            {/* State the consequence before saving, not after. */}
            <div className={`rounded-md border p-3 text-xs ${
              isLatest
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-border bg-muted/40 text-muted-foreground'
            }`}>
              <div className="flex items-start gap-2">
                {isLatest && <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                <p>
                  {isLatest ? t('count.correct.latest') : t('count.correct.older')}
                  {isLatest && changed && (
                    <> {' '}<span className="font-medium tabular-nums">
                      {count.quantity} → {parsed} {unit}
                    </span></>
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="reason">{t('count.correct.reason')}</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('count.correct.reason.ph')}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cnotes">{t('label.notes')}</Label>
              <Textarea id="cnotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('users.cancel')}
            </Button>
            <Button type="submit" disabled={correct.isPending || !changed}>
              {correct.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('count.correct.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
