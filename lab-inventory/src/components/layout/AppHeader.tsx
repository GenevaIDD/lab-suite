import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, CloudUpload } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface AppHeaderProps {
  title: string
}

export function AppHeader({ title }: AppHeaderProps) {
  const { isOnline, pendingWrites } = useOnlineStatus()

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <h1 className="text-base font-semibold">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        {pendingWrites > 0 && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <CloudUpload className="h-3 w-3" />
            {pendingWrites} pending
          </Badge>
        )}
        {isOnline ? (
          <Badge variant="outline" className="gap-1 text-xs text-green-600 border-green-200">
            <Wifi className="h-3 w-3" />
            Online
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-200">
            <WifiOff className="h-3 w-3" />
            Offline
          </Badge>
        )}
      </div>
    </header>
  )
}
