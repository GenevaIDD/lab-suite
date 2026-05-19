import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ArrowLeft, Package, AlertTriangle, TrendingDown, Loader2, Edit } from 'lucide-react'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useItemType, useItemCounts, useItemDeliveries, useItemSources, useCurrentStock } from '@/lib/queries'
import { cn } from '@/lib/utils'

interface StockRow { item_type_id: string; quantity: number; last_counted_at: string }

// ── helpers ──────────────────────────────────────────────────
function fmt(d: string) { return format(parseISO(d), 'd MMM yyyy') }
function fmtShort(d: string) { return format(parseISO(d), 'MMM yy') }

/** Build a timeline merging counts + deliveries, sorted by date */
function buildTimeline(
  counts: Array<{ quantity: number; counted_at: string }>,
  deliveries: Array<{ quantity: number; received_at: string }>,
) {
  type Point = { date: string; countQty?: number; deliveryQty?: number }
  const map = new Map<string, Point>()

  for (const c of counts) {
    const d = c.counted_at.slice(0, 10)
    map.set(d, { ...map.get(d), date: d, countQty: c.quantity })
  }
  for (const d of deliveries) {
    const day = d.received_at.slice(0, 10)
    const prev = map.get(day) ?? { date: day }
    map.set(day, { ...prev, deliveryQty: (prev.deliveryQty ?? 0) + d.quantity })
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Compute burn rate per period between consecutive counts */
function buildBurnRate(
  counts: Array<{ quantity: number; counted_at: string }>,
  deliveries: Array<{ quantity: number; received_at: string }>,
) {
  if (counts.length < 2) return []
  const periods = []
  for (let i = 1; i < counts.length; i++) {
    const prev = counts[i - 1]
    const curr = counts[i]
    const start = prev.counted_at.slice(0, 10)
    const end   = curr.counted_at.slice(0, 10)
    const days  = differenceInDays(parseISO(end), parseISO(start))
    if (days <= 0) continue

    const deliveriesBetween = deliveries
      .filter(d => d.received_at.slice(0, 10) > start && d.received_at.slice(0, 10) <= end)
      .reduce((sum, d) => sum + d.quantity, 0)

    const consumed = prev.quantity + deliveriesBetween - curr.quantity
    const rate = Math.max(0, consumed / days)
    periods.push({
      period: fmtShort(end),
      label: `${fmt(start)} → ${fmt(end)}`,
      burnRate: Math.round(rate * 100) / 100,
      consumed: Math.max(0, consumed),
      days,
    })
  }
  return periods
}

// ── custom tooltip ────────────────────────────────────────────
function StockTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border rounded-md shadow-md px-3 py-2 text-xs space-y-1">
      <p className="font-medium text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function BurnTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; burnRate: number; consumed: number; days: number } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-background border rounded-md shadow-md px-3 py-2 text-xs space-y-1">
      <p className="font-medium text-muted-foreground">{d.label}</p>
      <p>Taux: <span className="font-semibold">{d.burnRate} / jour</span></p>
      <p>Consommé: <span className="font-semibold">{d.consumed}</span></p>
      <p>Durée: <span className="font-semibold">{d.days} jours</span></p>
    </div>
  )
}

// ── main component ────────────────────────────────────────────
export function ItemDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: item, isLoading } = useItemType(id)
  const { data: counts = [] } = useItemCounts(id)
  const { data: deliveries = [] } = useItemDeliveries(id)
  const { data: sources = [] } = useItemSources(id)
  const { data: stockRows = [] } = useCurrentStock() as { data: StockRow[] }

  const currentQty = useMemo(
    () => stockRows.find(r => r.item_type_id === id)?.quantity ?? 0,
    [stockRows, id],
  )
  const lastCounted = useMemo(
    () => stockRows.find(r => r.item_type_id === id)?.last_counted_at,
    [stockRows, id],
  )

  const isLow = item ? currentQty < item.min_threshold : false

  const timeline  = useMemo(() => buildTimeline(counts, deliveries), [counts, deliveries])
  const burnRates = useMemo(() => buildBurnRate(counts, deliveries), [counts, deliveries])

  const avgBurnRate = useMemo(() => {
    if (!burnRates.length) return null
    const avg = burnRates.reduce((s, r) => s + r.burnRate, 0) / burnRates.length
    return Math.round(avg * 100) / 100
  }, [burnRates])

  const daysRemaining = avgBurnRate && avgBurnRate > 0
    ? Math.round(currentQty / avgBurnRate)
    : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!item) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Article introuvable.
      </CardContent></Card>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/inventory" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Inventaire
      </Link>

      {/* ── Overview ── */}
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

      {/* ── Key numbers ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Stock actuel"
          value={`${currentQty} ${item.unit}`}
          sub={lastCounted ? `Compté ${fmt(lastCounted)}` : 'Jamais compté'}
          urgent={isLow}
        />
        <StatCard
          label="Seuil minimum"
          value={`${item.min_threshold} ${item.unit}`}
        />
        <StatCard
          label="Taux moyen"
          value={avgBurnRate !== null ? `${avgBurnRate} / j` : '—'}
          sub={burnRates.length < 2 ? 'Pas assez de données' : `sur ${burnRates.length} période${burnRates.length > 1 ? 's' : ''}`}
        />
        <StatCard
          label="Jours restants"
          value={daysRemaining !== null ? `${daysRemaining} j` : '—'}
          sub={daysRemaining !== null && daysRemaining < 30 ? 'À commander bientôt' : undefined}
          urgent={daysRemaining !== null && daysRemaining < 30}
        />
      </div>

      {isLow && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Stock en-dessous du seuil minimum ({item.min_threshold} {item.unit})
        </div>
      )}

      {/* ── Stock over time chart ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock au fil du temps</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <Empty text="Aucun comptage enregistré pour cet article." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={d => fmtShort(d)} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<StockTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine
                  y={item.min_threshold}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: 'Min', fontSize: 10, fill: '#ef4444' }}
                />
                <Bar
                  dataKey="deliveryQty"
                  name="Livraison"
                  fill="#22c55e"
                  fillOpacity={0.75}
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  type="stepAfter"
                  dataKey="countQty"
                  name="Comptage"
                  stroke="#1d4ed8"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#1d4ed8' }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Burn rate chart ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            Taux de consommation par période
          </CardTitle>
        </CardHeader>
        <CardContent>
          {burnRates.length === 0 ? (
            <Empty text="Au moins deux comptages sont nécessaires pour calculer le taux de consommation." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={burnRates} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<BurnTooltip />} />
                <Bar dataKey="burnRate" name={`${item.unit}/jour`} fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                {avgBurnRate !== null && (
                  <ReferenceLine
                    y={avgBurnRate}
                    stroke="#6b7280"
                    strokeDasharray="4 4"
                    label={{ value: 'Moy.', fontSize: 10, fill: '#6b7280' }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Sources ── */}
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

      {/* ── Delivery history ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Historique des livraisons</CardTitle></CardHeader>
        <CardContent className="p-0">
          {deliveries.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Aucune livraison enregistrée.</div>
          ) : (
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

      {/* ── Count history ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Historique des comptages</CardTitle></CardHeader>
        <CardContent className="p-0">
          {counts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Aucun comptage enregistré.</div>
          ) : (
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
