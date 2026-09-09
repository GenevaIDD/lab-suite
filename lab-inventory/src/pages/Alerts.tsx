import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { CheckCircle2, Loader2, Clock, Package, CalendarClock, ClipboardList } from 'lucide-react'
import {
  useEquipmentList, useMaintenanceSchedules, useItemTypes,
  useCurrentStock, useAllActiveLots, useLastCountedByItem,
} from '@/lib/queries'
import { buildDigest } from '@/lib/alerts'
import { useLang } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/translations'
import { cn } from '@/lib/utils'

/**
 * Full, uncapped view of everything the weekly digest reports.
 *
 * The email caps each section at ten rows and collapses the rest into
 * "et N autre(s)"; its section headings link here with ?s=<section> so the
 * reader can see the whole list. Built from the same buildDigest() the email
 * uses, so the two cannot drift -- if this page and the email ever disagree,
 * that is a bug, not a difference of intent.
 */

const SECTIONS = ['overdue', 'duesoon', 'low', 'expired', 'expiring', 'stale'] as const
type SectionKey = (typeof SECTIONS)[number]

const META: Record<SectionKey, { title: TranslationKey; icon: typeof Clock }> = {
  overdue:  { title: 'digest.section.overdue',  icon: Clock },
  duesoon:  { title: 'digest.section.duesoon',  icon: Clock },
  low:      { title: 'digest.section.low',      icon: Package },
  expired:  { title: 'digest.section.expired',  icon: CalendarClock },
  expiring: { title: 'digest.section.expiring', icon: CalendarClock },
  stale:    { title: 'digest.section.stale',    icon: ClipboardList },
}

interface Row {
  key: string
  primary: string
  secondary: string
  badge?: string
  urgent?: boolean
  href: string
}

export function Alerts() {
  const { t } = useLang()
  const [params, setParams] = useSearchParams()
  const active = params.get('s') as SectionKey | null
  const focused = active && SECTIONS.includes(active) ? active : null

  const { data: equipment = [], isLoading: l1 } = useEquipmentList()
  const { data: schedules = [], isLoading: l2 } = useMaintenanceSchedules()
  const { data: itemTypes = [], isLoading: l3 } = useItemTypes()
  const { data: stockRows = [], isLoading: l4 } = useCurrentStock()
  const { data: lots = [], isLoading: l5 } = useAllActiveLots()
  const { data: lastCountedByItem, isLoading: l6 } = useLastCountedByItem()
  const loading = l1 || l2 || l3 || l4 || l5 || l6

  const digest = useMemo(() => buildDigest({
    equipment, schedules, itemTypes,
    stockRows: stockRows as { item_type_id: string; quantity: number; last_counted_at: string | null }[],
    lots,
    lastCountedByItem,
  }), [equipment, schedules, itemTypes, stockRows, lots, lastCountedByItem])

  const qty = (n: number, unit: string, min: number) =>
    t('digest.stock').replace('{q}', String(Math.round(n * 100) / 100)).replace('{u}', unit).replace('{m}', String(min))

  const rows = useMemo((): Record<SectionKey, Row[]> => ({
    overdue: digest.overdue.map((m) => ({
      key: m.schedule.id, primary: m.equipment.name, secondary: m.schedule.label,
      badge: t('digest.days.overdue').replace('{n}', String(Math.abs(m.days))),
      urgent: true, href: `/equipment/${m.equipment.id}`,
    })),
    duesoon: digest.dueSoon.map((m) => ({
      key: m.schedule.id, primary: m.equipment.name, secondary: m.schedule.label,
      badge: m.days === 0 ? t('digest.due.today') : t('digest.days.until').replace('{n}', String(m.days)),
      href: `/equipment/${m.equipment.id}`,
    })),
    low: digest.lowStock.map((i) => ({
      key: i.id, primary: i.name, secondary: qty(i.quantity, i.unit, i.min_threshold),
      badge: i.quantity <= 0 ? t('digest.outofstock') : undefined,
      urgent: i.quantity <= 0, href: `/inventory/items/${i.id}`,
    })),
    expired: digest.expired.map((l) => ({
      key: l.id, primary: l.item_type?.name ?? '—',
      secondary: [l.manufacturer, l.lot_number && `lot ${l.lot_number}`, `${l.quantity_remaining} ${l.item_type?.unit ?? ''}`.trim()]
        .filter(Boolean).join(' · '),
      badge: t('digest.expired.on').replace('{d}', format(parseISO(l.expiry_date), 'dd/MM/yyyy')),
      urgent: true, href: `/inventory/items/${l.item_type_id}`,
    })),
    expiring: digest.expiring.map((l) => ({
      key: l.id, primary: l.item_type?.name ?? '—',
      secondary: [l.manufacturer, l.lot_number && `lot ${l.lot_number}`, `${l.quantity_remaining} ${l.item_type?.unit ?? ''}`.trim()]
        .filter(Boolean).join(' · '),
      badge: t('digest.expires.on').replace('{d}', format(parseISO(l.expiry_date), 'dd/MM/yyyy')),
      href: `/inventory/items/${l.item_type_id}`,
    })),
    stale: digest.stale.map((i) => ({
      key: i.id, primary: i.name, secondary: qty(i.quantity, i.unit, i.min_threshold),
      badge: i.daysSince === null ? t('digest.never') : t('digest.since').replace('{n}', String(i.daysSince)),
      urgent: i.daysSince === null, href: `/inventory/items/${i.id}`,
    })),
  }), [digest, t])

  const title = (k: SectionKey) =>
    t(META[k].title)
      .replace('{n}', String(k === 'expiring' ? digest.expiryHorizonDays : digest.staleDays))

  const shown = focused ? [focused] : SECTIONS.filter((k) => rows[k].length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('alerts.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {loading ? '…' : t('alerts.subtitle').replace('{n}', String(digest.total))}
        </p>
      </div>

      {/* Section filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={focused ? 'outline' : 'default'}
          size="sm"
          onClick={() => setParams({})}
        >
          {t('alerts.all')}
        </Button>
        {SECTIONS.map((k) => (
          <Button
            key={k}
            variant={focused === k ? 'default' : 'outline'}
            size="sm"
            onClick={() => setParams({ s: k })}
            disabled={rows[k].length === 0}
          >
            {title(k)}
            <Badge variant="secondary" className="ml-2 text-xs">{rows[k].length}</Badge>
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : digest.isEmpty ? (
        <Card><CardContent className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          {t('alerts.empty')}
        </CardContent></Card>
      ) : (
        shown.map((k) => {
          const Icon = META[k].icon
          return (
            <Card key={k}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide">{title(k)}</h2>
                  <Badge variant="secondary" className="text-xs">{rows[k].length}</Badge>
                </div>
                {rows[k].length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">{t('alerts.section.empty')}</p>
                ) : (
                  <div className="space-y-2">
                    {rows[k].map((r) => (
                      <Link
                        key={r.key}
                        to={r.href}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.primary}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.secondary}</p>
                        </div>
                        {r.badge && (
                          <Badge
                            variant={r.urgent ? 'destructive' : 'outline'}
                            className="text-xs shrink-0"
                          >
                            {r.badge}
                          </Badge>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}

      {focused && (
        <Link to="/alerts" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
          {t('alerts.all')}
        </Link>
      )}
    </div>
  )
}
