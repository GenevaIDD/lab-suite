import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Wrench, Package, AlertTriangle, Clock } from 'lucide-react'

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Alert strip */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">2 maintenance tasks overdue · 3 items below minimum stock</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Equipment" value="—" icon={Wrench} description="registered items" />
        <StatCard title="Overdue Maintenance" value="—" icon={Clock} description="need attention" urgent />
        <StatCard title="Inventory Items" value="—" icon={Package} description="item types tracked" />
        <StatCard title="Low Stock" value="—" icon={AlertTriangle} description="below threshold" urgent />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No upcoming maintenance tasks.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">All items above minimum threshold.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  urgent,
}: {
  title: string
  value: string
  icon: React.ElementType
  description: string
  urgent?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${urgent ? 'text-amber-500' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
        {urgent && <Badge variant="destructive" className="mt-2 text-xs">Action needed</Badge>}
      </CardContent>
    </Card>
  )
}
