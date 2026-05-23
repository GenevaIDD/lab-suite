import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Package, AlertTriangle, TrendingDown, Loader2, Edit, TrendingUp } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StockChart, BurnChart } from '@/components/ui/MiniChart'
import { useItemType, useItemCounts, useItemDeliveries, useItemSources, useCurrentStock } from '@/lib/queries'
import { buildTimeline, buildBurnRate, buildAnomalies } from '@/lib/stockCalc'
import { cn } from '@/lib/utils'

function fmt(d: string) { return format(parseISO(d), 'd MMM yyyy') }

// ── Component ─────────────────────────────────────────────────
interface StockRow { item_type_id: string; quantity: number; last_counted_at: string }

export function ItemDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: item, isLoading } = useItemType(id)
  const { data: counts = [] }     = useItemCounts(id)
  const { data: deliveries = [] } = useItemDeliveries(id)
  const { data: sources = [] }    = useItemSources(id)
  const { data: stockRows = [] }  = useCurrentStock() as { data: StockRow[] }

  const currentQty   = useMemo(() => stockRows.find(r => r.item_type_id === id)?.quantity ?? 0, [stockRows, id])
  const lastCounted  = useMemo(() => stockRows.find(r => r.item_type_id === id)?.last_counted_at, [stockRows, id])
  const isLow        = item ? currentQty < item.min_threshold : false
  const timeline     = useMemo(() => buildTimeline(counts, deliveries), [counts, deliveries])
  const burnRates    = useMemo(() => buildBurnRate(counts, deliveries), [counts, deliveries])
  const anomalies    = useMemo(() => buildAnomalies(counts, deliveries), [counts, deliveries])
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
