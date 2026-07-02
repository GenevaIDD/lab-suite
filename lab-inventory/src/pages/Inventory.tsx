import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, differenceInDays } from 'date-fns'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Search, Package, Loader2, ClipboardList, Play, ArrowUpDown, Download } from 'lucide-react'
import { downloadXlsx } from '@/lib/export'
import { toast } from 'sonner'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useItemTypes, useDeliveries, useCurrentStock, useActiveSession, useAllActiveLots } from '@/lib/queries'
import type { XlsxSheet } from '@/lib/export'
import { useLang } from '@/lib/i18n'
import { useAuth, canManageStock } from '@/lib/auth'
import { cn } from '@/lib/utils'

interface StockRow {
  item_type_id: string
  name: string
  category: string
  unit: string
  min_threshold: number
  quantity: number
  last_counted_at: string
}

type SortKey = 'name' | 'category' | 'status' | 'last_counted'

export function Inventory() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'items' | 'deliveries'>('items')
  const [sortBy, setSortBy] = useState<SortKey>('name')

  const { t } = useLang()
  const { profile } = useAuth()
  const { data: itemTypes = [], isLoading: loadingItems, error: itemsError } = useItemTypes()
  const { data: stockRows = [] } = useCurrentStock() as { data: StockRow[] }
  const { data: deliveries = [], isLoading: loadingDeliveries } = useDeliveries()
  const { data: activeSession } = useActiveSession()
  const { data: activeLots = [] } = useAllActiveLots()

  const itemRows = useMemo(() => {
    const q = search.toLowerCase()
    const byItem = new Map<string, { qty: number; last_counted_at?: string }>()
    for (const row of stockRows) {
      byItem.set(row.item_type_id, {
        qty: Number(row.quantity),
        last_counted_at: (row as StockRow & { last_counted_at?: string }).last_counted_at,
      })
    }
    const rows = itemTypes
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
      .map((i) => {
        const stock = byItem.get(i.id)
        const quantity = stock?.qty ?? 0
        return { ...i, quantity, low: quantity < i.min_threshold, last_counted_at: stock?.last_counted_at }
      })

    rows.sort((a, b) => {
      if (sortBy === 'category')     return a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
      if (sortBy === 'status')       return (b.low ? 1 : 0) - (a.low ? 1 : 0) || a.name.localeCompare(b.name)
      if (sortBy === 'last_counted') {
        const da = a.last_counted_at ?? ''
        const db = b.last_counted_at ?? ''
        return da.localeCompare(db) // oldest first (never counted = empty string → top)
      }
      return a.name.localeCompare(b.name) // default alphabetical
    })
    return rows
  }, [itemTypes, stockRows, search, sortBy])

  async function exportInventory() {
    try {
      const byItem = new Map(stockRows.map((r) => [r.item_type_id, r]))
      const invColumns = [
        { header: t('export.inv.name'), width: 34 },
        { header: t('export.inv.category'), width: 22 },
        { header: t('export.inv.unit'), width: 14 },
        { header: t('export.inv.stock'), width: 14 },
        { header: t('export.inv.min'), width: 16 },
        { header: t('export.inv.status'), width: 14 },
        { header: t('export.inv.lastcount'), width: 16 },
      ]
      const invRows = [...itemTypes]
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
        .map((i) => {
          const s = byItem.get(i.id)
          const qty = s ? Number(s.quantity) : 0
          return [
            i.name, i.category, i.unit, qty, i.min_threshold,
            qty < i.min_threshold ? t('export.status.low') : t('export.status.ok'),
            s?.last_counted_at ? parseISO(s.last_counted_at) : null,
          ]
        })

      const sheets: XlsxSheet[] = [
        { name: t('export.sheet.inventory'), columns: invColumns, rows: invRows },
      ]

      // Lot-tracked items: one row per active lot, with expiry + remaining qty.
      if (activeLots.length > 0) {
        const lotColumns = [
          { header: t('export.lot.item'), width: 34 },
          { header: t('export.inv.category'), width: 22 },
          { header: t('export.lot.manufacturer'), width: 22 },
          { header: t('export.lot.number'), width: 16 },
          { header: t('export.lot.expiry'), width: 14 },
          { header: t('export.lot.remaining'), width: 16 },
          { header: t('export.inv.unit'), width: 12 },
        ]
        const lotRows = [...activeLots]
          .sort((a, b) =>
            (a.item_type?.name ?? '').localeCompare(b.item_type?.name ?? '') ||
            a.expiry_date.localeCompare(b.expiry_date),
          )
          .map((l) => [
            l.item_type?.name ?? '',
            l.item_type?.category ?? '',
            l.manufacturer,
            l.lot_number,
            l.expiry_date ? parseISO(l.expiry_date) : null,
            Number(l.quantity_remaining),
            l.item_type?.unit ?? '',
          ])
        sheets.push({ name: t('export.sheet.lots'), columns: lotColumns, rows: lotRows })
      }

      await downloadXlsx(`inventaire-${format(new Date(), 'yyyy-MM-dd')}.xlsx`, sheets)
    } catch (err) {
      toast.error(`${t('export.error')} : ${(err as Error).message}`)
    }
  }

  const deliveryRows = useMemo(() => {
    const q = search.toLowerCase()
    return deliveries.filter(
      (d) => !q || d.item_type?.name.toLowerCase().includes(q) || d.item_source?.manufacturer.toLowerCase().includes(q),
    )
  }, [deliveries, search])

  return (
    <div className="space-y-4">
      {/* Resume banner */}
      {activeSession && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium">
              {activeSession.status === 'paused' ? 'Session d\'inventaire en pause' : 'Session d\'inventaire en cours'}
            </span>
          </div>
          <Link
            to={`/inventory/session/${activeSession.id}`}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            {activeSession.status === 'paused' ? 'Reprendre' : 'Continuer'}
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap gap-y-2">
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tab === 'items' ? t('inv.search.items') : t('inv.search.deliveries')}
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {tab === 'items' && (
            <Select value={sortBy} onValueChange={(v) => setSortBy((v ?? 'name') as SortKey)}>
              <SelectTrigger className="w-44 shrink-0">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nom (A–Z)</SelectItem>
                <SelectItem value="category">Catégorie</SelectItem>
                <SelectItem value="status">Statut (stock faible d'abord)</SelectItem>
                <SelectItem value="last_counted">Dernier comptage (ancien d'abord)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/inventory/sessions" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Historique
          </Link>
          {tab === 'items' && (
            <button type="button" onClick={exportInventory} className={cn(buttonVariants({ variant: 'outline' }))}>
              <Download className="h-4 w-4 mr-1" />
              {t('export.btn')}
            </button>
          )}
          {!activeSession && (
            <Link to="/inventory/session/new" className={cn(buttonVariants({ variant: 'outline' }))}>
              <ClipboardList className="h-4 w-4 mr-1" />
              {t('inv.btn.start')}
            </Link>
          )}
          {canManageStock(profile) && (
            <Link to="/inventory/stock-count" className={cn(buttonVariants({ variant: 'outline' }))}>
              {t('inv.btn.count')}
            </Link>
          )}
          <Link to="/inventory/delivery/new" className={cn(buttonVariants({ variant: 'outline' }))}>
            {t('inv.btn.delivery')}
          </Link>
          <Link to="/inventory/new" className={cn(buttonVariants())}>
            <Plus className="h-4 w-4 mr-1" />
            {t('inv.btn.new')}
          </Link>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="items">{t('inv.tab.stock')}</TabsTrigger>
          <TabsTrigger value="deliveries">{t('inv.tab.deliveries')}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {tab === 'items' ? (
                  <>
                    <TableHead>{t('inv.col.item')}</TableHead>
                    <TableHead>{t('inv.col.category')}</TableHead>
                    <TableHead>{t('inv.col.unit')}</TableHead>
                    <TableHead className="text-right">{t('inv.col.quantity')}</TableHead>
                    <TableHead className="text-right">{t('inv.col.min')}</TableHead>
                    <TableHead>{t('inv.col.last.count')}</TableHead>
                    <TableHead>{t('inv.col.status')}</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>{t('inv.col.date')}</TableHead>
                    <TableHead>{t('inv.col.item')}</TableHead>
                    <TableHead>{t('inv.col.manufacturer')}</TableHead>
                    <TableHead className="text-right">{t('inv.col.qty.short')}</TableHead>
                    <TableHead>{t('inv.col.lot')}</TableHead>
                    <TableHead>{t('inv.col.expiry')}</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tab === 'items' ? (
                loadingItems ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                ) : itemsError ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Impossible de charger — vérifier la configuration Supabase.</TableCell></TableRow>
                ) : itemRows.length === 0 ? (
                  <TableRow><TableCell colSpan={7}><EmptyState search={search} target="items" /></TableCell></TableRow>
                ) : (
                  itemRows.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">
                        <Link to={`/inventory/items/${i.id}`} className="hover:underline">
                          {i.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{i.category}</TableCell>
                      <TableCell className="text-muted-foreground">{i.unit}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{i.quantity}</TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">{i.min_threshold}</TableCell>
                      <TableCell>
                        <LastCountedBadge date={i.last_counted_at} />
                      </TableCell>
                      <TableCell>
                        {i.low ? (
                          <Badge variant="destructive" className="text-xs">{t('inv.status.low')}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )
              ) : loadingDeliveries ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
              ) : deliveryRows.length === 0 ? (
                <TableRow><TableCell colSpan={7}><EmptyState search={search} target="deliveries" /></TableCell></TableRow>
              ) : (
                deliveryRows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-muted-foreground">{format(parseISO(d.received_at), 'd MMM yyyy')}</TableCell>
                    <TableCell className="font-medium">{d.item_type?.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{d.item_source?.manufacturer ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{d.lot_number ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{d.expiry_date ? format(parseISO(d.expiry_date), 'd MMM yyyy') : '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground flex gap-2 items-center">
        Statut :
        <Badge variant="destructive" className="text-xs">Stock faible</Badge>
        <Badge variant="outline" className="text-xs">OK</Badge>
      </div>
    </div>
  )
}

function EmptyState({ search, target }: { search: string; target: 'items' | 'deliveries' }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
      <Package className="h-8 w-8 opacity-30" />
      <p className="text-sm">
        {search
          ? 'Aucun résultat.'
          : target === 'items'
            ? 'Aucun article enregistré.'
            : 'Aucune livraison enregistrée.'}
      </p>
      {!search && (
        <Link
          to={target === 'items' ? '/inventory/new' : '/inventory/delivery/new'}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          {target === 'items' ? 'Ajouter le premier article' : 'Enregistrer la première livraison'}
        </Link>
      )}
    </div>
  )
}

function LastCountedBadge({ date }: { date?: string | null }) {
  if (!date) {
    return <span className="text-xs font-medium text-destructive">Jamais</span>
  }
  const days = differenceInDays(new Date(), parseISO(date))
  const label = days === 0 ? "Aujourd'hui"
    : days === 1 ? 'Hier'
    : `il y a ${days}j`
  const color = days <= 30 ? 'text-green-600'
    : days <= 60 ? 'text-amber-600'
    : 'text-destructive'
  return (
    <span className={`text-xs font-medium ${color}`} title={format(parseISO(date), 'd MMM yyyy')}>
      {label}
    </span>
  )
}
