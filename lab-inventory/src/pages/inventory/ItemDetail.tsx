import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Package, AlertTriangle, TrendingDown, Loader2, Edit, TrendingUp, FlaskConical, Plus, Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StockChart, BurnChart } from '@/components/ui/MiniChart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useItemType, useItemCounts, useItemDeliveries, useItemSources, useCurrentStock, useItemLots, useItemDisposals } from '@/lib/queries'
import { useUpsertLot, useDiscardLot } from '@/lib/mutations'
import { buildTimeline, buildBurnRate, buildAnomalies } from '@/lib/stockCalc'
import { getExpiringLots } from '@/lib/lotCalc'
import { useAuth, isAdmin, canManageStock } from '@/lib/auth'
import { useLang } from '@/lib/i18n'
import { ENABLE_MANUAL_LOT_ENTRY } from '@/lib/flags'
import { cn, qtyStep } from '@/lib/utils'
import { toast } from 'sonner'
import type { InventoryLot, DisposalReason } from '@/types/database'

function fmt(d: string) { return format(parseISO(d), 'd MMM yyyy') }

// ── Component ─────────────────────────────────────────────────
interface StockRow { item_type_id: string; quantity: number; last_counted_at: string }

export function ItemDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const canAddLot = ENABLE_MANUAL_LOT_ENTRY && isAdmin(profile)
  const canDiscard = canManageStock(profile)

  const { data: item, isLoading } = useItemType(id)
  const { data: counts = [] }     = useItemCounts(id)
  const { data: deliveries = [] } = useItemDeliveries(id)
  const { data: disposals = [] }  = useItemDisposals(id)
  const { data: sources = [] }    = useItemSources(id)
  const { data: stockRows = [] }  = useCurrentStock() as { data: StockRow[] }
  const { data: activeLots = [] } = useItemLots(id)
  const { data: allLots = [] }    = useItemLots(id, true)  // including exhausted

  const currentQty   = useMemo(() => stockRows.find(r => r.item_type_id === id)?.quantity ?? 0, [stockRows, id])
  const lastCounted  = useMemo(() => stockRows.find(r => r.item_type_id === id)?.last_counted_at, [stockRows, id])
  const isLow        = item ? currentQty < item.min_threshold : false
  const timeline     = useMemo(() => buildTimeline(counts, deliveries), [counts, deliveries])
  const burnRates    = useMemo(() => buildBurnRate(counts, deliveries, disposals), [counts, deliveries, disposals])
  const anomalies    = useMemo(() => buildAnomalies(counts, deliveries, disposals), [counts, deliveries, disposals])
  const expiringLots = useMemo(() => getExpiringLots(activeLots, 60), [activeLots])
  const avgBurnRate  = useMemo(() => {
    if (!burnRates.length) return null
    return Math.round(burnRates.reduce((s, r) => s + r.burnRate, 0) / burnRates.length * 100) / 100
  }, [burnRates])
  const daysRemaining = avgBurnRate && avgBurnRate > 0 ? Math.round(currentQty / avgBurnRate) : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!item) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Article introuvable.</CardContent></Card>
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/inventory" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Inventaire
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-semibold">{item.name}</h2>
            <Badge variant="secondary">{item.category}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Unité : {item.unit}</p>
        </div>
        <Link to={`/inventory/items/${id}/edit`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
          <Edit className="h-4 w-4 mr-1" />
          Modifier
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Stock actuel" value={`${currentQty} ${item.unit}`}
          sub={lastCounted ? `Compté ${fmt(lastCounted)}` : 'Jamais compté'} urgent={isLow} />
        <StatCard label="Seuil minimum" value={`${item.min_threshold} ${item.unit}`} />
        <StatCard label="Taux moyen" value={avgBurnRate !== null ? `${avgBurnRate} / j` : '—'}
          sub={burnRates.length < 2 ? 'Pas assez de données' : `${burnRates.length} période${burnRates.length > 1 ? 's' : ''}`} />
        <StatCard label="Jours restants" value={daysRemaining !== null ? `${daysRemaining} j` : '—'}
          urgent={daysRemaining !== null && daysRemaining < 30}
          sub={daysRemaining !== null && daysRemaining < 30 ? 'À commander bientôt' : undefined} />
      </div>

      {isLow && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Stock en-dessous du seuil minimum ({item.min_threshold} {item.unit})
        </div>
      )}

      {/* Lot breakdown — only for tracked items */}
      {item.track_lots && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              Lots actifs
              {expiringLots.length > 0 && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                  {expiringLots.length} expire{expiringLots.length > 1 ? 'nt' : ''} bientôt
                </Badge>
              )}
              {canAddLot && id && (
                <div className="ml-auto">
                  <AddLotDialog itemTypeId={id} unit={item.unit} />
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activeLots.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 py-4">
                {canAddLot
                  ? 'Aucun lot actif — ajoutez un lot ci-dessus ou enregistrez une livraison.'
                  : 'Aucun lot actif — enregistrez une livraison pour créer des lots.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fabricant</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>N° lot</TableHead>
                    <TableHead className="text-right">Qté restante</TableHead>
                    <TableHead>Statut</TableHead>
                    {canDiscard && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeLots.map(lot => (
                    <LotRow key={lot.id} lot={lot} unit={item.unit} canDiscard={canDiscard} disposedBy={profile?.full_name ?? null} />
                  ))}
                </TableBody>
              </Table>
            )}
            {allLots.filter(l => l.exhausted_at !== null).length > 0 && (
              <p className="text-xs text-muted-foreground px-4 py-2 border-t">
                {allLots.filter(l => l.exhausted_at !== null).length} lot(s) épuisé(s) non affichés.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stock chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Stock au fil du temps</CardTitle></CardHeader>
        <CardContent>
          {timeline.length === 0
            ? <Empty text="Aucun comptage enregistré pour cet article." />
            : <StockChart data={timeline} minThreshold={item.min_threshold} />}
        </CardContent>
      </Card>

      {/* Burn rate chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            Taux de consommation par période
          </CardTitle>
        </CardHeader>
        <CardContent>
          {burnRates.length === 0
            ? <Empty text="Au moins deux comptages sont nécessaires pour calculer le taux de consommation." />
            : <BurnChart data={burnRates} avgRate={avgBurnRate} unit={item.unit} />}
        </CardContent>
      </Card>

      {/* Sources */}
      {sources.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Fabricants / fournisseurs</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sources.map(s => (
                <Badge key={s.id} variant="secondary">
                  {s.manufacturer}{s.supplier ? ` — ${s.supplier}` : ''}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery history */}
      <Card>
        <CardHeader><CardTitle className="text-base">Historique des livraisons</CardTitle></CardHeader>
        <CardContent className="p-0">
          {deliveries.length === 0
            ? <div className="py-8 text-center text-sm text-muted-foreground">Aucune livraison enregistrée.</div>
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Fabricant</TableHead>
                    <TableHead>N° lot</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Reçu par</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...deliveries].reverse().map(d => (
                    <TableRow key={d.id}>
                      <TableCell>{fmt(d.received_at)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{d.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">{d.item_source?.manufacturer ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{d.lot_number ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{d.expiry_date ? fmt(d.expiry_date) : '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{d.received_by ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      {/* Count history */}
      <Card>
        {anomalies.length > 0 && (
          <div className="mx-4 mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-800">
              <TrendingUp className="h-4 w-4 shrink-0" />
              <p className="text-xs font-semibold">
                {anomalies.length === 1
                  ? 'Augmentation inexpliquée détectée'
                  : `${anomalies.length} augmentations inexpliquées détectées`}
              </p>
            </div>
            {anomalies.map((a, i) => (
              <p key={i} className="text-xs text-amber-700 pl-6">
                Le {fmt(a.countDate)} : +{a.unexplained} {item?.unit} sans livraison enregistrée
                {a.deliveriesBetween > 0 ? ` (${a.deliveriesBetween} reçu, mais stock augmente quand même)` : ''}.
                Vérifiez si une livraison n'a pas été saisie.
              </p>
            ))}
          </div>
        )}
        <CardHeader><CardTitle className="text-base">Historique des comptages</CardTitle></CardHeader>
        <CardContent className="p-0">
          {counts.length === 0
            ? <div className="py-8 text-center text-sm text-muted-foreground">Aucun comptage enregistré.</div>
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Compté par</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...counts].reverse().map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{fmt(c.counted_at)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{c.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">{c.counted_by ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{c.notes ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      {item.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{item.notes}</p></CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, urgent }: { label: string; value: string; sub?: string; urgent?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-xl font-bold mt-0.5', urgent ? 'text-destructive' : '')}>{value}</p>
        {sub && <p className={cn('text-xs mt-1', urgent ? 'text-destructive' : 'text-muted-foreground')}>{sub}</p>}
      </CardContent>
    </Card>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
      <Package className="h-8 w-8 opacity-20" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

function AddLotDialog({ itemTypeId, unit }: { itemTypeId: string; unit: string }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [manufacturer, setManufacturer] = useState('')
  const [expiry, setExpiry] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [qty, setQty] = useState('')
  const upsert = useUpsertLot()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!manufacturer.trim() || !expiry || qty === '') { toast.error(t('lot.add.required')); return }
    try {
      await upsert.mutateAsync({
        item_type_id: itemTypeId,
        delivery_id: null,
        manufacturer: manufacturer.trim(),
        expiry_date: expiry,
        lot_number: lotNumber.trim() || null,
        quantity_initial: Number(qty),
        quantity_remaining: Number(qty),
      })
      toast.success(t('lot.add.success'))
      setOpen(false)
      setManufacturer(''); setExpiry(''); setLotNumber(''); setQty('')
    } catch (err) {
      toast.error(`${t('lot.add.error')} : ${(err as Error).message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />{t('lot.add.btn')}</Button>} />
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>{t('lot.add.title')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-sm text-muted-foreground">{t('lot.add.desc')}</p>
            <div className="space-y-1">
              <Label htmlFor="lot-mfr">{t('lot.add.manufacturer')}</Label>
              <Input id="lot-mfr" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="lot-exp">{t('lot.add.expiry')}</Label>
                <Input id="lot-exp" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lot-num">{t('lot.add.number')}</Label>
                <Input id="lot-num" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lot-qty">{t('lot.add.qty')}{unit ? ` (${unit})` : ''}</Label>
              <Input id="lot-qty" type="number" min={0} step={qtyStep(unit)} value={qty} onChange={(e) => setQty(e.target.value)} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('users.cancel')}</Button>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('lot.add.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LotRow({ lot, unit, canDiscard, disposedBy }: { lot: InventoryLot; unit: string; canDiscard: boolean; disposedBy: string | null }) {
  const today = new Date().toISOString().slice(0, 10)
  const daysUntil = Math.ceil((new Date(lot.expiry_date).getTime() - new Date(today).getTime()) / 86400000)
  const expired  = daysUntil < 0
  const expiring = !expired && daysUntil <= 60

  return (
    <TableRow>
      <TableCell className="font-medium">{lot.manufacturer}</TableCell>
      <TableCell className={cn('tabular-nums', expired ? 'text-destructive' : expiring ? 'text-amber-600' : 'text-muted-foreground')}>
        {format(parseISO(lot.expiry_date), 'd MMM yyyy')}
        {expired  && <span className="ml-1 text-xs">(expiré)</span>}
        {expiring && !expired && <span className="ml-1 text-xs">(dans {daysUntil}j)</span>}
      </TableCell>
      <TableCell className="text-muted-foreground">{lot.lot_number ?? '—'}</TableCell>
      <TableCell className="text-right font-semibold tabular-nums">{lot.quantity_remaining} {unit}</TableCell>
      <TableCell>
        {expired
          ? <Badge variant="destructive" className="text-xs">Expiré</Badge>
          : expiring
          ? <Badge className="text-xs bg-amber-500 hover:bg-amber-500/90">Expire bientôt</Badge>
          : <Badge variant="outline" className="text-xs">OK</Badge>}
      </TableCell>
      {canDiscard && (
        <TableCell className="text-right">
          <DiscardLotDialog lot={lot} unit={unit} disposedBy={disposedBy} />
        </TableCell>
      )}
    </TableRow>
  )
}

const DISPOSAL_REASONS: DisposalReason[] = ['expired', 'damaged', 'contaminated', 'other']

function DiscardLotDialog({ lot, unit, disposedBy }: { lot: InventoryLot; unit: string; disposedBy: string | null }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<DisposalReason>('expired')
  const discard = useDiscardLot()

  async function submit() {
    try {
      await discard.mutateAsync({
        lotId: lot.id,
        itemTypeId: lot.item_type_id,
        quantity: lot.quantity_remaining,
        reason,
        disposedBy,
      })
      toast.success(t('disposal.success'))
      setOpen(false)
    } catch (err) {
      toast.error(`${t('disposal.error')} : ${(err as Error).message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" title={t('disposal.btn')}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      } />
      <DialogContent>
        <DialogHeader><DialogTitle>{t('disposal.title')}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-3">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span className="font-medium">{lot.manufacturer}</span>
            {lot.lot_number && <span className="text-muted-foreground"> · {lot.lot_number}</span>}
            <span className="text-muted-foreground"> · {t('disposal.qty')} {lot.quantity_remaining} {unit}</span>
          </div>
          <p className="text-sm text-muted-foreground">{t('disposal.desc')}</p>
          <div className="space-y-1">
            <Label>{t('disposal.reason')}</Label>
            <Select value={reason} onValueChange={(v) => setReason((v ?? 'expired') as DisposalReason)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v) => t(`disposal.reason.${String(v)}` as never)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DISPOSAL_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{t(`disposal.reason.${r}` as never)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('users.cancel')}</Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={discard.isPending}>
            {discard.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t('disposal.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
