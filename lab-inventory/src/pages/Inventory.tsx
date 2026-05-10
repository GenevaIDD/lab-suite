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
import { Plus, Search, Package, Loader2 } from 'lucide-react'
import { useItemTypes, useDeliveries, useCurrentStock } from '@/lib/queries'
import { cn } from '@/lib/utils'
import type { Lab } from '@/types/database'

const LAB_LABEL: Record<string, string> = { lab_1: 'Lab 1', lab_2: 'Lab 2' }

interface StockRow {
  item_type_id: string
  name: string
  category: string
  unit: string
  min_threshold: number
  lab: Lab
  quantity: number
  last_counted_at: string
}

export function Inventory() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'items' | 'deliveries'>('items')

  const { data: itemTypes = [], isLoading: loadingItems, error: itemsError } = useItemTypes()
  const { data: stockRows = [] } = useCurrentStock() as { data: StockRow[] }
  const { data: deliveries = [], isLoading: loadingDeliveries } = useDeliveries()

  const itemRows = useMemo(() => {
    const q = search.toLowerCase()
    const byItem = new Map<string, { lab1: number; lab2: number }>()
    for (const row of stockRows) {
      const cur = byItem.get(row.item_type_id) ?? { lab1: 0, lab2: 0 }
      if (row.lab === 'lab_1') cur.lab1 = Number(row.quantity)
      if (row.lab === 'lab_2') cur.lab2 = Number(row.quantity)
      byItem.set(row.item_type_id, cur)
    }
    return itemTypes
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
      .map((i) => {
        const stock = byItem.get(i.id) ?? { lab1: 0, lab2: 0 }
        const total = stock.lab1 + stock.lab2
        return { ...i, lab1: stock.lab1, lab2: stock.lab2, total, low: total < i.min_threshold }
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
                    <TableHead className="text-right">Lab 1</TableHead>
                    <TableHead className="text-right">Lab 2</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Min</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>Lab</TableHead>
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
                  <TableRow><TableCell colSpan={8} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                ) : itemsError ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Cannot load — check Supabase configuration.</TableCell></TableRow>
                ) : itemRows.length === 0 ? (
                  <TableRow><TableCell colSpan={8}><EmptyState search={search} target="items" /></TableCell></TableRow>
                ) : (
                  itemRows.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell className="text-muted-foreground">{i.category}</TableCell>
                      <TableCell className="text-muted-foreground">{i.unit}</TableCell>
                      <TableCell className="text-right tabular-nums">{i.lab1}</TableCell>
                      <TableCell className="text-right tabular-nums">{i.lab2}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{i.total}</TableCell>
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
                <TableRow><TableCell colSpan={7} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
              ) : deliveryRows.length === 0 ? (
                <TableRow><TableCell colSpan={7}><EmptyState search={search} target="deliveries" /></TableCell></TableRow>
              ) : (
                deliveryRows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-muted-foreground">{format(parseISO(d.received_at), 'd MMM yyyy')}</TableCell>
                    <TableCell className="font-medium">{d.item_type?.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{d.item_source?.manufacturer ?? '—'}</TableCell>
                    <TableCell>{LAB_LABEL[d.lab]}</TableCell>
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
