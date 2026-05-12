import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
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
import { Plus, Search, Package, Loader2, ClipboardList, Play } from 'lucide-react'
import { useItemTypes, useDeliveries, useCurrentStock, useActiveSession } from '@/lib/queries'
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

export function Inventory() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'items' | 'deliveries'>('items')

  const { data: itemTypes = [], isLoading: loadingItems, error: itemsError } = useItemTypes()
  const { data: stockRows = [] } = useCurrentStock() as { data: StockRow[] }
  const { data: deliveries = [], isLoading: loadingDeliveries } = useDeliveries()
  const { data: activeSession } = useActiveSession()

  const itemRows = useMemo(() => {
    const q = search.toLowerCase()
    const byItem = new Map<string, number>()
    for (const row of stockRows) {
      byItem.set(row.item_type_id, Number(row.quantity))
    }
    return itemTypes
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
      .map((i) => {
        const quantity = byItem.get(i.id) ?? 0
        return { ...i, quantity, low: quantity < i.min_threshold }
      })
  }, [itemTypes, stockRows, search])

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
              {activeSession.status === 'paused' ? 'Inventory session paused' : 'Inventory session in progress'}
            </span>
          </div>
          <Link
            to={`/inventory/session/${activeSession.id}`}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            {activeSession.status === 'paused' ? 'Resume' : 'Continue'}
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap gap-y-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tab === 'items' ? 'Search items...' : 'Search deliveries...'}
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {!activeSession && (
            <Link to="/inventory/session/new" className={cn(buttonVariants({ variant: 'outline' }))}>
              <ClipboardList className="h-4 w-4 mr-1" />
              Start Inventory
            </Link>
          )}
          <Link to="/inventory/stock-count" className={cn(buttonVariants({ variant: 'outline' }))}>
            Log Stock Count
          </Link>
          <Link to="/inventory/delivery/new" className={cn(buttonVariants({ variant: 'outline' }))}>
            Log New Delivery
          </Link>
          <Link to="/inventory/new" className={cn(buttonVariants())}>
            <Plus className="h-4 w-4 mr-1" />
            New Item
          </Link>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="items">Current Stock</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {tab === 'items' ? (
                  <>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Min</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Lot #</TableHead>
                    <TableHead>Expiry</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tab === 'items' ? (
                loadingItems ? (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                ) : itemsError ? (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Cannot load — check Supabase configuration.</TableCell></TableRow>
                ) : itemRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState search={search} target="items" /></TableCell></TableRow>
                ) : (
                  itemRows.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell className="text-muted-foreground">{i.category}</TableCell>
                      <TableCell className="text-muted-foreground">{i.unit}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{i.quantity}</TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">{i.min_threshold}</TableCell>
                      <TableCell>
                        {i.low ? (
                          <Badge variant="destructive" className="text-xs">Low stock</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )
              ) : loadingDeliveries ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
              ) : deliveryRows.length === 0 ? (
                <TableRow><TableCell colSpan={6}><EmptyState search={search} target="deliveries" /></TableCell></TableRow>
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
        Stock status:
        <Badge variant="destructive" className="text-xs">Low stock</Badge>
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
          ? 'No matches.'
          : target === 'items'
            ? 'No inventory items registered yet.'
            : 'No deliveries logged yet.'}
      </p>
      {!search && (
        <Link
          to={target === 'items' ? '/inventory/new' : '/inventory/delivery/new'}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          {target === 'items' ? 'Add first item' : 'Log first delivery'}
        </Link>
      )}
    </div>
  )
}
