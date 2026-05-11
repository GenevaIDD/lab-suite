import { useNavigate } from 'react-router-dom'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Wifi, WifiOff, CloudUpload, LogOut } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useAuth, signOut, ROLE_LABELS } from '@/lib/auth'
import { toast } from 'sonner'

interface AppHeaderProps {
  title: string
}

export function AppHeader({ title }: AppHeaderProps) {
  const { isOnline, pendingWrites } = useOnlineStatus()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const initials = profile?.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      toast.error('Sign out failed')
    }
  }

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

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" />}>
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium truncate">{profile?.full_name ?? 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email ?? ''}</p>
              {profile?.role && (
                <Badge variant="secondary" className="mt-1 text-xs">
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive gap-2 cursor-pointer">
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
